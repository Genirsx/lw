package app

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port                int
	JWTSecret           string
	DBClient            string
	DBFile              string
	ChainMode           string
	ChainName           string
	ChainID             int64
	ChainCurrencySymbol string
	ChainExplorerURL    string
	RPCURL              string
	SepoliaRPCURL       string
	PrivateKey          string
	ContractAddress     string
}

func loadConfig() Config {
	_ = godotenv.Load()
	_ = godotenv.Load("../.env")

	cfg := Config{
		Port:                getEnvInt("PORT", 4000),
		JWTSecret:           getEnv("JWT_SECRET", "charity-demo-secret"),
		DBClient:            strings.ToLower(getEnv("DB_CLIENT", "sqlite")),
		DBFile:              getEnv("DB_FILE", "data/app.db"),
		ChainMode:           strings.ToLower(getEnv("CHAIN_MODE", "mock")),
		ChainName:           getEnv("CHAIN_NAME", "Ethereum Sepolia"),
		ChainID:             getEnvInt64("CHAIN_ID", 11155111),
		ChainCurrencySymbol: getEnv("CHAIN_CURRENCY_SYMBOL", "ETH"),
		ChainExplorerURL:    getEnv("CHAIN_EXPLORER_URL", "https://sepolia.etherscan.io"),
		RPCURL:              getEnv("RPC_URL", "http://127.0.0.1:8545"),
		SepoliaRPCURL:       getEnv("SEPOLIA_RPC_URL", ""),
		PrivateKey:          getEnv("PRIVATE_KEY", ""),
		ContractAddress:     getEnv("CONTRACT_ADDRESS", ""),
	}

	if cfg.ChainMode == "local" && cfg.ChainID == 11155111 {
		cfg.ChainID = 31337
	}
	if cfg.ChainMode == "local" && cfg.ChainName == "Ethereum Sepolia" {
		cfg.ChainName = "Hardhat Local"
	}
	return cfg
}

func (c Config) resolvedDBPath() string {
	if filepath.IsAbs(c.DBFile) {
		return c.DBFile
	}
	return filepath.Clean(c.DBFile)
}

func getEnv(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func getEnvInt64(key string, fallback int64) int64 {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		return fallback
	}
	return parsed
}
