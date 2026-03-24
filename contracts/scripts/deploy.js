const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const registry = await hre.ethers.deployContract("CharityDonationRegistry");
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log("CharityDonationRegistry deployed to:", address);

  const outputDir = path.resolve(__dirname, "../deployments");
  fs.mkdirSync(outputDir, { recursive: true });
  const networkName = hre.network.name;
  const outputPath = path.join(outputDir, `${networkName}.json`);

  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        network: networkName,
        chainId: Number(hre.network.config.chainId || 0),
        contractName: "CharityDonationRegistry",
        contractAddress: address,
        deployer: deployer.address,
        deployedAt: new Date().toISOString()
      },
      null,
      2
    )
  );

  console.log("Deployment metadata saved to:", outputPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
