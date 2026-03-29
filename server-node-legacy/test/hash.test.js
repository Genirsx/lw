const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildDonationPayload,
  buildDisbursementPayload,
  buildProjectPayload,
  normalizeAmountToCents,
  sha256Hex,
  verifyHash
} = require("../src/utils/hash");

test("normalizeAmountToCents should convert yuan to cents", () => {
  assert.equal(normalizeAmountToCents(12.34), 1234);
});

test("project hash should be stable", () => {
  const payload = buildProjectPayload({
    projectId: 1,
    name: "示例项目",
    targetAmount: 10000,
    startTime: "2026-03-24T00:00:00.000Z",
    endTime: "2026-04-24T00:00:00.000Z",
    status: "active"
  });
  const hash = sha256Hex(payload);

  assert.equal(hash.length, 66);
  assert.equal(verifyHash(payload, hash), true);
});

test("donation and disbursement payloads should include critical fields", () => {
  const donationPayload = buildDonationPayload({
    donationId: 9,
    projectId: 3,
    donorName: "alice",
    isAnonymous: false,
    amount: 5000,
    message: "keep going",
    donatedAt: "2026-03-24T00:00:00.000Z"
  });

  const disbursementPayload = buildDisbursementPayload({
    disbursementId: 5,
    projectId: 3,
    amount: 2000,
    receiver: "某公益组织",
    purpose: "设备采购",
    occurredAt: "2026-03-24T00:00:00.000Z"
  });

  assert.match(donationPayload, /^9\|3\|alice\|5000\|keep going\|2026/);
  assert.match(disbursementPayload, /^5\|3\|2000\|某公益组织\|设备采购\|2026/);
});
