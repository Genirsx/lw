const express = require("express");
const cors = require("cors");
const env = require("./config/env");
require("./db");

const authRoutes = require("./routes/auth");
const projectRoutes = require("./routes/projects");
const donationRoutes = require("./routes/donations");
const disbursementRoutes = require("./routes/disbursements");
const chainRoutes = require("./routes/chain");
const logRoutes = require("./routes/logs");
const db = require("./db");
const { fail } = require("./utils/response");
const { getPublicChainConfig } = require("./utils/chainMeta");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    code: 0,
    message: "ok",
    data: {
      service: "charity-chain-server",
      ...getPublicChainConfig()
    }
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/donations", donationRoutes);
app.use("/api/disbursements", disbursementRoutes);
app.use("/api/chain", chainRoutes);
app.use("/api/logs", logRoutes);

app.use((error, _req, res, _next) => {
  console.error(error);
  return fail(res, 500, "服务器内部错误", error.message);
});

app.use((req, res) => fail(res, 404, `未找到接口: ${req.method} ${req.originalUrl}`));

async function bootstrap() {
  await db.ping();
  app.listen(env.port, () => {
    console.log(`charity-chain server listening on http://localhost:${env.port}`);
  });
}

bootstrap().catch((error) => {
  console.error("failed to start server:", error);
  process.exit(1);
});
