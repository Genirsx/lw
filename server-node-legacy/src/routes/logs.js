const express = require("express");
const db = require("../db");
const { authenticate, requireAdmin } = require("../middleware/auth");
const { asyncHandler } = require("../utils/asyncHandler");
const { parsePagination, buildPaginatedResult } = require("../utils/pagination");
const { success } = require("../utils/response");

const router = express.Router();

router.get(
  "/",
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = parsePagination(req.query);

    const logs = await db.query(
      `
        SELECT *
        FROM operation_logs
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `,
      [pageSize, offset]
    );
    const totalRow = await db.queryOne("SELECT COUNT(*) AS total FROM operation_logs");

    return success(res, buildPaginatedResult(logs, totalRow.total, page, pageSize));
  })
);

module.exports = router;
