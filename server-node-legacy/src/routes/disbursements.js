const express = require("express");
const db = require("../db");
const env = require("../config/env");
const { authenticate, requireAdmin } = require("../middleware/auth");
const chainService = require("../services/chainService");
const { recordOperation } = require("../services/logService");
const {
  buildDisbursementPayload,
  normalizeAmountToCents,
  sha256Hex,
  verifyHash
} = require("../utils/hash");
const { asyncHandler } = require("../utils/asyncHandler");
const { parsePagination, buildPaginatedResult } = require("../utils/pagination");
const { buildExplorerTxUrl, getPublicChainConfig } = require("../utils/chainMeta");
const { success, fail } = require("../utils/response");

const router = express.Router();

router.get(
  "/project/:projectId",
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = parsePagination(req.query);
    const conditions = ["project_id = ?"];
    const params = [req.params.projectId];

    if (req.query.startDate) {
      conditions.push("occurred_at >= ?");
      params.push(new Date(req.query.startDate));
    }
    if (req.query.endDate) {
      conditions.push("occurred_at <= ?");
      params.push(new Date(req.query.endDate));
    }

    const whereSql = `WHERE ${conditions.join(" AND ")}`;
    const items = await db.query(
      `
        SELECT *
        FROM disbursements
        ${whereSql}
        ORDER BY occurred_at DESC
        LIMIT ? OFFSET ?
      `,
      [...params, pageSize, offset]
    );
    const totalRow = await db.queryOne(`SELECT COUNT(*) AS total FROM disbursements ${whereSql}`, params);

    return success(res, buildPaginatedResult(items, totalRow.total, page, pageSize));
  })
);

router.post(
  "/",
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { projectId, amount, receiver, purpose, description = "", occurredAt } = req.body;
    if (!projectId || !amount || !receiver || !purpose) {
      return fail(res, 400, "项目编号、金额、接收方和用途不能为空");
    }

    const project = await db.queryOne("SELECT * FROM projects WHERE id = ?", [projectId]);
    if (!project) {
      return fail(res, 404, "项目不存在");
    }

    let amountCents;
    try {
      amountCents = normalizeAmountToCents(amount);
    } catch (error) {
      return fail(res, 400, error.message);
    }

    const availableBalance = Number(project.raised_amount) - Number(project.disbursed_amount);
    if (amountCents > availableBalance) {
      return fail(res, 400, "拨付金额超过项目可用余额");
    }

    const occurredAtValue = occurredAt ? new Date(occurredAt) : new Date();
    const insertResult = await db.run(
      `
        INSERT INTO disbursements (
          project_id, amount, receiver, purpose, description, occurred_at, chain_status, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
      `,
      [projectId, amountCents, String(receiver).trim(), String(purpose).trim(), String(description).trim(), occurredAtValue, new Date()]
    );

    const disbursementId = insertResult.insertId;
    const payload = buildDisbursementPayload({
      disbursementId,
      projectId: Number(projectId),
      amount: amountCents,
      receiver,
      purpose,
      occurredAt: occurredAtValue.toISOString()
    });
    const recordHash = sha256Hex(payload);

    await db.run("UPDATE disbursements SET record_hash = ? WHERE id = ?", [recordHash, disbursementId]);

    let chainStatus = "failed";
    let receipt = { txHash: null, blockNumber: null, recordedAt: null };
    try {
      receipt = await chainService.recordDisbursement({
        disbursementId,
        projectId: Number(projectId),
        recordHash,
        amount: amountCents
      });
      chainStatus = receipt.status;
    } catch (error) {
      receipt = { status: "failed", txHash: null, blockNumber: null, recordedAt: null, error: error.message };
    }

    await db.run(
      `
        UPDATE disbursements
        SET chain_status = ?, tx_hash = ?, block_number = ?, chain_recorded_at = ?
        WHERE id = ?
      `,
      [chainStatus, receipt.txHash, receipt.blockNumber, receipt.recordedAt || null, disbursementId]
    );

    await db.run("UPDATE projects SET disbursed_amount = disbursed_amount + ?, updated_at = ? WHERE id = ?", [
      amountCents,
      new Date(),
      projectId
    ]);

    await db.run(
      `
        INSERT INTO chain_records (
          business_type, business_id, record_hash, tx_hash, block_number, status, payload_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        "disbursement",
        disbursementId,
        recordHash,
        receipt.txHash,
        receipt.blockNumber,
        chainStatus,
        JSON.stringify({ disbursementId, projectId, payload }),
        new Date(),
        new Date()
      ]
    );

    await recordOperation({
      userId: req.user.id,
      username: req.user.username,
      action: "disbursement_create",
      businessType: "disbursement",
      businessId: disbursementId,
      detail: { projectId, amount: amountCents, purpose }
    });

    const disbursement = await db.queryOne("SELECT * FROM disbursements WHERE id = ?", [disbursementId]);
    return success(res, disbursement, chainStatus === "success" ? "拨付记录已存证" : "拨付已记录，但上链未成功");
  })
);

router.get(
  "/:id/verify",
  asyncHandler(async (req, res) => {
    const record = await db.queryOne("SELECT * FROM disbursements WHERE id = ?", [req.params.id]);
    if (!record) {
      return fail(res, 404, "拨付记录不存在");
    }

    const chainRecord = await db.queryOne(
      `
        SELECT *
        FROM chain_records
        WHERE business_type = 'disbursement' AND business_id = ?
        ORDER BY id DESC
        LIMIT 1
      `,
      [req.params.id]
    );

    const payload = buildDisbursementPayload({
      disbursementId: record.id,
      projectId: record.project_id,
      amount: record.amount,
      receiver: record.receiver,
      purpose: record.purpose,
      occurredAt: new Date(record.occurred_at).toISOString()
    });

    const calculatedOk = verifyHash(payload, record.record_hash);
    let onChainHash = env.chainMode === "mock" && chainRecord ? chainRecord.record_hash : null;

    if (env.chainMode !== "mock" && record.chain_status === "success") {
      try {
        const proof = await chainService.getDisbursementProof(record.id);
        onChainHash = proof ? proof.recordHash : null;
      } catch (_error) {
        onChainHash = null;
      }
    }

    const chainOk = onChainHash ? onChainHash === record.record_hash : false;

    return success(res, {
      disbursementId: record.id,
      payload,
      databaseHash: record.record_hash,
      onChainHash,
      txHash: record.tx_hash,
      explorerTxUrl: buildExplorerTxUrl(record.tx_hash),
      ...getPublicChainConfig(),
      calculatedOk,
      chainOk,
      verified: calculatedOk && chainOk
    });
  })
);

module.exports = router;
