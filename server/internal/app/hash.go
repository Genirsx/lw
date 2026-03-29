package app

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math"
	"strings"
)

func normalizeAmountToCents(value float64) (int64, error) {
	if math.IsNaN(value) || math.IsInf(value, 0) || value <= 0 {
		return 0, fmt.Errorf("金额必须为大于 0 的数字")
	}
	return int64(math.Round(value * 100)), nil
}

func sha256Hex(payload string) string {
	sum := sha256.Sum256([]byte(payload))
	return "0x" + hex.EncodeToString(sum[:])
}

func buildProjectPayload(projectID int64, name string, targetAmount int64, startTime, endTime, status string) string {
	return strings.Join([]string{
		fmt.Sprintf("%d", projectID),
		strings.TrimSpace(name),
		fmt.Sprintf("%d", targetAmount),
		startTime,
		endTime,
		status,
	}, "|")
}

func buildDonationPayload(donationID, projectID int64, donorName string, isAnonymous bool, amount int64, message, donatedAt string) string {
	if isAnonymous {
		donorName = "ANONYMOUS"
	}
	return strings.Join([]string{
		fmt.Sprintf("%d", donationID),
		fmt.Sprintf("%d", projectID),
		strings.TrimSpace(donorName),
		fmt.Sprintf("%d", amount),
		strings.TrimSpace(message),
		donatedAt,
	}, "|")
}

func buildDisbursementPayload(disbursementID, projectID int64, amount int64, receiver, purpose, occurredAt string) string {
	return strings.Join([]string{
		fmt.Sprintf("%d", disbursementID),
		fmt.Sprintf("%d", projectID),
		fmt.Sprintf("%d", amount),
		strings.TrimSpace(receiver),
		strings.TrimSpace(purpose),
		occurredAt,
	}, "|")
}
