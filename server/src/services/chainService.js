const crypto = require("crypto");
const { ethers } = require("ethers");
const env = require("../config/env");

const contractAbi = [
  "function registerProject(uint256 projectId, bytes32 projectHash)",
  "function updateProjectHash(uint256 projectId, bytes32 projectHash)",
  "function recordDonation(uint256 donationId, uint256 projectId, bytes32 recordHash, uint256 amount)",
  "function recordDisbursement(uint256 disbursementId, uint256 projectId, bytes32 recordHash, uint256 amount)",
  "function getProjectProof(uint256 projectId) view returns (tuple(uint256 projectId,bytes32 projectHash,uint256 createdAt,address operator))",
  "function getDonationProof(uint256 donationId) view returns (tuple(uint256 donationId,uint256 projectId,bytes32 recordHash,uint256 amount,uint256 createdAt,address operator))",
  "function getDisbursementProof(uint256 disbursementId) view returns (tuple(uint256 disbursementId,uint256 projectId,bytes32 recordHash,uint256 amount,uint256 createdAt,address operator))"
];

function createMockReceipt(recordHash) {
  return {
    status: "success",
    txHash: `0x${crypto.createHash("sha256").update(`${recordHash}-${Date.now()}`).digest("hex")}`,
    blockNumber: Math.floor(Date.now() / 1000),
    recordedAt: new Date().toISOString()
  };
}

function getProvider() {
  const rpcUrl = env.chainMode === "sepolia" ? process.env.SEPOLIA_RPC_URL || env.rpcUrl : env.rpcUrl;
  return new ethers.JsonRpcProvider(rpcUrl);
}

function getContract() {
  if (!env.privateKey || !env.contractAddress) {
    throw new Error("缺少 PRIVATE_KEY 或 CONTRACT_ADDRESS，无法执行真实链上写入");
  }

  const wallet = new ethers.Wallet(env.privateKey, getProvider());
  return new ethers.Contract(env.contractAddress, contractAbi, wallet);
}

async function sendTransaction(executor) {
  if (env.chainMode === "mock") {
    return createMockReceipt(crypto.randomUUID());
  }

  const tx = await executor(getContract());
  const receipt = await tx.wait();

  return {
    status: receipt.status === 1 ? "success" : "failed",
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    recordedAt: new Date().toISOString()
  };
}

async function registerProject({ projectId, projectHash }) {
  if (env.chainMode === "mock") {
    return createMockReceipt(projectHash);
  }

  return sendTransaction((contract) => contract.registerProject(projectId, projectHash));
}

async function updateProjectHash({ projectId, projectHash }) {
  if (env.chainMode === "mock") {
    return createMockReceipt(projectHash);
  }

  return sendTransaction((contract) => contract.updateProjectHash(projectId, projectHash));
}

async function recordDonation({ donationId, projectId, recordHash, amount }) {
  if (env.chainMode === "mock") {
    return createMockReceipt(recordHash);
  }

  return sendTransaction((contract) => contract.recordDonation(donationId, projectId, recordHash, amount));
}

async function recordDisbursement({ disbursementId, projectId, recordHash, amount }) {
  if (env.chainMode === "mock") {
    return createMockReceipt(recordHash);
  }

  return sendTransaction((contract) =>
    contract.recordDisbursement(disbursementId, projectId, recordHash, amount)
  );
}

async function getDonationProof(donationId) {
  if (env.chainMode === "mock") {
    return null;
  }

  const provider = getProvider();
  const contract = new ethers.Contract(env.contractAddress, contractAbi, provider);
  return contract.getDonationProof(donationId);
}

async function getProjectProof(projectId) {
  if (env.chainMode === "mock") {
    return null;
  }

  const provider = getProvider();
  const contract = new ethers.Contract(env.contractAddress, contractAbi, provider);
  return contract.getProjectProof(projectId);
}

async function getDisbursementProof(disbursementId) {
  if (env.chainMode === "mock") {
    return null;
  }

  const provider = getProvider();
  const contract = new ethers.Contract(env.contractAddress, contractAbi, provider);
  return contract.getDisbursementProof(disbursementId);
}

async function syncProjectProof({ projectId, projectHash }) {
  if (env.chainMode === "mock") {
    return createMockReceipt(projectHash);
  }

  const proof = await getProjectProof(projectId);
  if (proof && Number(proof.projectId) !== 0) {
    return updateProjectHash({ projectId, projectHash });
  }

  return registerProject({ projectId, projectHash });
}

async function ensureDonationProof({ donationId, projectId, recordHash, amount }) {
  if (env.chainMode === "mock") {
    return createMockReceipt(recordHash);
  }

  const proof = await getDonationProof(donationId);
  if (proof && Number(proof.donationId) !== 0) {
    if (proof.recordHash === recordHash) {
      return {
        status: "success",
        txHash: null,
        blockNumber: null,
        recordedAt: new Date().toISOString()
      };
    }
    throw new Error("链上已存在相同 donationId 的不同哈希记录");
  }

  return recordDonation({ donationId, projectId, recordHash, amount });
}

async function ensureDisbursementProof({ disbursementId, projectId, recordHash, amount }) {
  if (env.chainMode === "mock") {
    return createMockReceipt(recordHash);
  }

  const proof = await getDisbursementProof(disbursementId);
  if (proof && Number(proof.disbursementId) !== 0) {
    if (proof.recordHash === recordHash) {
      return {
        status: "success",
        txHash: null,
        blockNumber: null,
        recordedAt: new Date().toISOString()
      };
    }
    throw new Error("链上已存在相同 disbursementId 的不同哈希记录");
  }

  return recordDisbursement({ disbursementId, projectId, recordHash, amount });
}

module.exports = {
  registerProject,
  updateProjectHash,
  syncProjectProof,
  recordDonation,
  recordDisbursement,
  ensureDonationProof,
  ensureDisbursementProof,
  getProjectProof,
  getDonationProof,
  getDisbursementProof
};
