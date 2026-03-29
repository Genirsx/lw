package app

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

type App struct {
	cfg   Config
	db    *sql.DB
	chain *ChainService
}

func openDB(cfg Config) (*sql.DB, error) {
	if cfg.DBClient != "sqlite" {
		return nil, fmt.Errorf("当前 Go 版本仅实现 sqlite，收到 DB_CLIENT=%s", cfg.DBClient)
	}
	db, err := sql.Open("sqlite3", cfg.resolvedDBPath())
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	if err := db.Ping(); err != nil {
		return nil, err
	}
	if err := ensureSQLiteMigrations(db); err != nil {
		return nil, err
	}
	if err := ensureDemoUsers(db); err != nil {
		return nil, err
	}
	return db, nil
}

func ensureSQLiteMigrations(db *sql.DB) error {
	migrations := []struct {
		table      string
		column     string
		definition string
		backfill   string
	}{
		{"projects", "creator_user_id", "INTEGER", ""},
		{"projects", "approval_status", "TEXT NOT NULL DEFAULT 'approved'", "UPDATE projects SET approval_status = 'approved' WHERE approval_status IS NULL OR approval_status = ''"},
		{"projects", "submitted_at", "TEXT", "UPDATE projects SET submitted_at = created_at WHERE submitted_at IS NULL"},
		{"projects", "approved_at", "TEXT", ""},
		{"projects", "approved_by_user_id", "INTEGER", ""},
		{"projects", "review_note", "TEXT", ""},
	}

	for _, migration := range migrations {
		exists, err := sqliteColumnExists(db, migration.table, migration.column)
		if err != nil {
			return err
		}
		if !exists {
			if _, err := db.Exec(fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", migration.table, migration.column, migration.definition)); err != nil {
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

func sqliteColumnExists(db *sql.DB, table, column string) (bool, error) {
	rows, err := db.Query(fmt.Sprintf("PRAGMA table_info(%s)", table))
	if err != nil {
		return false, err
	}
	defer rows.Close()

	for rows.Next() {
		var cid int
		var name, colType string
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
