const jwt = require("jsonwebtoken");
const env = require("../config/env");
const db = require("../db");
const { fail } = require("../utils/response");

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return fail(res, 401, "未提供有效的认证令牌");
  }

  try {
    const payload = jwt.verify(header.slice(7), env.jwtSecret);
    const user = await db
      .prepare("SELECT id, username, email, role, created_at FROM users WHERE id = ?")
      .get(payload.userId);

    if (!user) {
      return fail(res, 401, "用户不存在或登录已失效");
    }

    req.user = user;
    next();
  } catch (error) {
    return fail(res, 401, "认证失败", error.message);
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return fail(res, 403, "该操作需要管理员权限");
  }

  next();
}

module.exports = { authenticate, requireAdmin };
