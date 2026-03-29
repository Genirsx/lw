const db = require("../src/db");
const chainService = require("../src/services/chainService");
const {
  buildProjectPayload,
  buildDonationPayload,
  buildDisbursementPayload,
  sha256Hex
} = require("../src/utils/hash");

async function recordChainEntry(businessType, businessId, recordHash, receipt, payload) {
  await db.run(
    `
      INSERT INTO chain_records (
        business_type, business_id, record_hash, tx_hash, block_number, status, payload_json, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      businessType,
      businessId,
      recordHash,
      receipt.txHash,
      receipt.blockNumber,
      receipt.status,
      JSON.stringify({ payload }),
      new Date(),
      new Date()
    ]
  );
}

async function backfillProjects() {
  const projects = await db.query("SELECT * FROM projects ORDER BY id ASC");

  for (const project of projects) {
    const payload = buildProjectPayload({
      projectId: project.id,
      name: project.name,
      targetAmount: project.target_amount,
      startTime: new Date(project.start_time).toISOString(),
      endTime: new Date(project.end_time).toISOString(),
      status: project.status
    });
    const projectHash = sha256Hex(payload);
    const receipt = await chainService.syncProjectProof({
      projectId: Number(project.id),
      projectHash
    });

    await db.run(
      `
        UPDATE projects
        SET chain_hash = ?, chain_status = ?, chain_tx_hash = ?, chain_block_number = ?, updated_at = ?
        WHERE id = ?
      `,
      [projectHash, receipt.status, receipt.txHash, receipt.blockNumber, new Date(), project.id]
    );

    await recordChainEntry("project", project.id, projectHash, receipt, payload);
    console.log(`project#${project.id} -> ${receipt.status} ${receipt.txHash || ""}`.trim());
  }
}

async function backfillDonations() {
  const donations = await db.query("SELECT * FROM donations ORDER BY id ASC");

  for (const donation of donations) {
    const payload = buildDonationPayload({
      donationId: donation.id,
      projectId: donation.project_id,
      donorName: donation.is_anonymous ? "ANONYMOUS" : donation.donor_name,
      isAnonymous: Boolean(donation.is_anonymous),
      amount: donation.amount,
      message: donation.message || "",
      donatedAt: new Date(donation.donated_at).toISOString()
    });
    const recordHash = sha256Hex(payload);
    const receipt = await chainService.ensureDonationProof({
      donationId: Number(donation.id),
      projectId: Number(donation.project_id),
      recordHash,
      amount: Number(donation.amount)
    });

    await db.run(
      `
        UPDATE donations
        SET record_hash = ?, chain_status = ?, tx_hash = ?, block_number = ?, chain_recorded_at = ?
        WHERE id = ?
      `,
      [recordHash, receipt.status, receipt.txHash, receipt.blockNumber, receipt.recordedAt || new Date(), donation.id]
    );

    await recordChainEntry("donation", donation.id, recordHash, receipt, payload);
    console.log(`donation#${donation.id} -> ${receipt.status} ${receipt.txHash || ""}`.trim());
  }
}

async function backfillDisbursements() {
  const disbursements = await db.query("SELECT * FROM disbursements ORDER BY id ASC");

  for (const disbursement of disbursements) {
    const payload = buildDisbursementPayload({
      disbursementId: disbursement.id,
      projectId: disbursement.project_id,
      amount: disbursement.amount,
      receiver: disbursement.receiver,
      purpose: disbursement.purpose,
      occurredAt: new Date(disbursement.occurred_at).toISOString()
    });
    const recordHash = sha256Hex(payload);
    const receipt = await chainService.ensureDisbursementProof({
      disbursementId: Number(disbursement.id),
      projectId: Number(disbursement.project_id),
      recordHash,
      amount: Number(disbursement.amount)
    });

    await db.run(
      `
        UPDATE disbursements
        SET record_hash = ?, chain_status = ?, tx_hash = ?, block_number = ?, chain_recorded_at = ?
        WHERE id = ?
      `,
      [recordHash, receipt.status, receipt.txHash, receipt.blockNumber, receipt.recordedAt || new Date(), disbursement.id]
    );

    await recordChainEntry("disbursement", disbursement.id, recordHash, receipt, payload);
    console.log(`disbursement#${disbursement.id} -> ${receipt.status} ${receipt.txHash || ""}`.trim());
  }
}

async function main() {
  await db.ping();
  await backfillProjects();
  await backfillDonations();
  await backfillDisbursements();
  console.log("Sepolia backfill completed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
