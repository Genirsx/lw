const express = require("express");
const db = require("../db");
const { authenticate, requireAdmin } = require("../middleware/auth");
const chainService = require("../services/chainService");
const { recordOperation } = require("../services/logService");
const { buildProjectPayload, sha256Hex, normalizeAmountToCents } = require("../utils/hash");
const { asyncHandler } = require("../utils/asyncHandler");
const { parsePagination, buildPaginatedResult } = require("../utils/pagination");
const { success, fail } = require("../utils/response");

const router = express.Router();

function buildProjectHashPayload(project) {
  return buildProjectPayload({
    projectId: project.id,
    name: project.name,
    targetAmount: project.target_amount,
    startTime: new Date(project.start_time).toISOString(),
    endTime: new Date(project.end_time).toISOString(),
    status: project.status
  });
}

async function persistProjectChainRecord(project, receipt, status, payload) {
  await db.run(
    `
      INSERT INTO chain_records (
        business_type, business_id, record_hash, tx_hash, block_number, status, payload_json, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      "project",
      project.id,
      project.chain_hash,
      receipt.txHash,
      receipt.blockNumber,
      status,
      JSON.stringify({ projectId: project.id, payload }),
      new Date(),
      new Date()
    ]
  );
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const status = req.query.status ? String(req.query.status) : null;
    const params = [];
    let whereSql = "";

    if (status) {
      whereSql = "WHERE p.status = ?";
      params.push(status);
    }

    const projects = await db.query(
      `
        SELECT
          p.*,
          COUNT(DISTINCT d.id) AS donation_count
        FROM projects p
        LEFT JOIN donations d ON d.project_id = p.id
        ${whereSql}
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `,
      params
    );

    return success(res, projects);
  })
);

router.get(
  "/admin/list",
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = parsePagination(req.query);
    const status = req.query.status ? String(req.query.status) : null;
    const keyword = req.query.keyword ? `%${String(req.query.keyword).trim()}%` : null;
    const conditions = [];
    const params = [];

    if (status) {
      conditions.push("status = ?");
      params.push(status);
    }

    if (keyword) {
      conditions.push("(name LIKE ? OR description LIKE ?)");
      params.push(keyword, keyword);
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const items = await db.query(
      `
        SELECT *
        FROM projects
        ${whereSql}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `,
      [...params, pageSize, offset]
    );

    const totalRow = await db.queryOne(`SELECT COUNT(*) AS total FROM projects ${whereSql}`, params);

    return success(res, buildPaginatedResult(items, totalRow.total, page, pageSize));
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const project = await db.queryOne("SELECT * FROM projects WHERE id = ?", [req.params.id]);
    if (!project) {
      return fail(res, 404, "项目不存在");
    }

    const donations = await db.query(
      `
        SELECT id, donor_name, is_anonymous, amount, message, donated_at, chain_status, tx_hash
        FROM donations
        WHERE project_id = ?
        ORDER BY donated_at DESC
        LIMIT 20
      `,
      [req.params.id]
    );

    const disbursements = await db.query(
      `
        SELECT id, amount, receiver, purpose, description, occurred_at, chain_status, tx_hash
        FROM disbursements
        WHERE project_id = ?
        ORDER BY occurred_at DESC
        LIMIT 20
      `,
      [req.params.id]
    );

    return success(res, { project, donations, disbursements });
  })
);

router.post(
  "/",
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { name, description, targetAmount, imageUrl, startTime, endTime, status = "active" } = req.body;

    if (!name || !description || !targetAmount || !startTime || !endTime) {
      return fail(res, 400, "项目名称、描述、目标金额、开始和结束时间不能为空");
    }

    let targetAmountCents;
    try {
      targetAmountCents = normalizeAmountToCents(targetAmount);
    } catch (error) {
      return fail(res, 400, error.message);
    }

    const createdAt = new Date();
    const insertResult = await db.run(
      `
        INSERT INTO projects (
          name, description, target_amount, image_url, start_time, end_time,
          status, chain_status, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      `,
      [
        name.trim(),
        description.trim(),
        targetAmountCents,
        imageUrl || "",
        new Date(startTime),
        new Date(endTime),
        status,
        createdAt,
        createdAt
      ]
    );

    const project = await db.queryOne("SELECT * FROM projects WHERE id = ?", [insertResult.insertId]);
    const payload = buildProjectHashPayload(project);
    const projectHash = sha256Hex(payload);

    await db.run("UPDATE projects SET chain_hash = ?, updated_at = ? WHERE id = ?", [
      projectHash,
      new Date(),
      project.id
    ]);

    const refreshedProject = await db.queryOne("SELECT * FROM projects WHERE id = ?", [project.id]);
    let chainStatus = "failed";
    let receipt = { txHash: null, blockNumber: null, recordedAt: null };

    try {
      receipt = await chainService.syncProjectProof({
        projectId: refreshedProject.id,
        projectHash
      });
      chainStatus = receipt.status;
    } catch (error) {
      receipt = { status: "failed", txHash: null, blockNumber: null, recordedAt: null, error: error.message };
    }

    await db.run(
      `
        UPDATE projects
        SET chain_status = ?, chain_tx_hash = ?, chain_block_number = ?, updated_at = ?
        WHERE id = ?
      `,
      [chainStatus, receipt.txHash, receipt.blockNumber, new Date(), refreshedProject.id]
    );

    await persistProjectChainRecord({ ...refreshedProject, chain_hash: projectHash }, receipt, chainStatus, payload);
    await recordOperation({
      userId: req.user.id,
      username: req.user.username,
      action: "project_create",
      businessType: "project",
      businessId: refreshedProject.id,
      detail: { name: refreshedProject.name, status: refreshedProject.status }
    });

    const finalProject = await db.queryOne("SELECT * FROM projects WHERE id = ?", [refreshedProject.id]);
    return success(res, finalProject, chainStatus === "success" ? "项目创建并上链成功" : "项目已创建，但上链未成功");
  })
);

router.put(
  "/:id",
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const existing = await db.queryOne("SELECT * FROM projects WHERE id = ?", [req.params.id]);
    if (!existing) {
      return fail(res, 404, "项目不存在");
    }

    const nextName = String(req.body.name || existing.name).trim();
    const nextDescription = String(req.body.description || existing.description).trim();
    const nextImageUrl = req.body.imageUrl !== undefined ? String(req.body.imageUrl).trim() : existing.image_url;
    const nextStartTime = req.body.startTime ? new Date(req.body.startTime) : existing.start_time;
    const nextEndTime = req.body.endTime ? new Date(req.body.endTime) : existing.end_time;
    let nextTargetAmount = existing.target_amount;

    if (req.body.targetAmount !== undefined) {
      try {
        nextTargetAmount = normalizeAmountToCents(req.body.targetAmount);
      } catch (error) {
        return fail(res, 400, error.message);
      }
    }

    await db.run(
      `
        UPDATE projects
        SET name = ?, description = ?, target_amount = ?, image_url = ?, start_time = ?, end_time = ?, updated_at = ?
        WHERE id = ?
      `,
      [nextName, nextDescription, nextTargetAmount, nextImageUrl, nextStartTime, nextEndTime, new Date(), req.params.id]
    );

    const updated = await db.queryOne("SELECT * FROM projects WHERE id = ?", [req.params.id]);
    const payload = buildProjectHashPayload(updated);
    const projectHash = sha256Hex(payload);

    let chainStatus = "failed";
    let receipt = { txHash: null, blockNumber: null, recordedAt: null };

    try {
      receipt = await chainService.syncProjectProof({ projectId: updated.id, projectHash });
      chainStatus = receipt.status;
    } catch (error) {
      receipt = { status: "failed", txHash: null, blockNumber: null, recordedAt: null, error: error.message };
    }

    await db.run(
      `
        UPDATE projects
        SET chain_hash = ?, chain_status = ?, chain_tx_hash = ?, chain_block_number = ?, updated_at = ?
        WHERE id = ?
      `,
      [projectHash, chainStatus, receipt.txHash, receipt.blockNumber, new Date(), updated.id]
    );

    await persistProjectChainRecord({ ...updated, chain_hash: projectHash }, receipt, chainStatus, payload);
    await recordOperation({
      userId: req.user.id,
      username: req.user.username,
      action: "project_update",
      businessType: "project",
      businessId: updated.id,
      detail: { name: updated.name }
    });

    const finalProject = await db.queryOne("SELECT * FROM projects WHERE id = ?", [updated.id]);
    return success(res, finalProject, chainStatus === "success" ? "项目更新并同步上链成功" : "项目已更新，但上链未成功");
  })
);

router.patch(
  "/:id/status",
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    if (!["draft", "active", "closed"].includes(status)) {
      return fail(res, 400, "项目状态必须为 draft、active 或 closed");
    }

    const existing = await db.queryOne("SELECT * FROM projects WHERE id = ?", [req.params.id]);
    if (!existing) {
      return fail(res, 404, "项目不存在");
    }

    await db.run("UPDATE projects SET status = ?, updated_at = ? WHERE id = ?", [status, new Date(), req.params.id]);
    const updated = await db.queryOne("SELECT * FROM projects WHERE id = ?", [req.params.id]);
    const payload = buildProjectHashPayload(updated);
    const projectHash = sha256Hex(payload);

    let chainStatus = "failed";
    let receipt = { txHash: null, blockNumber: null, recordedAt: null };
    try {
      receipt = await chainService.syncProjectProof({ projectId: updated.id, projectHash });
      chainStatus = receipt.status;
    } catch (error) {
      receipt = { status: "failed", txHash: null, blockNumber: null, recordedAt: null, error: error.message };
    }

    await db.run(
      `
        UPDATE projects
        SET chain_hash = ?, chain_status = ?, chain_tx_hash = ?, chain_block_number = ?, updated_at = ?
        WHERE id = ?
      `,
      [projectHash, chainStatus, receipt.txHash, receipt.blockNumber, new Date(), updated.id]
    );

    await persistProjectChainRecord({ ...updated, chain_hash: projectHash }, receipt, chainStatus, payload);
    await recordOperation({
      userId: req.user.id,
      username: req.user.username,
      action: "project_status_change",
      businessType: "project",
      businessId: updated.id,
      detail: { status }
    });

    const finalProject = await db.queryOne("SELECT * FROM projects WHERE id = ?", [updated.id]);
    return success(res, finalProject, "项目状态已更新");
  })
);

module.exports = router;
