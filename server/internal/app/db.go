package app

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	mysqlDriver "github.com/go-sql-driver/mysql"
)

type App struct {
	cfg   Config
	db    *sql.DB
	chain *ChainService
}

func openDB(cfg Config) (*sql.DB, error) {
	if cfg.DBClient != "mysql" {
		return nil, fmt.Errorf("当前 Go 版本仅实现 mysql，收到 DB_CLIENT=%s", cfg.DBClient)
	}
	if err := ensureMySQLDatabase(cfg); err != nil {
		return nil, err
	}

	db, err := sql.Open("mysql", cfg.mysqlDSN(cfg.MySQLDatabase))
	if err != nil {
		return nil, err
	}
	db.SetConnMaxLifetime(5 * time.Minute)
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	if err := db.Ping(); err != nil {
		return nil, err
	}
	if err := ensureMySQLSchema(db, cfg); err != nil {
		return nil, err
	}
	if err := ensureDemoUsers(db); err != nil {
		return nil, err
	}
	return db, nil
}

func (c Config) mysqlDSN(dbName string) string {
	driverCfg := mysqlDriver.NewConfig()
	driverCfg.User = c.MySQLUser
	driverCfg.Passwd = c.MySQLPassword
	driverCfg.Net = "tcp"
	driverCfg.Addr = fmt.Sprintf("%s:%d", c.MySQLHost, c.MySQLPort)
	driverCfg.DBName = dbName
	driverCfg.ParseTime = true
	driverCfg.Collation = "utf8mb4_unicode_ci"
	driverCfg.Timeout = 5 * time.Second
	driverCfg.ReadTimeout = 5 * time.Second
	driverCfg.WriteTimeout = 5 * time.Second
	driverCfg.Params = map[string]string{
		"charset": "utf8mb4",
	}
	return driverCfg.FormatDSN()
}

