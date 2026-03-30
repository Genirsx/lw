package app

import (
	"database/sql"
	"errors"
	"fmt"
	"log"
	"os"
	"strings"

	_ "github.com/mattn/go-sqlite3"
)

func RunSQLiteToMySQLMigration() error {
	cfg := loadConfig()
	if cfg.DBClient != "mysql" {
		return fmt.Errorf("SQLite -> MySQL 迁移要求 DB_CLIENT=mysql，当前为 %s", cfg.DBClient)
	}

	sourcePath := cfg.resolvedDBPath()
	if _, err := os.Stat(sourcePath); err != nil {
		return fmt.Errorf("未找到 SQLite 源文件 %s: %w", sourcePath, err)
	}

	sourceDB, err := sql.Open("sqlite3", sourcePath)
	if err != nil {
		return err
	}
	defer sourceDB.Close()

	if err := sourceDB.Ping(); err != nil {
		return err
	}

	if err := ensureMySQLDatabase(cfg); err != nil {
		return err
	}

	targetDB, err := sql.Open("mysql", cfg.mysqlDSN(cfg.MySQLDatabase))
	if err != nil {
		return err
	}
	defer targetDB.Close()

	if err := targetDB.Ping(); err != nil {
		return err
	}

	if err := ensureMySQLSchema(targetDB, cfg); err != nil {
		return err
	}
	if err := ensureMySQLTablesEmpty(targetDB); err != nil {
		return err
	}

	tx, err := targetDB.Begin()
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	if _, err := tx.Exec("SET FOREIGN_KEY_CHECKS = 0"); err != nil {
		return err
	}

	counts := map[string]int{}
	if counts["users"], err = migrateUsers(sourceDB, tx); err != nil {
		return err
	}

	adminID, err := findAdminUserID(tx)
	if err != nil {
		return err
	}

	if counts["projects"], err = migrateProjects(sourceDB, tx, adminID); err != nil {
		return err
	}
	if counts["donations"], err = migrateDonations(sourceDB, tx); err != nil {
		return err
	}
	if counts["disbursements"], err = migrateDisbursements(sourceDB, tx); err != nil {
		return err
	}
	if counts["chain_records"], err = migrateChainRecords(sourceDB, tx); err != nil {
		return err
	}
	if counts["operation_logs"], err = migrateOperationLogs(sourceDB, tx); err != nil {
		return err
	}

	if _, err := tx.Exec("SET FOREIGN_KEY_CHECKS = 1"); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}

	if err := ensureDemoUsers(targetDB); err != nil {
		return err
	}

	log.Printf("SQLite -> MySQL 迁移完成，源文件: %s", sourcePath)
	for _, table := range []string{"users", "projects", "donations", "disbursements", "chain_records", "operation_logs"} {
		log.Printf("  - %s: %d rows", table, counts[table])
	}
	return nil
}

func ensureMySQLTablesEmpty(db *sql.DB) error {
	for _, table := range []string{"users", "projects", "donations", "disbursements", "chain_records", "operation_logs"} {
		var count int
		if err := db.QueryRow(`SELECT COUNT(*) FROM ` + mysqlIdentifier(table)).Scan(&count); err != nil {
			return err
		}
		if count > 0 {
			return fmt.Errorf("目标 MySQL 表 %s 已有 %d 条数据，请先清空数据库再迁移", table, count)
		}
	}
	return nil
}

func findAdminUserID(tx *sql.Tx) (sql.NullInt64, error) {
	var id sql.NullInt64
	err := tx.QueryRow(`SELECT id FROM users WHERE email = ? LIMIT 1`, "admin@example.com").Scan(&id)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return sql.NullInt64{}, err
	}
	return id, nil
}

