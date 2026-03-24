const env = require("../config/env");

function buildExplorerTxUrl(txHash) {
  if (!txHash || !env.chainExplorerUrl) {
    return null;
  }

  return `${env.chainExplorerUrl.replace(/\/$/, "")}/tx/${txHash}`;
}

function getPublicChainConfig() {
  return {
    chainMode: env.chainMode,
    chainName: env.chainName,
    chainId: env.chainId,
    chainCurrencySymbol: env.chainCurrencySymbol,
    explorerBaseUrl: env.chainExplorerUrl,
    contractAddress: env.contractAddress || null
  };
}

module.exports = {
  buildExplorerTxUrl,
  getPublicChainConfig
};
