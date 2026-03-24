const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const env = require("../src/config/env");

async function main() {
  if (env.dbClient !== "mysql") {
    const db = require("../src/db");
    await db.ping();
    console.log(`SQLite initialized at: ${env.dbFile}`);
    return;
  }

  const connection = await mysql.createConnection({
    host: env.mysqlHost,
    port: env.mysqlPort,
    user: env.mysqlUser,
    password: env.mysqlPassword,
    multipleStatements: true
  });

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${env.mysqlDatabase}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.query(`USE \`${env.mysqlDatabase}\``);

  const schemaSql = fs.readFileSync(path.resolve(__dirname, "../sql/schema.sql"), "utf8");
  const seedSql = fs.readFileSync(path.resolve(__dirname, "../sql/seed.sql"), "utf8");

  await connection.query(schemaSql);
  await connection.query(seedSql);
  await connection.end();

  console.log(`MySQL initialized for database: ${env.mysqlDatabase}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