func migrateUsers(sourceDB *sql.DB, tx *sql.Tx) (int, error) {
	rows, err := sourceDB.Query(`SELECT id, username, email, password_hash, role, created_at FROM users ORDER BY id ASC`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	stmt, err := tx.Prepare(`INSERT INTO users (id, username, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
	if err != nil {
		return 0, err
	}
	defer stmt.Close()

	count := 0
	for rows.Next() {
		var id int64
		var username string
		var email string
		var passwordHash string
		var role string
		var createdAt string
		if err := rows.Scan(&id, &username, &email, &passwordHash, &role, &createdAt); err != nil {
			return 0, err
		}
		if _, err := stmt.Exec(id, username, email, passwordHash, role, createdAt); err != nil {
			return 0, err
		}
		count++
	}
	return count, rows.Err()
}

func migrateProjects(sourceDB *sql.DB, tx *sql.Tx, adminID sql.NullInt64) (int, error) {
	hasCreatorID, err := sqliteColumnExists(sourceDB, "projects", "creator_user_id")
	if err != nil {
		return 0, err
	}
	hasApprovalStatus, err := sqliteColumnExists(sourceDB, "projects", "approval_status")
	if err != nil {
		return 0, err
	}
	hasSubmittedAt, err := sqliteColumnExists(sourceDB, "projects", "submitted_at")
	if err != nil {
		return 0, err
	}
	hasApprovedAt, err := sqliteColumnExists(sourceDB, "projects", "approved_at")
	if err != nil {
		return 0, err
	}
	hasApprovedByUserID, err := sqliteColumnExists(sourceDB, "projects", "approved_by_user_id")
	if err != nil {
		return 0, err
	}
	hasReviewNote, err := sqliteColumnExists(sourceDB, "projects", "review_note")
	if err != nil {
		return 0, err
	}

	selectParts := []string{
		"id", "name", "description", "target_amount", "raised_amount", "disbursed_amount", "image_url",
		"start_time", "end_time", "status", "chain_hash", "chain_status", "chain_tx_hash", "chain_block_number",
		"created_at", "updated_at",
	}
	selectParts = append(selectParts, sqliteSelectColumnOrNull("creator_user_id", hasCreatorID))
	selectParts = append(selectParts, sqliteSelectColumnOrNull("approval_status", hasApprovalStatus))
	selectParts = append(selectParts, sqliteSelectColumnOrNull("submitted_at", hasSubmittedAt))
	selectParts = append(selectParts, sqliteSelectColumnOrNull("approved_at", hasApprovedAt))
	selectParts = append(selectParts, sqliteSelectColumnOrNull("approved_by_user_id", hasApprovedByUserID))
	selectParts = append(selectParts, sqliteSelectColumnOrNull("review_note", hasReviewNote))

	query := `SELECT ` + strings.Join(selectParts, ", ") + ` FROM projects ORDER BY id ASC`
	rows, err := sourceDB.Query(query)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	stmt, err := tx.Prepare(`
		INSERT INTO projects (
			id, name, description, target_amount, raised_amount, disbursed_amount, image_url,
			start_time, end_time, status, chain_hash, chain_status, chain_tx_hash, chain_block_number,
			created_at, updated_at, creator_user_id, approval_status, submitted_at, approved_at,
			approved_by_user_id, review_note
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return 0, err
	}
	defer stmt.Close()

	count := 0
	for rows.Next() {
		var (
			id               int64
			name             string
			description      string
			targetAmount     int64
			raisedAmount     int64
			disbursedAmount  int64
			imageURL         sql.NullString
			startTime        string
			endTime          string
			status           string
			chainHash        sql.NullString
			chainStatus      sql.NullString
			chainTxHash      sql.NullString
			chainBlockNumber sql.NullInt64
			createdAt        string
			updatedAt        string
			creatorUserID    sql.NullInt64
			approvalStatus   sql.NullString
			submittedAt      sql.NullString
			approvedAt       sql.NullString
			approvedByUserID sql.NullInt64
			reviewNote       sql.NullString
		)
		if err := rows.Scan(
			&id,
			&name,
			&description,
			&targetAmount,
			&raisedAmount,
			&disbursedAmount,
			&imageURL,
			&startTime,
			&endTime,
			&status,
			&chainHash,
			&chainStatus,
			&chainTxHash,
			&chainBlockNumber,
			&createdAt,
			&updatedAt,
			&creatorUserID,
			&approvalStatus,
			&submittedAt,
			&approvedAt,
			&approvedByUserID,
			&reviewNote,
		); err != nil {
			return 0, err
		}

		if !creatorUserID.Valid && adminID.Valid {
			creatorUserID = adminID
		}
		if !approvalStatus.Valid || strings.TrimSpace(approvalStatus.String) == "" {
			approvalStatus = sql.NullString{String: "approved", Valid: true}
		}
		if !submittedAt.Valid {
			submittedAt = sql.NullString{String: createdAt, Valid: true}
		}
		if approvalStatus.String == "approved" && !approvedAt.Valid {
			approvedAt = sql.NullString{String: updatedAt, Valid: true}
		}
		if approvalStatus.String == "approved" && !approvedByUserID.Valid && adminID.Valid {
			approvedByUserID = adminID
		}
		if !chainStatus.Valid || strings.TrimSpace(chainStatus.String) == "" {
			chainStatus = sql.NullString{String: "pending", Valid: true}
		}

		if _, err := stmt.Exec(
			id,
			name,
			description,
			targetAmount,
			raisedAmount,
			disbursedAmount,
			nullStringValue(imageURL),
			startTime,
			endTime,
			status,
			nullStringValue(chainHash),
			chainStatus.String,
			nullStringValue(chainTxHash),
			nullInt64Value(chainBlockNumber),
			createdAt,
			updatedAt,
			nullInt64Value(creatorUserID),
			approvalStatus.String,
			nullStringValue(submittedAt),
			nullStringValue(approvedAt),
			nullInt64Value(approvedByUserID),
			nullStringValue(reviewNote),
		); err != nil {
			return 0, err
		}
		count++
	}
	return count, rows.Err()
}

func migrateDonations(sourceDB *sql.DB, tx *sql.Tx) (int, error) {
	rows, err := sourceDB.Query(`
		SELECT id, project_id, user_id, donor_name, is_anonymous, amount, message, donated_at,
		       record_hash, chain_status, tx_hash, block_number, chain_recorded_at, created_at
		FROM donations ORDER BY id ASC
	`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	stmt, err := tx.Prepare(`
		INSERT INTO donations (
			id, project_id, user_id, donor_name, is_anonymous, amount, message, donated_at,
			record_hash, chain_status, tx_hash, block_number, chain_recorded_at, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return 0, err
	}
	defer stmt.Close()

	count := 0
	for rows.Next() {
		var (
			id              int64
			projectID       int64
			userID          sql.NullInt64
			donorName       string
			isAnonymous     int
			amount          int64
			message         sql.NullString
			donatedAt       string
			recordHash      sql.NullString
			chainStatus     string
			txHash          sql.NullString
			blockNumber     sql.NullInt64
			chainRecordedAt sql.NullString
			createdAt       string
		)
		if err := rows.Scan(
			&id,
			&projectID,
			&userID,
			&donorName,
			&isAnonymous,
			&amount,
			&message,
			&donatedAt,
			&recordHash,
			&chainStatus,
			&txHash,
			&blockNumber,
			&chainRecordedAt,
			&createdAt,
		); err != nil {
			return 0, err
		}
		if _, err := stmt.Exec(
			id,
			projectID,
			nullInt64Value(userID),
			donorName,
			isAnonymous,
			amount,
			nullStringValue(message),
			donatedAt,
			nullStringValue(recordHash),
			chainStatus,
			nullStringValue(txHash),
			nullInt64Value(blockNumber),
			nullStringValue(chainRecordedAt),
			createdAt,
		); err != nil {
			return 0, err
		}
		count++
	}
	return count, rows.Err()
}

func migrateDisbursements(sourceDB *sql.DB, tx *sql.Tx) (int, error) {
	rows, err := sourceDB.Query(`
		SELECT id, project_id, amount, receiver, purpose, description, occurred_at,
		       record_hash, chain_status, tx_hash, block_number, chain_recorded_at, created_at
		FROM disbursements ORDER BY id ASC
	`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	stmt, err := tx.Prepare(`
		INSERT INTO disbursements (
			id, project_id, amount, receiver, purpose, description, occurred_at,
			record_hash, chain_status, tx_hash, block_number, chain_recorded_at, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return 0, err
	}
	defer stmt.Close()

	count := 0
	for rows.Next() {
		var (
			id              int64
			projectID       int64
			amount          int64
			receiver        string
			purpose         string
			description     sql.NullString
			occurredAt      string
			recordHash      sql.NullString
			chainStatus     string
			txHash          sql.NullString
			blockNumber     sql.NullInt64
			chainRecordedAt sql.NullString
			createdAt       string
		)
		if err := rows.Scan(
			&id,
			&projectID,
			&amount,
			&receiver,
			&purpose,
			&description,
			&occurredAt,
			&recordHash,
			&chainStatus,
			&txHash,
			&blockNumber,
			&chainRecordedAt,
			&createdAt,
		); err != nil {
			return 0, err
		}
		if _, err := stmt.Exec(
			id,
			projectID,
			amount,
			receiver,
			purpose,
			nullStringValue(description),
			occurredAt,
			nullStringValue(recordHash),
			chainStatus,
			nullStringValue(txHash),
			nullInt64Value(blockNumber),
			nullStringValue(chainRecordedAt),
			createdAt,
		); err != nil {
			return 0, err
		}
		count++
	}
	return count, rows.Err()
}

func migrateChainRecords(sourceDB *sql.DB, tx *sql.Tx) (int, error) {
	rows, err := sourceDB.Query(`
		SELECT id, business_type, business_id, record_hash, tx_hash, block_number, status, payload_json, created_at, updated_at
		FROM chain_records ORDER BY id ASC
	`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	stmt, err := tx.Prepare(`
		INSERT INTO chain_records (
			id, business_type, business_id, record_hash, tx_hash, block_number, status, payload_json, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return 0, err
	}
	defer stmt.Close()

	count := 0
	for rows.Next() {
		var (
			id           int64
			businessType string
			businessID   int64
			recordHash   string
			txHash       sql.NullString
			blockNumber  sql.NullInt64
			status       string
			payloadJSON  string
			createdAt    string
			updatedAt    string
		)
		if err := rows.Scan(&id, &businessType, &businessID, &recordHash, &txHash, &blockNumber, &status, &payloadJSON, &createdAt, &updatedAt); err != nil {
			return 0, err
		}
		if _, err := stmt.Exec(id, businessType, businessID, recordHash, nullStringValue(txHash), nullInt64Value(blockNumber), status, payloadJSON, createdAt, updatedAt); err != nil {
			return 0, err
		}
		count++
	}
	return count, rows.Err()
}

func migrateOperationLogs(sourceDB *sql.DB, tx *sql.Tx) (int, error) {
	rows, err := sourceDB.Query(`
		SELECT id, user_id, username, action, business_type, business_id, detail_json, created_at
		FROM operation_logs ORDER BY id ASC
	`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	stmt, err := tx.Prepare(`
		INSERT INTO operation_logs (
			id, user_id, username, action, business_type, business_id, detail_json, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return 0, err
	}
	defer stmt.Close()

	count := 0
	for rows.Next() {
		var (
			id           int64
			userID       int64
			username     string
			action       string
			businessType string
			businessID   int64
			detailJSON   string
			createdAt    string
		)
		if err := rows.Scan(&id, &userID, &username, &action, &businessType, &businessID, &detailJSON, &createdAt); err != nil {
			return 0, err
		}
		if _, err := stmt.Exec(id, userID, username, action, businessType, businessID, detailJSON, createdAt); err != nil {
			return 0, err
		}
		count++
	}
	return count, rows.Err()
}

func sqliteColumnExists(db *sql.DB, table, column string) (bool, error) {
	rows, err := db.Query(fmt.Sprintf("PRAGMA table_info(%s)", table))
	if err != nil {
		return false, err
	}
	defer rows.Close()

	for rows.Next() {
		var cid int
		var name string
		var colType string
		var notNull int
		var defaultValue sql.NullString
		var pk int
		if err := rows.Scan(&cid, &name, &colType, &notNull, &defaultValue, &pk); err != nil {
			return false, err
		}
		if name == column {
			return true, nil
		}
	}
	return false, rows.Err()
}

func sqliteSelectColumnOrNull(column string, exists bool) string {
	if exists {
		return column
	}
	return "NULL AS " + column
}

func nullStringValue(value sql.NullString) interface{} {
	if value.Valid {
		return value.String
	}
	return nil
}

func nullInt64Value(value sql.NullInt64) interface{} {
	if value.Valid {
		return value.Int64
	}
	return nil
}
