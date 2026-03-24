const crypto = require("crypto");

function normalizeAmountToCents(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error("金额必须为大于 0 的数字");
  }

  return Math.round(numeric * 100);
}

function sha256Hex(payload) {
  return `0x${crypto.createHash("sha256").update(payload).digest("hex")}`;
}

function buildProjectPayload(project) {
  return [
    project.projectId,
    project.name.trim(),
    project.targetAmount,
    project.startTime,
    project.endTime,
    project.status
  ].join("|");
}

function buildDonationPayload(donation) {
  return [
    donation.donationId,
    donation.projectId,
    donation.isAnonymous ? "ANONYMOUS" : donation.donorName.trim(),
    donation.amount,
    donation.message ? donation.message.trim() : "",
    donation.donatedAt
  ].join("|");
}

function buildDisbursementPayload(disbursement) {
  return [
    disbursement.disbursementId,
    disbursement.projectId,
    disbursement.amount,
    disbursement.receiver.trim(),
    disbursement.purpose.trim(),
    disbursement.occurredAt
  ].join("|");
}

function verifyHash(payload, hash) {
  return sha256Hex(payload) === hash;
}

module.exports = {
  normalizeAmountToCents,
  sha256Hex,
  buildProjectPayload,
  buildDonationPayload,
  buildDisbursementPayload,
  verifyHash
};
