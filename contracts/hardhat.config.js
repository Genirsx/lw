require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "../.env" });

const sepoliaUrl =
  process.env.SEPOLIA_RPC_URL ||
  (process.env.INFURA_API_KEY ? `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}` : "");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
  networks: {
    hardhat: {},
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    sepolia: {
      url: sepoliaUrl,
      chainId: 11155111,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  }
};