func ensureMySQLDatabase(cfg Config) error {
	rootDB, err := sql.Open("mysql", cfg.mysqlDSN(""))
	if err != nil {
		return err
	}
	defer rootDB.Close()

	if err := rootDB.Ping(); err != nil {
		return err
	}

	_, err = rootDB.Exec("CREATE DATABASE IF NOT EXISTS " + mysqlIdentifier(cfg.MySQLDatabase) + " DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
	return err
}

func ensureMySQLSchema(db *sql.DB, cfg Config) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id BIGINT PRIMARY KEY AUTO_INCREMENT,
			username VARCHAR(64) NOT NULL UNIQUE,
			email VARCHAR(128) NOT NULL UNIQUE,
			password_hash VARCHAR(255) NOT NULL,
			role VARCHAR(32) NOT NULL DEFAULT 'user',
			created_at VARCHAR(32) NOT NULL
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS projects (
			id BIGINT PRIMARY KEY AUTO_INCREMENT,
			name VARCHAR(128) NOT NULL,
			description TEXT NOT NULL,
			target_amount BIGINT NOT NULL,
			raised_amount BIGINT NOT NULL DEFAULT 0,
			disbursed_amount BIGINT NOT NULL DEFAULT 0,
			image_url TEXT NULL,
			start_time VARCHAR(32) NOT NULL,
			end_time VARCHAR(32) NOT NULL,
			status VARCHAR(32) NOT NULL DEFAULT 'draft',
			chain_hash VARCHAR(66) NULL,
			chain_status VARCHAR(32) NOT NULL DEFAULT 'pending',
			chain_tx_hash VARCHAR(66) NULL,
			chain_block_number BIGINT NULL,
			created_at VARCHAR(32) NOT NULL,
			updated_at VARCHAR(32) NOT NULL,
			creator_user_id BIGINT NULL,
			approval_status VARCHAR(32) NOT NULL DEFAULT 'approved',
			submitted_at VARCHAR(32) NULL,
			approved_at VARCHAR(32) NULL,
			approved_by_user_id BIGINT NULL,
			review_note TEXT NULL,
			CONSTRAINT fk_project_creator FOREIGN KEY (creator_user_id) REFERENCES users(id),
			CONSTRAINT fk_project_approver FOREIGN KEY (approved_by_user_id) REFERENCES users(id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS donations (
			id BIGINT PRIMARY KEY AUTO_INCREMENT,
			project_id BIGINT NOT NULL,
			user_id BIGINT NULL,
			donor_name VARCHAR(128) NOT NULL,
			is_anonymous TINYINT(1) NOT NULL DEFAULT 0,
			amount BIGINT NOT NULL,
			message TEXT NULL,
			donated_at VARCHAR(32) NOT NULL,
			record_hash VARCHAR(66) NULL,
			chain_status VARCHAR(32) NOT NULL DEFAULT 'pending',
			tx_hash VARCHAR(66) NULL,
			block_number BIGINT NULL,
			chain_recorded_at VARCHAR(32) NULL,
			created_at VARCHAR(32) NOT NULL,
			CONSTRAINT fk_donation_project FOREIGN KEY (project_id) REFERENCES projects(id),
			CONSTRAINT fk_donation_user FOREIGN KEY (user_id) REFERENCES users(id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS disbursements (
			id BIGINT PRIMARY KEY AUTO_INCREMENT,
			project_id BIGINT NOT NULL,
			amount BIGINT NOT NULL,
			receiver VARCHAR(128) NOT NULL,
			purpose VARCHAR(128) NOT NULL,
			description TEXT NULL,
			occurred_at VARCHAR(32) NOT NULL,
			record_hash VARCHAR(66) NULL,
			chain_status VARCHAR(32) NOT NULL DEFAULT 'pending',
			tx_hash VARCHAR(66) NULL,
			block_number BIGINT NULL,
			chain_recorded_at VARCHAR(32) NULL,
			created_at VARCHAR(32) NOT NULL,
			CONSTRAINT fk_disbursement_project FOREIGN KEY (project_id) REFERENCES projects(id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS chain_records (
			id BIGINT PRIMARY KEY AUTO_INCREMENT,
			business_type VARCHAR(32) NOT NULL,
			business_id BIGINT NOT NULL,
			record_hash VARCHAR(66) NOT NULL,
			tx_hash VARCHAR(66) NULL,
			block_number BIGINT NULL,
			status VARCHAR(32) NOT NULL,
			payload_json LONGTEXT NOT NULL,
			created_at VARCHAR(32) NOT NULL,
			updated_at VARCHAR(32) NOT NULL
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS operation_logs (
			id BIGINT PRIMARY KEY AUTO_INCREMENT,
			user_id BIGINT NOT NULL,
			username VARCHAR(64) NOT NULL,
			action VARCHAR(64) NOT NULL,
			business_type VARCHAR(32) NOT NULL,
			business_id BIGINT NOT NULL,
			detail_json LONGTEXT NOT NULL,
			created_at VARCHAR(32) NOT NULL,
			CONSTRAINT fk_operation_user FOREIGN KEY (user_id) REFERENCES users(id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
	}

	for _, statement := range statements {
		if _, err := db.Exec(statement); err != nil {
			return err
		}
	}

	indexes := []struct {
		table   string
		name    string
		columns string
	}{
		{"projects", "idx_projects_status", "status"},
		{"projects", "idx_projects_approval_status", "approval_status"},
		{"projects", "idx_projects_creator_user_id", "creator_user_id"},
		{"donations", "idx_donations_project_id", "project_id"},
		{"donations", "idx_donations_user_id", "user_id"},
		{"donations", "idx_donations_donated_at", "donated_at"},
		{"disbursements", "idx_disbursements_project_id", "project_id"},
		{"disbursements", "idx_disbursements_occurred_at", "occurred_at"},
		{"chain_records", "idx_chain_records_lookup", "business_type, business_id"},
		{"chain_records", "idx_chain_records_tx_hash", "tx_hash"},
		{"operation_logs", "idx_operation_logs_created_at", "created_at"},
	}
	for _, index := range indexes {
		if err := ensureMySQLIndex(db, cfg.MySQLDatabase, index.table, index.name, index.columns); err != nil {
			return err
		}
	}

	migrations := []struct {
		table      string
		column     string
		definition string
		backfill   string
	}{
		{"projects", "creator_user_id", "BIGINT NULL", ""},
		{"projects", "approval_status", "VARCHAR(32) NOT NULL DEFAULT 'approved'", "UPDATE projects SET approval_status = 'approved' WHERE approval_status IS NULL OR approval_status = ''"},
		{"projects", "submitted_at", "VARCHAR(32) NULL", "UPDATE projects SET submitted_at = created_at WHERE submitted_at IS NULL"},
		{"projects", "approved_at", "VARCHAR(32) NULL", ""},
		{"projects", "approved_by_user_id", "BIGINT NULL", ""},
		{"projects", "review_note", "TEXT NULL", ""},
	}

	for _, migration := range migrations {
		exists, err := mysqlColumnExists(db, cfg.MySQLDatabase, migration.table, migration.column)
		if err != nil {
			return err
		}
		if !exists {
			if _, err := db.Exec(fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", mysqlIdentifier(migration.table), mysqlIdentifier(migration.column), migration.definition)); err != nil {
				return err
			}
		}
		if migration.backfill != "" {
			if _, err := db.Exec(migration.backfill); err != nil {
				return err
			}
		}
	}

	if _, err := db.Exec(`
		UPDATE projects
		SET approved_at = COALESCE(approved_at, updated_at),
		    approved_by_user_id = COALESCE(approved_by_user_id, 1)
		WHERE approval_status = 'approved' AND approved_at IS NULL
	`); err != nil {
		return err
	}

	if _, err := db.Exec(`
		UPDATE projects
		SET creator_user_id = COALESCE(creator_user_id, 1)
		WHERE creator_user_id IS NULL
	`); err != nil {
		return err
	}

	return nil
}

func ensureDemoUsers(db *sql.DB) error {
	demoUsers := []struct {
		username string
		email    string
		password string
		role     string
	}{
		{"admin", "admin@example.com", "Admin123456", "admin"},
		{"donor", "donor@example.com", "Donor123456", "user"},
		{"applicant_demo", "applicant@example.com", "Applicant123456", "applicant"},
	}

	for _, demoUser := range demoUsers {
		var existingID int64
		err := db.QueryRow(`SELECT id FROM users WHERE email = ? LIMIT 1`, demoUser.email).Scan(&existingID)
		if err == nil {
			continue
		}
		if !isNotFound(err) {
			return err
		}

		hash, err := hashPassword(demoUser.password)
		if err != nil {
			return err
		}
		if _, err := db.Exec(
			`INSERT INTO users (username, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)`,
			demoUser.username,
			demoUser.email,
			hash,
			demoUser.role,
			asISO(time.Now()),
		); err != nil {
			return err
		}
	}

	return nil
}

func mysqlColumnExists(db *sql.DB, databaseName, table, column string) (bool, error) {
	var count int
	err := db.QueryRow(
		`SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
		databaseName,
		table,
		column,
	).Scan(&count)
	return count > 0, err
}

func mysqlIdentifier(value string) string {
	return "`" + strings.ReplaceAll(value, "`", "``") + "`"
}

func ensureMySQLIndex(db *sql.DB, databaseName, table, indexName, columns string) error {
	var count int
	if err := db.QueryRow(
		`SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? AND index_name = ?`,
		databaseName,
		table,
		indexName,
	).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	_, err := db.Exec(fmt.Sprintf("CREATE INDEX %s ON %s (%s)", mysqlIdentifier(indexName), mysqlIdentifier(table), columns))
	return err
}

func parseFlexibleTime(value string) (time.Time, error) {
	layouts := []string{
		time.RFC3339,
		"2006-01-02T15:04",
		"2006-01-02 15:04:05",
	}
	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, value); err == nil {
			return parsed, nil
		}
	}
	return time.Time{}, fmt.Errorf("无法解析时间: %s", value)
}

func asISO(t time.Time) string {
	return t.UTC().Format(time.RFC3339)
}

func boolToInt(value bool) int {
	if value {
		return 1
	}
	return 0
}

func parsePagination(r *http.Request) (page, pageSize, offset int) {
	page = maxInt(1, atoiDefault(r.URL.Query().Get("page"), 1))
	pageSize = minInt(50, maxInt(1, atoiDefault(r.URL.Query().Get("pageSize"), 10)))
	offset = (page - 1) * pageSize
	return
}

func buildPaginatedResult(items interface{}, total, page, pageSize int) map[string]interface{} {
	totalPages := 0
	if pageSize > 0 {
		totalPages = (total + pageSize - 1) / pageSize
	}
	return map[string]interface{}{
		"items": items,
		"pagination": map[string]interface{}{
			"page":       page,
			"pageSize":   pageSize,
			"total":      total,
			"totalPages": totalPages,
		},
	}
}

func atoiDefault(value string, fallback int) int {
	var parsed int
	if _, err := fmt.Sscanf(value, "%d", &parsed); err != nil {
		return fallback
	}
	return parsed
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func (a *App) getUserByID(ctx context.Context, id int64) (AuthUser, error) {
	var user AuthUser
	err := a.db.QueryRowContext(
		ctx,
		`SELECT id, username, email, role, created_at FROM users WHERE id = ?`,
		id,
	).Scan(&user.ID, &user.Username, &user.Email, &user.Role, &user.CreatedAt)
	return user, err
}

func (a *App) insertOperationLog(ctx context.Context, user AuthUser, action, businessType string, businessID int64, detailJSON string) error {
	_, err := a.db.ExecContext(
		ctx,
		`INSERT INTO operation_logs (user_id, username, action, business_type, business_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		user.ID,
		user.Username,
		action,
		businessType,
		businessID,
		detailJSON,
		asISO(time.Now()),
	)
	return err
}

func isNotFound(err error) bool {
	return errors.Is(err, sql.ErrNoRows)
}
