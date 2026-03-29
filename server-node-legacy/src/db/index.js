const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const env = require("../config/env");

function normalizeParams(params = []) {
  return params.map((param) => (param instanceof Date ? param.toISOString() : param));
}

function resolveDbFilePath() {
  if (path.isAbsolute(env.dbFile)) {
    return env.dbFile;
  }

  return path.resolve(__dirname, "../../", env.dbFile);
}

function initializeSqliteSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      target_amount INTEGER NOT NULL,
      raised_amount INTEGER NOT NULL DEFAULT 0,
      disbursed_amount INTEGER NOT NULL DEFAULT 0,
      image_url TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      chain_hash TEXT,
      chain_status TEXT NOT NULL DEFAULT 'pending',
      chain_tx_hash TEXT,
      chain_block_number INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS donations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      user_id INTEGER,
      donor_name TEXT NOT NULL,
      is_anonymous INTEGER NOT NULL DEFAULT 0,
      amount INTEGER NOT NULL,
      message TEXT,
      donated_at TEXT NOT NULL,
      record_hash TEXT,
      chain_status TEXT NOT NULL DEFAULT 'pending',
      tx_hash TEXT,
      block_number INTEGER,
      chain_recorded_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS disbursements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      receiver TEXT NOT NULL,
      purpose TEXT NOT NULL,
      description TEXT,
      occurred_at TEXT NOT NULL,
      record_hash TEXT,
      chain_status TEXT NOT NULL DEFAULT 'pending',
      tx_hash TEXT,
      block_number INTEGER,
      chain_recorded_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS chain_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_type TEXT NOT NULL,
      business_id INTEGER NOT NULL,
      record_hash TEXT NOT NULL,
      tx_hash TEXT,
      block_number INTEGER,
      status TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      action TEXT NOT NULL,
      business_type TEXT NOT NULL,
      business_id INTEGER NOT NULL,
      detail_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
}

function seedSqlite(db) {
  const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
  if (!userCount) {
    const now = new Date().toISOString();
    db.prepare(
      `
        INSERT INTO users (username, email, password_hash, role, created_at)
        VALUES (?, ?, ?, ?, ?)
      `
    ).run("admin", "admin@example.com", bcrypt.hashSync("Admin123456", 10), "admin", now);

    db.prepare(
      `
        INSERT INTO users (username, email, password_hash, role, created_at)
        VALUES (?, ?, ?, ?, ?)
      `
    ).run("donor", "donor@example.com", bcrypt.hashSync("Donor123456", 10), "user", now);
  }

  const projectCount = db.prepare("SELECT COUNT(*) AS count FROM projects").get().count;
  if (!projectCount) {
    const now = new Date().toISOString();
    const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    const sixtyDaysLater = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString();

    db.prepare(
      `
        INSERT INTO projects (
          name, description, target_amount, raised_amount, disbursed_amount, image_url,
          start_time, end_time, status, chain_status, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      "乡村儿童数字教室计划",
      "为偏远地区学校建设数字教室，补充投影设备、平板终端和网络条件。",
      3000000,
      850000,
      260000,
      "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=80",
      now,
      thirtyDaysLater,
      "active",
      "seeded",
      now,
      now
    );

    db.prepare(
      `
        INSERT INTO projects (
          name, description, target_amount, raised_amount, disbursed_amount, image_url,
          start_time, end_time, status, chain_status, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      "山区母婴健康包公益项目",
      "向山区困难家庭发放基础母婴健康包，并建立阶段性回访记录。",
      1800000,
      420000,
      120000,
      "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1200&q=80",
      now,
      sixtyDaysLater,
      "active",
      "seeded",
      now,
      now
    );
  }
}

function createSqliteClient() {
  const dbPath = resolveDbFilePath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");

  initializeSqliteSchema(sqlite);
  seedSqlite(sqlite);

  return {
    pool: null,
    prepare(sql) {
      return {
        async get(...params) {
          return sqlite.prepare(sql).get(...normalizeParams(params)) || null;
        },
        async all(...params) {
          return sqlite.prepare(sql).all(...normalizeParams(params));
        },
        async run(...params) {
          const result = sqlite.prepare(sql).run(...normalizeParams(params));
          return {
            lastInsertRowid: result.lastInsertRowid,
            changes: result.changes
          };
        }
      };
    },
    async query(sql, params = []) {
      return sqlite.prepare(sql).all(...normalizeParams(params));
    },
    async queryOne(sql, params = []) {
      return sqlite.prepare(sql).get(...normalizeParams(params)) || null;
    },
    async run(sql, params = []) {
      const result = sqlite.prepare(sql).run(...normalizeParams(params));
      return {
        insertId: result.lastInsertRowid,
        affectedRows: result.changes
      };
    },
    async ping() {
      sqlite.prepare("SELECT 1").get();
    }
  };
}

function createMysqlClient() {
  const pool = mysql.createPool({
    host: env.mysqlHost,
    port: env.mysqlPort,
    user: env.mysqlUser,
    password: env.mysqlPassword,
    database: env.mysqlDatabase,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  return {
    pool,
    prepare(sql) {
      return {
        async get(...params) {
          const [rows] = await pool.execute(sql, normalizeParams(params));
          return rows[0] || null;
        },
        async all(...params) {
          const [rows] = await pool.execute(sql, normalizeParams(params));
          return rows;
        },
        async run(...params) {
          const [result] = await pool.execute(sql, normalizeParams(params));
          return {
            lastInsertRowid: result.insertId,
            changes: result.affectedRows
          };
        }
      };
    },
    async query(sql, params = []) {
      const [rows] = await pool.execute(sql, normalizeParams(params));
      return rows;
    },
    async queryOne(sql, params = []) {
      const [rows] = await pool.execute(sql, normalizeParams(params));
      return rows[0] || null;
    },
    async run(sql, params = []) {
      const [result] = await pool.execute(sql, normalizeParams(params));
      return {
        insertId: result.insertId,
        affectedRows: result.affectedRows
      };
    },
    async ping() {
      await pool.query("SELECT 1");
    }
  };
}

module.exports = env.dbClient === "mysql" ? createMysqlClient() : createSqliteClient();
