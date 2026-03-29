const express = require("express");
const db = require("../db");
const { ethers } = require("ethers");
const env = require("../config/env");
const chainService = require("../services/chainService");
const { authenticate, requireAdmin } = require("../middleware/auth");
const { recordOperation } = require("../services/logService");
const { buildProjectPayload, buildDonationPayload, buildDisbursementPayload, sha256Hex } = require("../utils/hash");
const { asyncHandler } = require("../utils/asyncHandler");
const { parsePagination, buildPaginatedResult } = require("../utils/pagination");
const { buildExplorerTxUrl, getPublicChainConfig } = require("../utils/chainMeta");
const { success, fail } = require("../utils/response");

const router = express.Router();

function normalizeBigInt(value) {
  return typeof value === "bigint" ? value.toString() : value;
}

function serializeLog(log) {
  return {
    address: log.address,
    topics: log.topics,
    data: log.data,
    index: log.index,
    transactionIndex: log.transactionIndex,
    blockNumber: log.blockNumber,
    transactionHash: log.transactionHash,
    removed: log.removed
  };
}

async function buildTransactionDetail(txHash) {
  const relatedRecord = await db.queryOne(
    `
      SELECT *
      FROM chain_records
      WHERE tx_hash = ?
      ORDER BY id DESC
      LIMIT 1
    `,
    [txHash]
  );

  if (env.chainMode === "mock") {
    if (!relatedRecord) {
      return null;
    }

    return {
      txHash,
      chainMode: env.chainMode,
      explorerTxUrl: buildExplorerTxUrl(txHash),
      relatedRecord,
      transaction: null,
      receipt: null,
      block: null
    };
  }

  const provider = chainService.getProvider();
  const [transaction, receipt] = await Promise.all([
    provider.getTransaction(txHash),
    provider.getTransactionReceipt(txHash)
  ]);

  if (!transaction && !receipt && !relatedRecord) {
    return null;
  }

  const blockNumber = receipt?.blockNumber ?? transaction?.blockNumber ?? relatedRecord?.block_number ?? null;
  const block = blockNumber != null ? await provider.getBlock(blockNumber) : null;

  return {
    txHash,
    chainMode: env.chainMode,
    explorerTxUrl: buildExplorerTxUrl(txHash),
    relatedRecord,
    transaction: transaction
      ? {
          hash: transaction.hash,
          blockNumber: transaction.blockNumber,
          from: transaction.from,
          to: transaction.to,
          nonce: transaction.nonce,
          type: transaction.type,
          chainId: normalizeBigInt(transaction.chainId),
          gasLimit: normalizeBigInt(transaction.gasLimit),
          gasPrice: normalizeBigInt(transaction.gasPrice),
          maxFeePerGas: normalizeBigInt(transaction.maxFeePerGas),
          maxPriorityFeePerGas: normalizeBigInt(transaction.maxPriorityFeePerGas),
          value: normalizeBigInt(transaction.value),
          data: transaction.data
        }
      : null,
    receipt: receipt
      ? {
          hash: receipt.hash,
          status: receipt.status === 1 ? "success" : "failed",
          blockNumber: receipt.blockNumber,
          from: receipt.from,
          to: receipt.to,
          contractAddress: receipt.contractAddress,
          gasUsed: normalizeBigInt(receipt.gasUsed),
          cumulativeGasUsed: normalizeBigInt(receipt.cumulativeGasUsed),
          effectiveGasPrice: normalizeBigInt(receipt.effectiveGasPrice),
          logsBloom: receipt.logsBloom,
          logs: receipt.logs.map(serializeLog)
        }
      : null,
    block: block
      ? {
          number: block.number,
          hash: block.hash,
          parentHash: block.parentHash,
          timestamp: block.timestamp,
          timestampIso: new Date(Number(block.timestamp) * 1000).toISOString(),
          miner: block.miner,
          gasLimit: normalizeBigInt(block.gasLimit),
          gasUsed: normalizeBigInt(block.gasUsed),
          baseFeePerGas: normalizeBigInt(block.baseFeePerGas)
        }
      : null
  };
}

