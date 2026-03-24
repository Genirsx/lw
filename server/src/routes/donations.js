const express = require("express");
const db = require("../db");
const env = require("../config/env");
const { authenticate } = require("../middleware/auth");
const chainService = require("../services/chainService");
const {
  buildDonationPayload,
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
  "/my",
  authenticate,
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = parsePagination(req.query);
    const status = req.query.status ? String(req.query.status) : null;
    const conditions = ["d.user_id = ?"];
    const params = [req.user.id];

    if (status) {
      conditions.push("d.chain_status = ?");
      params.push(status);
    }

    const whereSql = `WHERE ${conditions.join(" AND ")}`;
    const items = await db.query(
      `
        SELECT d.*, p.name AS project_name
        FROM donations d
        JOIN projects p ON p.id = d.project_id
        ${whereSql}
        ORDER BY d.donated_at DESC
        LIMIT ? OFFSET ?
      `,
      [...params, pageSize, offset]
    );
    const totalRow = await db.queryOne(
      `
        SELECT COUNT(*) AS total
        FROM donations d
        JOIN projects p ON p.id = d.project_id
        ${whereSql}
      `,
      params
    );

    return success(res, buildPaginatedResult(items, totalRow.total, page, pageSize));
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = parsePagination(req.query);
    const conditions = [];
    const params = [];

    if (req.query.projectId) {
      conditions.push("d.project_id = ?");
      params.push(Number(req.query.projectId));
    }
    if (req.query.status) {
      conditions.push("d.chain_status = ?");
      params.push(String(req.query.status));
    }
    if (req.query.startDate) {
      conditions.push("d.donated_at >= ?");
      params.push(new Date(req.query.startDate));
    }
    if (req.query.endDate) {
      conditions.push("d.donated_at <= ?");
      params.push(new Date(req.query.endDate));
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const items = await db.query(
      `
        SELECT d.*, p.name AS project_name
        FROM donations d
        JOIN projects p ON p.id = d.project_id
        ${whereSql}
        ORDER BY d.donated_at DESC
        LIMIT ? OFFSET ?
      `,
      [...params, pageSize, offset]
    );
    const totalRow = await db.queryOne(
      `
        SELECT COUNT(*) AS total
        FROM donations d
        JOIN projects p ON p.id = d.project_id
        ${whereSql}
      `,
      params
    );

    return success(res, buildPaginatedResult(items, totalRow.total, page, pageSize));
  })
);

router.post(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const { projectId, donorName, amount, message = "", donatedAt, isAnonymous = false } = req.body;
    if (!projectId || !amount) {
      return fail(res, 400, "项目编号和捐赠金额不能为空");
    }

    const project = await db.queryOne("SELECT * FROM projects WHERE id = ?", [projectId]);
    if (!project) {
      return fail(res, 404, "项目不存在");
    }
    if (project.status !== "active") {
      return fail(res, 400, "当前项目未处于可捐赠状态");
    }

    let amountCents;
    try {
      amountCents = normalizeAmountToCents(amount);
    } catch (error) {
      return fail(res, 400, error.message);
    }

    const donatedAtValue = donatedAt ? new Date(donatedAt) : new Date();
    const insertResult = await db.run(
      `
        INSERT INTO donations (
          project_id, user_id, donor_name, is_anonymous, amount, message,
          donated_at, chain_status, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
      `,
      [
        projectId,
        req.user.id,
        isAnonymous ? "匿名捐赠者" : String(donorName || req.user.username).trim(),
        isAnonymous ? 1 : 0,
        amountCents,
        String(message).trim(),
        donatedAtValue,
        new Date()
      ]
    );

    const donationId = insertResult.insertId;
    const payload = buildDonationPayload({
      donationId,
      projectId: Number(projectId),
      donorName: isAnonymous ? "ANONYMOUS" : String(donorName || req.user.username).trim(),
      isAnonymous,
      amount: amountCents,
      message,
      donatedAt: donatedAtValue.toISOString()
    });
    const recordHash = sha256Hex(payload);

    await db.run("UPDATE donations SET record_hash = ? WHERE id = ?", [recordHash, donationId]);

    let chainStatus = "failed";
    let receipt = { txHash: null, blockNumber: null, recordedAt: null };
    try {
      receipt = await chainService.recordDonation({
        donationId,
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
        UPDATE donations
        SET record_hash = ?, chain_status = ?, tx_hash = ?, block_number = ?, chain_recorded_at = ?
        WHERE id = ?
      `,
      [recordHash, chainStatus, receipt.txHash, receipt.blockNumber, receipt.recordedAt || null, donationId]
    );

    await db.run("UPDATE projects SET raised_amount = raised_amount + ?, updated_at = ? WHERE id = ?", [
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
        "donation",
        donationId,
        recordHash,
        receipt.txHash,
        receipt.blockNumber,
        chainStatus,
        JSON.stringify({ donationId, projectId, payload }),
        new Date(),
        new Date()
      ]
    );

    const donation = await db.queryOne("SELECT * FROM donations WHERE id = ?", [donationId]);
    return success(res, donation, chainStatus === "success" ? "捐赠记录已存证" : "捐赠已记录，但上链未成功");
  })
);

router.get(
  "/:id/verify",
  asyncHandler(async (req, res) => {
    const donation = await db.queryOne("SELECT * FROM donations WHERE id = ?", [req.params.id]);
    if (!donation) {
      return fail(res, 404, "捐赠记录不存在");
    }

    const chainRecord = await db.queryOne(
      `
        SELECT *
        FROM chain_records
        WHERE business_type = 'donation' AND business_id = ?
        ORDER BY id DESC
        LIMIT 1
      `,
      [req.params.id]
    );

    const payload = buildDonationPayload({
      donationId: donation.id,
      projectId: donation.project_id,
      donorName: donation.is_anonymous ? "ANONYMOUS" : donation.donor_name,
      isAnonymous: Boolean(donation.is_anonymous),
      amount: donation.amount,
      message: donation.message || "",
      donatedAt: new Date(donation.donated_at).toISOString()
    });

    const calculatedOk = verifyHash(payload, donation.record_hash);
    let onChainHash = chainRecord ? chainRecord.record_hash : null;

    if (env.chainMode !== "mock" && donation.chain_status === "success") {
      try {
        const proof = await chainService.getDonationProof(donation.id);
        onChainHash = proof ? proof.recordHash : null;
      } catch (_error) {
        onChainHash = null;
      }
    }

    const chainOk = onChainHash ? onChainHash === donation.record_hash : false;

    return success(res, {
      donationId: donation.id,
      payload,
      databaseHash: donation.record_hash,
      onChainHash,
      txHash: donation.tx_hash,
      explorerTxUrl: buildExplorerTxUrl(donation.tx_hash),
      ...getPublicChainConfig(),
      calculatedOk,
      chainOk,
      verified: calculatedOk && chainOk
    });
  })
);

module.exports = router;
