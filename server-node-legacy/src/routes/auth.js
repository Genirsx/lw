const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const env = require("../config/env");
const { authenticate } = require("../middleware/auth");
const { asyncHandler } = require("../utils/asyncHandler");
const { success, fail } = require("../utils/response");

const router = express.Router();

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return fail(res, 400, "用户名、邮箱和密码不能为空");
    }

    if (String(password).length < 6) {
      return fail(res, 400, "密码长度不能少于 6 位");
    }

    const existingUser = await db.queryOne("SELECT id FROM users WHERE username = ? OR email = ?", [
      String(username).trim(),
      String(email).trim().toLowerCase()
    ]);

    if (existingUser) {
      return fail(res, 409, "用户名或邮箱已存在");
    }

    const result = await db.run(
      `
        INSERT INTO users (username, email, password_hash, role, created_at)
        VALUES (?, ?, ?, 'user', ?)
      `,
      [
        String(username).trim(),
        String(email).trim().toLowerCase(),
        bcrypt.hashSync(password, 10),
        new Date()
      ]
    );

    return success(
      res,
      {
        id: result.insertId,
        username: String(username).trim(),
        email: String(email).trim().toLowerCase(),
        role: "user"
      },
      "注册成功"
    );
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return fail(res, 400, "邮箱和密码不能为空");
    }

    const user = await db.queryOne(
      "SELECT id, username, email, role, password_hash, created_at FROM users WHERE email = ?",
      [String(email).trim().toLowerCase()]
    );

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return fail(res, 401, "邮箱或密码错误");
    }

    const token = jwt.sign({ userId: user.id }, env.jwtSecret, { expiresIn: "7d" });

    return success(
      res,
      {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          createdAt: user.created_at
        }
      },
      "登录成功"
    );
  })
);

router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => success(res, req.user))
);

module.exports = router;
