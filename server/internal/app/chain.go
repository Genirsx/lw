package app

import (
	"context"
	"crypto/ecdsa"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"
	"time"

	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

const contractABI = `[
  {"inputs":[{"internalType":"uint256","name":"projectId","type":"uint256"},{"internalType":"bytes32","name":"projectHash","type":"bytes32"}],"name":"registerProject","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"projectId","type":"uint256"},{"internalType":"bytes32","name":"projectHash","type":"bytes32"}],"name":"updateProjectHash","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"donationId","type":"uint256"},{"internalType":"uint256","name":"projectId","type":"uint256"},{"internalType":"bytes32","name":"recordHash","type":"bytes32"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"recordDonation","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"disbursementId","type":"uint256"},{"internalType":"uint256","name":"projectId","type":"uint256"},{"internalType":"bytes32","name":"recordHash","type":"bytes32"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"recordDisbursement","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"projectId","type":"uint256"}],"name":"getProjectProof","outputs":[{"components":[{"internalType":"uint256","name":"projectId","type":"uint256"},{"internalType":"bytes32","name":"projectHash","type":"bytes32"},{"internalType":"uint256","name":"createdAt","type":"uint256"},{"internalType":"address","name":"operator","type":"address"}],"internalType":"struct CharityDonationRegistry.ProjectProof","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"donationId","type":"uint256"}],"name":"getDonationProof","outputs":[{"components":[{"internalType":"uint256","name":"donationId","type":"uint256"},{"internalType":"uint256","name":"projectId","type":"uint256"},{"internalType":"bytes32","name":"recordHash","type":"bytes32"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint256","name":"createdAt","type":"uint256"},{"internalType":"address","name":"operator","type":"address"}],"internalType":"struct CharityDonationRegistry.DonationProof","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"disbursementId","type":"uint256"}],"name":"getDisbursementProof","outputs":[{"components":[{"internalType":"uint256","name":"disbursementId","type":"uint256"},{"internalType":"uint256","name":"projectId","type":"uint256"},{"internalType":"bytes32","name":"recordHash","type":"bytes32"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint256","name":"createdAt","type":"uint256"},{"internalType":"address","name":"operator","type":"address"}],"internalType":"struct CharityDonationRegistry.DisbursementProof","name":"","type":"tuple"}],"stateMutability":"view","type":"function"}
]`

type ChainService struct {
	cfg        Config
	parsedABI  abi.ABI
	contract   common.Address
	privateKey *ecdsa.PrivateKey
}

type ChainReceipt struct {
	Status     string `json:"status"`
	TxHash     string `json:"txHash"`
	BlockNum   int64  `json:"blockNumber"`
	RecordedAt string `json:"recordedAt"`
}

type ProofRecord struct {
	ID         int64
	ProjectID  int64
	RecordHash string
	Amount     int64
}

type projectProofOut struct {
	ProjectID   *big.Int       `abi:"projectId"`
	ProjectHash [32]byte       `abi:"projectHash"`
	CreatedAt   *big.Int       `abi:"createdAt"`
	Operator    common.Address `abi:"operator"`
}

type donationProofOut struct {
	DonationID *big.Int       `abi:"donationId"`
	ProjectID  *big.Int       `abi:"projectId"`
	RecordHash [32]byte       `abi:"recordHash"`
	Amount     *big.Int       `abi:"amount"`
	CreatedAt  *big.Int       `abi:"createdAt"`
	Operator   common.Address `abi:"operator"`
}

type disbursementProofOut struct {
	DisbursementID *big.Int       `abi:"disbursementId"`
	ProjectID      *big.Int       `abi:"projectId"`
	RecordHash     [32]byte       `abi:"recordHash"`
	Amount         *big.Int       `abi:"amount"`
	CreatedAt      *big.Int       `abi:"createdAt"`
	Operator       common.Address `abi:"operator"`
}

func newChainService(cfg Config) (*ChainService, error) {
	parsed, err := abi.JSON(strings.NewReader(contractABI))
	if err != nil {
		return nil, err
	}
	service := &ChainService{
		cfg:       cfg,
		parsedABI: parsed,
	}
	if cfg.ContractAddress != "" {
		service.contract = common.HexToAddress(cfg.ContractAddress)
	}
	if cfg.PrivateKey != "" {
		key, err := crypto.HexToECDSA(strings.TrimPrefix(cfg.PrivateKey, "0x"))
		if err != nil {
			return nil, err
		}
		service.privateKey = key
	}
	return service, nil
}

func (c *ChainService) getRPCURL() string {
	if c.cfg.ChainMode == "sepolia" && c.cfg.SepoliaRPCURL != "" {
		return c.cfg.SepoliaRPCURL
	}
	return c.cfg.RPCURL
}

func (c *ChainService) newClient(ctx context.Context) (*ethclient.Client, error) {
	return ethclient.DialContext(ctx, c.getRPCURL())
}

func (c *ChainService) createMockReceipt(recordHash string) (ChainReceipt, error) {
	random := make([]byte, 32)
	if _, err := rand.Read(random); err != nil {
		return ChainReceipt{}, err
	}
	txHash := "0x" + hex.EncodeToString(random)
	if recordHash != "" {
		txHash = sha256Hex(recordHash + time.Now().UTC().Format(time.RFC3339Nano))
	}
	return ChainReceipt{
		Status:     "success",
		TxHash:     txHash,
		BlockNum:   time.Now().Unix(),
		RecordedAt: asISO(time.Now()),
	}, nil
}

func hexToBytes32(value string) [32]byte {
	return common.HexToHash(value)
}

func bytes32ToHex(value interface{}) string {
	switch typed := value.(type) {
	case [32]byte:
		return common.BytesToHash(typed[:]).Hex()
	case common.Hash:
		return typed.Hex()
	default:
		return ""
	}
}

func bigToInt64(value interface{}) int64 {
	if v, ok := value.(*big.Int); ok && v != nil {
		return v.Int64()
	}
	return 0
}

func (c *ChainService) transact(ctx context.Context, method string, params ...interface{}) (ChainReceipt, error) {
	if c.cfg.ChainMode == "mock" {
		return c.createMockReceipt("")
	}
	client, err := c.newClient(ctx)
	if err != nil {
		return ChainReceipt{}, err
	}
	defer client.Close()

	if c.privateKey == nil || c.contract == (common.Address{}) {
		return ChainReceipt{}, fmt.Errorf("缺少 PRIVATE_KEY 或 CONTRACT_ADDRESS，无法执行真实链上写入")
	}

	chainID, err := client.ChainID(ctx)
	if err != nil {
		return ChainReceipt{}, err
	}
	auth, err := bind.NewKeyedTransactorWithChainID(c.privateKey, chainID)
	if err != nil {
		return ChainReceipt{}, err
	}
	auth.Context = ctx
	contract := bind.NewBoundContract(c.contract, c.parsedABI, client, client, client)
	tx, err := contract.Transact(auth, method, params...)
	if err != nil {
		return ChainReceipt{}, err
	}
	receipt, err := bind.WaitMined(ctx, client, tx)
	if err != nil {
		return ChainReceipt{}, err
	}
	status := "failed"
	if receipt.Status == types.ReceiptStatusSuccessful {
		status = "success"
	}
	return ChainReceipt{
		Status:     status,
		TxHash:     tx.Hash().Hex(),
		BlockNum:   receipt.BlockNumber.Int64(),
		RecordedAt: asISO(time.Now()),
	}, nil
}

func (c *ChainService) callProof(ctx context.Context, method string, id int64) (ProofRecord, error) {
	if c.cfg.ChainMode == "mock" {
		return ProofRecord{}, nil
	}
	client, err := c.newClient(ctx)
	if err != nil {
		return ProofRecord{}, err
	}
	defer client.Close()

	input, err := c.parsedABI.Pack(method, big.NewInt(id))
	if err != nil {
		return ProofRecord{}, err
	}
	output, err := client.CallContract(ctx, ethereum.CallMsg{
		To:   &c.contract,
		Data: input,
	}, nil)
	if err != nil {
		return ProofRecord{}, err
	}

	switch method {
	case "getProjectProof":
		var decoded projectProofOut
		if err := c.parsedABI.UnpackIntoInterface(&decoded, method, output); err != nil {
			return ProofRecord{}, err
		}
		return ProofRecord{
			ID:         bigToInt64(decoded.ProjectID),
			ProjectID:  bigToInt64(decoded.ProjectID),
			RecordHash: bytes32ToHex(decoded.ProjectHash),
		}, nil
	case "getDonationProof":
		var decoded donationProofOut
		if err := c.parsedABI.UnpackIntoInterface(&decoded, method, output); err != nil {
			return ProofRecord{}, err
		}
		return ProofRecord{
			ID:         bigToInt64(decoded.DonationID),
			ProjectID:  bigToInt64(decoded.ProjectID),
			RecordHash: bytes32ToHex(decoded.RecordHash),
			Amount:     bigToInt64(decoded.Amount),
		}, nil
	case "getDisbursementProof":
		var decoded disbursementProofOut
		if err := c.parsedABI.UnpackIntoInterface(&decoded, method, output); err != nil {
			return ProofRecord{}, err
		}
		return ProofRecord{
			ID:         bigToInt64(decoded.DisbursementID),
			ProjectID:  bigToInt64(decoded.ProjectID),
			RecordHash: bytes32ToHex(decoded.RecordHash),
			Amount:     bigToInt64(decoded.Amount),
		}, nil
	default:
		return ProofRecord{}, nil
	}
}

func (c *ChainService) syncProjectProof(ctx context.Context, projectID int64, projectHash string) (ChainReceipt, error) {
	if c.cfg.ChainMode == "mock" {
		return c.createMockReceipt(projectHash)
	}
	proof, err := c.callProof(ctx, "getProjectProof", projectID)
	if err == nil && proof.ID != 0 {
		return c.transact(ctx, "updateProjectHash", big.NewInt(projectID), hexToBytes32(projectHash))
	}
	return c.transact(ctx, "registerProject", big.NewInt(projectID), hexToBytes32(projectHash))
}

func (c *ChainService) recordDonation(ctx context.Context, donationID, projectID int64, recordHash string, amount int64) (ChainReceipt, error) {
	if c.cfg.ChainMode == "mock" {
		return c.createMockReceipt(recordHash)
	}
	return c.transact(ctx, "recordDonation", big.NewInt(donationID), big.NewInt(projectID), hexToBytes32(recordHash), big.NewInt(amount))
}

func (c *ChainService) recordDisbursement(ctx context.Context, disbursementID, projectID int64, recordHash string, amount int64) (ChainReceipt, error) {
	if c.cfg.ChainMode == "mock" {
		return c.createMockReceipt(recordHash)
	}
	return c.transact(ctx, "recordDisbursement", big.NewInt(disbursementID), big.NewInt(projectID), hexToBytes32(recordHash), big.NewInt(amount))
}

func (c *ChainService) ensureDonationProof(ctx context.Context, donationID, projectID int64, recordHash string, amount int64) (ChainReceipt, error) {
	if c.cfg.ChainMode == "mock" {
		return c.createMockReceipt(recordHash)
	}
	proof, err := c.callProof(ctx, "getDonationProof", donationID)
	if err == nil && proof.ID != 0 {
		if strings.EqualFold(proof.RecordHash, recordHash) {
			return ChainReceipt{Status: "success", RecordedAt: asISO(time.Now())}, nil
		}
		return ChainReceipt{}, fmt.Errorf("链上已存在相同 donationId 的不同哈希记录")
	}
	return c.recordDonation(ctx, donationID, projectID, recordHash, amount)
}

func (c *ChainService) ensureDisbursementProof(ctx context.Context, disbursementID, projectID int64, recordHash string, amount int64) (ChainReceipt, error) {
	if c.cfg.ChainMode == "mock" {
		return c.createMockReceipt(recordHash)
	}
	proof, err := c.callProof(ctx, "getDisbursementProof", disbursementID)
	if err == nil && proof.ID != 0 {
		if strings.EqualFold(proof.RecordHash, recordHash) {
			return ChainReceipt{Status: "success", RecordedAt: asISO(time.Now())}, nil
		}
		return ChainReceipt{}, fmt.Errorf("链上已存在相同 disbursementId 的不同哈希记录")
	}
	return c.recordDisbursement(ctx, disbursementID, projectID, recordHash, amount)
}

func (c *ChainService) getProjectProof(ctx context.Context, projectID int64) (ProofRecord, error) {
	return c.callProof(ctx, "getProjectProof", projectID)
}

func (c *ChainService) getDonationProof(ctx context.Context, donationID int64) (ProofRecord, error) {
	return c.callProof(ctx, "getDonationProof", donationID)
}

func (c *ChainService) getDisbursementProof(ctx context.Context, disbursementID int64) (ProofRecord, error) {
	return c.callProof(ctx, "getDisbursementProof", disbursementID)
}

func (c *ChainService) buildExplorerTxURL(txHash string) interface{} {
	if c.cfg.ChainMode != "sepolia" || strings.TrimSpace(txHash) == "" || strings.TrimSpace(c.cfg.ChainExplorerURL) == "" {
		return nil
	}
	return strings.TrimRight(c.cfg.ChainExplorerURL, "/") + "/tx/" + txHash
}

func (c *ChainService) publicConfig() map[string]interface{} {
	explorerBase := interface{}(nil)
	if c.cfg.ChainMode == "sepolia" && c.cfg.ChainExplorerURL != "" {
		explorerBase = c.cfg.ChainExplorerURL
	}
	contractAddr := interface{}(nil)
	if c.cfg.ContractAddress != "" {
		contractAddr = c.cfg.ContractAddress
	}
	return map[string]interface{}{
		"chainMode":           c.cfg.ChainMode,
		"chainName":           c.cfg.ChainName,
		"chainId":             c.cfg.ChainID,
		"chainCurrencySymbol": c.cfg.ChainCurrencySymbol,
		"explorerBaseUrl":     explorerBase,
		"contractAddress":     contractAddr,
	}
}
