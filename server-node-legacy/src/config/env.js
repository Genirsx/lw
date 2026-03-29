const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const env = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || "charity-demo-secret",
  dbClient: (process.env.DB_CLIENT || "sqlite").toLowerCase(),
  dbFile: process.env.DB_FILE || "data/app.db",
  mysqlHost: process.env.MYSQL_HOST || "127.0.0.1",
  mysqlPort: Number(process.env.MYSQL_PORT || 3306),
  mysqlUser: process.env.MYSQL_USER || "root",
  mysqlPassword: process.env.MYSQL_PASSWORD || "",
  mysqlDatabase: process.env.MYSQL_DATABASE || "charity_chain",
  chainMode: (process.env.CHAIN_MODE || "mock").toLowerCase(),
  chainName: process.env.CHAIN_NAME || "Ethereum Sepolia",
  chainId: Number(process.env.CHAIN_ID || 11155111),
  chainCurrencySymbol: process.env.CHAIN_CURRENCY_SYMBOL || "ETH",
  chainExplorerUrl: process.env.CHAIN_EXPLORER_URL || "https://sepolia.etherscan.io",
  rpcUrl: process.env.RPC_URL || "http://127.0.0.1:8545",
  privateKey: process.env.PRIVATE_KEY || "",
  contractAddress: process.env.CONTRACT_ADDRESS || ""
};

module.exports = env;
