const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CharityDonationRegistry", function () {
  async function deployFixture() {
    const [owner, operator, stranger] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("CharityDonationRegistry");
    const contract = await factory.deploy();
    await contract.waitForDeployment();

    return { contract, owner, operator, stranger };
  }

  it("allows owner to register a project", async function () {
    const { contract, owner } = await deployFixture();
    const hash = ethers.keccak256(ethers.toUtf8Bytes("project-1"));

    await expect(contract.connect(owner).registerProject(1, hash))
      .to.emit(contract, "ProjectRegistered")
      .withArgs(1, hash, owner.address);

    const proof = await contract.getProjectProof(1);
    expect(proof.projectId).to.equal(1n);
    expect(proof.projectHash).to.equal(hash);
  });

  it("allows owner to update an existing project hash", async function () {
    const { contract, owner } = await deployFixture();
    const initialHash = ethers.keccak256(ethers.toUtf8Bytes("project-1"));
    const nextHash = ethers.keccak256(ethers.toUtf8Bytes("project-1-updated"));

    await contract.connect(owner).registerProject(1, initialHash);
    await expect(contract.connect(owner).updateProjectHash(1, nextHash))
      .to.emit(contract, "ProjectUpdated")
      .withArgs(1, nextHash, owner.address);

    const proof = await contract.getProjectProof(1);
    expect(proof.projectHash).to.equal(nextHash);
  });

  it("allows authorized operator to record donation and disbursement", async function () {
    const { contract, owner, operator } = await deployFixture();
    await contract.connect(owner).setOperator(operator.address, true);
    const projectHash = ethers.keccak256(ethers.toUtf8Bytes("project-1"));
    await contract.connect(owner).registerProject(1, projectHash);

    const donationHash = ethers.keccak256(ethers.toUtf8Bytes("donation-1"));
    const disbursementHash = ethers.keccak256(ethers.toUtf8Bytes("disbursement-1"));

    await contract.connect(operator).recordDonation(1, 1, donationHash, 5000);
    await contract.connect(operator).recordDisbursement(1, 1, disbursementHash, 2000);

    const donationProof = await contract.getDonationProof(1);
    const disbursementProof = await contract.getDisbursementProof(1);

    expect(donationProof.recordHash).to.equal(donationHash);
    expect(disbursementProof.recordHash).to.equal(disbursementHash);
  });

  it("rejects unauthorized writes", async function () {
    const { contract, stranger } = await deployFixture();
    const hash = ethers.keccak256(ethers.toUtf8Bytes("donation-2"));

    await expect(contract.connect(stranger).recordDonation(2, 1, hash, 1000)).to.be.revertedWithCustomError(
      contract,
      "Unauthorized"
    );
  });

  it("rejects duplicate business ids", async function () {
    const { contract } = await deployFixture();
    const projectHash = ethers.keccak256(ethers.toUtf8Bytes("project-3"));
    await contract.registerProject(1, projectHash);
    const hash = ethers.keccak256(ethers.toUtf8Bytes("donation-3"));

    await contract.recordDonation(3, 1, hash, 1000);

    await expect(contract.recordDonation(3, 1, hash, 1000)).to.be.revertedWithCustomError(
      contract,
      "DonationAlreadyExists"
    );
  });

  it("rejects donations and disbursements for unknown projects", async function () {
    const { contract } = await deployFixture();
    const donationHash = ethers.keccak256(ethers.toUtf8Bytes("donation-unknown"));
    const disbursementHash = ethers.keccak256(ethers.toUtf8Bytes("disbursement-unknown"));

    await expect(contract.recordDonation(10, 99, donationHash, 1000)).to.be.revertedWithCustomError(
      contract,
      "InvalidProjectReference"
    );

    await expect(contract.recordDisbursement(10, 99, disbursementHash, 1000)).to.be.revertedWithCustomError(
      contract,
      "InvalidProjectReference"
    );
  });
});