function buildProjectPayloadForRow(project) {
  return buildProjectPayload({
    projectId: project.id,
    name: project.name,
    targetAmount: project.target_amount,
    startTime: new Date(project.start_time).toISOString(),
    endTime: new Date(project.end_time).toISOString(),
    status: project.status
  });
}

function buildLatestRecordsFromClause() {
  return `
    FROM chain_records cr
    INNER JOIN (
      SELECT business_type, business_id, MAX(id) AS latest_id
      FROM chain_records
      GROUP BY business_type, business_id
    ) latest ON latest.latest_id = cr.id
  `;
}

router.get(
  "/records",
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = parsePagination(req.query);
    const conditions = [];
    const params = [];

    if (req.query.status) {
      conditions.push("status = ?");
      params.push(String(req.query.status));
    }
    if (req.query.businessType) {
      conditions.push("business_type = ?");
      params.push(String(req.query.businessType));
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const fromSql = buildLatestRecordsFromClause();
    const items = await db.query(
      `
        SELECT cr.*
        ${fromSql}
        ${whereSql}
        ORDER BY cr.created_at DESC
        LIMIT ? OFFSET ?
      `,
      [...params, pageSize, offset]
    );
    const enrichedItems = items.map((item) => ({
      ...item,
      explorerTxUrl: buildExplorerTxUrl(item.tx_hash)
    }));
    const totalRow = await db.queryOne(
      `
        SELECT COUNT(*) AS total
        ${fromSql}
        ${whereSql}
      `,
      params
    );

    return success(res, buildPaginatedResult(enrichedItems, totalRow.total, page, pageSize));
  })
);

router.get(
  "/summary",
  asyncHandler(async (_req, res) => {
    const projectStats = await db.queryOne(
      `
        SELECT
          COUNT(*) AS project_count,
          COALESCE(SUM(raised_amount), 0) AS total_raised,
          COALESCE(SUM(disbursed_amount), 0) AS total_disbursed
        FROM projects
      `
    );

    const donationStats = await db.queryOne(
      "SELECT COUNT(*) AS donation_count, COALESCE(SUM(amount), 0) AS total_donation_amount FROM donations"
    );

    const latestRecordsFromSql = buildLatestRecordsFromClause();
    const chainStats = await db.queryOne(
      `
        SELECT
          COUNT(*) AS total_records,
          SUM(CASE WHEN cr.status = 'success' THEN 1 ELSE 0 END) AS success_count,
          SUM(CASE WHEN cr.status != 'success' THEN 1 ELSE 0 END) AS failed_count
        ${latestRecordsFromSql}
      `
    );

    const recentRecords = (
      await db.query(
        `
          SELECT cr.*
          ${latestRecordsFromSql}
          ORDER BY cr.created_at DESC
          LIMIT 6
        `
      )
    ).map((item) => ({
      ...item,
      explorerTxUrl: buildExplorerTxUrl(item.tx_hash)
    }));

    return success(res, {
      ...projectStats,
      ...donationStats,
      ...chainStats,
      ...getPublicChainConfig(),
      recentRecords
    });
  })
);

router.get(
  "/tx/:txHash",
  asyncHandler(async (req, res) => {
    const txHash = String(req.params.txHash || "").trim();
    if (!ethers.isHexString(txHash, 32)) {
      return fail(res, 400, "交易哈希格式不正确");
    }

    const detail = await buildTransactionDetail(txHash);
    if (!detail) {
      return fail(res, 404, "未找到对应交易");
    }

    return success(res, {
      ...detail,
      ...getPublicChainConfig()
    });
  })
);

