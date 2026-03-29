const db = require("../db");

async function recordOperation({ userId, username, action, businessType, businessId, detail = {} }) {
  await db.run(
    `
      INSERT INTO operation_logs (
        user_id, username, action, business_type, business_id, detail_json, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [userId, username, action, businessType, businessId, JSON.stringify(detail), new Date()]
  );
}

module.exports = { recordOperation };