router.post(
  "/retry/:businessType/:businessId",
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { businessType, businessId } = req.params;
    const retryableTypes = ["project", "donation", "disbursement"];

    if (!retryableTypes.includes(businessType)) {
      return fail(res, 400, "仅支持重试 project、donation、disbursement");
    }

    let receipt = null;
    let recordHash = null;
    let payload = null;

    if (businessType === "project") {
      const project = await db.queryOne("SELECT * FROM projects WHERE id = ?", [businessId]);
      if (!project) {
        return fail(res, 404, "项目不存在");
      }

      payload = buildProjectPayloadForRow(project);
      recordHash = sha256Hex(payload);
      receipt = await chainService.syncProjectProof({ projectId: Number(project.id), projectHash: recordHash });

      await db.run(
        `
          UPDATE projects
          SET chain_hash = ?, chain_status = ?, chain_tx_hash = ?, chain_block_number = ?, updated_at = ?
          WHERE id = ?
        `,
        [recordHash, receipt.status, receipt.txHash, receipt.blockNumber, new Date(), project.id]
      );
    }

    if (businessType === "donation") {
      const donation = await db.queryOne("SELECT * FROM donations WHERE id = ?", [businessId]);
      if (!donation) {
        return fail(res, 404, "捐赠记录不存在");
      }

      payload = buildDonationPayload({
        donationId: donation.id,
        projectId: donation.project_id,
        donorName: donation.is_anonymous ? "ANONYMOUS" : donation.donor_name,
        isAnonymous: Boolean(donation.is_anonymous),
        amount: donation.amount,
        message: donation.message || "",
        donatedAt: new Date(donation.donated_at).toISOString()
      });
      recordHash = sha256Hex(payload);
      receipt = await chainService.ensureDonationProof({
        donationId: Number(donation.id),
        projectId: Number(donation.project_id),
        recordHash,
        amount: Number(donation.amount)
      });

      await db.run(
        `
          UPDATE donations
          SET record_hash = ?, chain_status = ?, tx_hash = ?, block_number = ?, chain_recorded_at = ?
          WHERE id = ?
        `,
        [recordHash, receipt.status, receipt.txHash, receipt.blockNumber, receipt.recordedAt || null, donation.id]
      );
    }

    if (businessType === "disbursement") {
      const disbursement = await db.queryOne("SELECT * FROM disbursements WHERE id = ?", [businessId]);
      if (!disbursement) {
        return fail(res, 404, "拨付记录不存在");
      }

      payload = buildDisbursementPayload({
        disbursementId: disbursement.id,
        projectId: disbursement.project_id,
        amount: disbursement.amount,
        receiver: disbursement.receiver,
        purpose: disbursement.purpose,
        occurredAt: new Date(disbursement.occurred_at).toISOString()
      });
      recordHash = sha256Hex(payload);
      receipt = await chainService.ensureDisbursementProof({
        disbursementId: Number(disbursement.id),
        projectId: Number(disbursement.project_id),
        recordHash,
        amount: Number(disbursement.amount)
      });

      await db.run(
        `
          UPDATE disbursements
          SET record_hash = ?, chain_status = ?, tx_hash = ?, block_number = ?, chain_recorded_at = ?
          WHERE id = ?
        `,
        [recordHash, receipt.status, receipt.txHash, receipt.blockNumber, receipt.recordedAt || null, disbursement.id]
      );
    }

    await db.run(
      `
        INSERT INTO chain_records (
          business_type, business_id, record_hash, tx_hash, block_number, status, payload_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [businessType, businessId, recordHash, receipt.txHash, receipt.blockNumber, receipt.status, JSON.stringify({ payload }), new Date(), new Date()]
    );

    await recordOperation({
      userId: req.user.id,
      username: req.user.username,
      action: "chain_retry",
      businessType,
      businessId: Number(businessId),
      detail: { status: receipt.status }
    });

    return success(res, { businessType, businessId: Number(businessId), status: receipt.status, txHash: receipt.txHash }, "重试完成");
  })
);

module.exports = router;
