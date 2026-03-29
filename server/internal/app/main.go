package app

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
)

type projectRow struct {
	ID               int64   `json:"id"`
	Name             string  `json:"name"`
	Description      string  `json:"description"`
	TargetAmount     float64 `json:"target_amount"`
	RaisedAmount     float64 `json:"raised_amount"`
	DisbursedAmount  float64 `json:"disbursed_amount"`
	ImageURL         string  `json:"image_url"`
	StartTime        string  `json:"start_time"`
	EndTime          string  `json:"end_time"`
	Status           string  `json:"status"`
	ChainHash        string  `json:"chain_hash"`
	ChainStatus      string  `json:"chain_status"`
	ChainTxHash      string  `json:"chain_tx_hash"`
	ChainBlockNumber *int64  `json:"chain_block_number"`
	CreatedAt        string  `json:"created_at"`
	UpdatedAt        string  `json:"updated_at"`
	DonationCount    int64   `json:"donation_count,omitempty"`
	CreatorUserID    *int64  `json:"creator_user_id,omitempty"`
	CreatorUsername  *string `json:"creator_username,omitempty"`
	ApprovalStatus   string  `json:"approval_status"`
	SubmittedAt      *string `json:"submitted_at,omitempty"`
	ApprovedAt       *string `json:"approved_at,omitempty"`
	ApprovedByUserID *int64  `json:"approved_by_user_id,omitempty"`
	ApprovedByName   *string `json:"approved_by_name,omitempty"`
	ReviewNote       *string `json:"review_note,omitempty"`
}

type donationRow struct {
	ID              int64   `json:"id"`
	ProjectID       int64   `json:"project_id"`
	UserID          *int64  `json:"user_id"`
	DonorName       string  `json:"donor_name"`
	IsAnonymous     int     `json:"is_anonymous"`
	Amount          float64 `json:"amount"`
	Message         string  `json:"message"`
	DonatedAt       string  `json:"donated_at"`
	RecordHash      string  `json:"record_hash"`
	ChainStatus     string  `json:"chain_status"`
	TxHash          *string `json:"tx_hash"`
	BlockNumber     *int64  `json:"block_number"`
	ChainRecordedAt *string `json:"chain_recorded_at"`
	CreatedAt       string  `json:"created_at"`
	ProjectName     string  `json:"project_name,omitempty"`
}

type disbursementRow struct {
	ID              int64   `json:"id"`
	ProjectID       int64   `json:"project_id"`
	Amount          float64 `json:"amount"`
	Receiver        string  `json:"receiver"`
	Purpose         string  `json:"purpose"`
	Description     string  `json:"description"`
	OccurredAt      string  `json:"occurred_at"`
	RecordHash      string  `json:"record_hash"`
	ChainStatus     string  `json:"chain_status"`
	TxHash          *string `json:"tx_hash"`
	BlockNumber     *int64  `json:"block_number"`
	ChainRecordedAt *string `json:"chain_recorded_at"`
	CreatedAt       string  `json:"created_at"`
}

type chainRecordRow struct {
	ID            int64       `json:"id"`
	BusinessType  string      `json:"business_type"`
	BusinessID    int64       `json:"business_id"`
	RecordHash    string      `json:"record_hash"`
	TxHash        *string     `json:"tx_hash"`
	BlockNumber   *int64      `json:"block_number"`
	Status        string      `json:"status"`
	PayloadJSON   string      `json:"payload_json"`
	CreatedAt     string      `json:"created_at"`
	UpdatedAt     string      `json:"updated_at"`
	ExplorerTxURL interface{} `json:"explorerTxUrl"`
}

type operationLogRow struct {
	ID           int64  `json:"id"`
	UserID       int64  `json:"user_id"`
	Username     string `json:"username"`
	Action       string `json:"action"`
	BusinessType string `json:"business_type"`
	BusinessID   int64  `json:"business_id"`
	DetailJSON   string `json:"detail_json"`
	CreatedAt    string `json:"created_at"`
}

type projectScanner interface {
	Scan(dest ...interface{}) error
}

func scanProject(scanner projectScanner, item *projectRow) error {
	var chainHash sql.NullString
	var chainStatus sql.NullString
	var chainTxHash sql.NullString
	var chainBlockNumber sql.NullInt64
	var creatorUserID sql.NullInt64
	var creatorUsername sql.NullString
	var approvalStatus sql.NullString
	var submittedAt sql.NullString
	var approvedAt sql.NullString
	var approvedByUserID sql.NullInt64
	var approvedByName sql.NullString
	var reviewNote sql.NullString

	if err := scanner.Scan(
		&item.ID,
		&item.Name,
		&item.Description,
		&item.TargetAmount,
		&item.RaisedAmount,
		&item.DisbursedAmount,
		&item.ImageURL,
		&item.StartTime,
		&item.EndTime,
		&item.Status,
		&chainHash,
		&chainStatus,
		&chainTxHash,
		&chainBlockNumber,
		&item.CreatedAt,
		&item.UpdatedAt,
		&item.DonationCount,
		&creatorUserID,
		&creatorUsername,
		&approvalStatus,
		&submittedAt,
		&approvedAt,
		&approvedByUserID,
		&approvedByName,
		&reviewNote,
	); err != nil {
		return err
	}

	item.ChainHash = chainHash.String
	item.ChainStatus = chainStatus.String
	item.ChainTxHash = chainTxHash.String
	if chainBlockNumber.Valid {
		value := chainBlockNumber.Int64
		item.ChainBlockNumber = &value
	}
	if creatorUserID.Valid {
		value := creatorUserID.Int64
		item.CreatorUserID = &value
	}
	if creatorUsername.Valid {
		value := creatorUsername.String
		item.CreatorUsername = &value
	}
	item.ApprovalStatus = approvalStatus.String
	if item.ApprovalStatus == "" {
		item.ApprovalStatus = "pending"
	}
	if submittedAt.Valid {
		value := submittedAt.String
		item.SubmittedAt = &value
	}
	if approvedAt.Valid {
		value := approvedAt.String
		item.ApprovedAt = &value
	}
	if approvedByUserID.Valid {
		value := approvedByUserID.Int64
		item.ApprovedByUserID = &value
	}
	if approvedByName.Valid {
		value := approvedByName.String
		item.ApprovedByName = &value
	}
	if reviewNote.Valid {
		value := reviewNote.String
		item.ReviewNote = &value
	}
	return nil
}

func scanProjectNoDonationCount(scanner projectScanner, item *projectRow) error {
	var chainHash sql.NullString
	var chainStatus sql.NullString
	var chainTxHash sql.NullString
	var chainBlockNumber sql.NullInt64
	var creatorUserID sql.NullInt64
	var creatorUsername sql.NullString
	var approvalStatus sql.NullString
	var submittedAt sql.NullString
	var approvedAt sql.NullString
	var approvedByUserID sql.NullInt64
	var approvedByName sql.NullString
	var reviewNote sql.NullString

	if err := scanner.Scan(
		&item.ID,
		&item.Name,
		&item.Description,
		&item.TargetAmount,
		&item.RaisedAmount,
		&item.DisbursedAmount,
		&item.ImageURL,
		&item.StartTime,
		&item.EndTime,
		&item.Status,
		&chainHash,
		&chainStatus,
		&chainTxHash,
		&chainBlockNumber,
		&item.CreatedAt,
		&item.UpdatedAt,
		&creatorUserID,
		&creatorUsername,
		&approvalStatus,
		&submittedAt,
		&approvedAt,
		&approvedByUserID,
		&approvedByName,
		&reviewNote,
	); err != nil {
		return err
	}

	item.ChainHash = chainHash.String
	item.ChainStatus = chainStatus.String
	item.ChainTxHash = chainTxHash.String
	if chainBlockNumber.Valid {
		value := chainBlockNumber.Int64
		item.ChainBlockNumber = &value
	}
	if creatorUserID.Valid {
		value := creatorUserID.Int64
		item.CreatorUserID = &value
	}
	if creatorUsername.Valid {
		value := creatorUsername.String
		item.CreatorUsername = &value
	}
	item.ApprovalStatus = approvalStatus.String
	if item.ApprovalStatus == "" {
		item.ApprovalStatus = "pending"
	}
	if submittedAt.Valid {
		value := submittedAt.String
		item.SubmittedAt = &value
	}
	if approvedAt.Valid {
		value := approvedAt.String
		item.ApprovedAt = &value
	}
	if approvedByUserID.Valid {
		value := approvedByUserID.Int64
		item.ApprovedByUserID = &value
	}
	if approvedByName.Valid {
		value := approvedByName.String
		item.ApprovedByName = &value
	}
	if reviewNote.Valid {
		value := reviewNote.String
		item.ReviewNote = &value
	}
	return nil
}

func Run() error {
	cfg := loadConfig()
	db, err := openDB(cfg)
	if err != nil {
		return err
	}
	defer db.Close()

	chain, err := newChainService(cfg)
	if err != nil {
		return err
	}

	app := &App{cfg: cfg, db: db, chain: chain}
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/health", app.handleHealth)
	mux.HandleFunc("POST /api/auth/register", app.handleRegister)
	mux.HandleFunc("POST /api/auth/login", app.handleLogin)
	mux.HandleFunc("GET /api/auth/me", app.authenticate(app.handleMe))

	mux.HandleFunc("GET /api/projects", app.handleProjectsList)
	mux.HandleFunc("GET /api/projects/{id}", app.handleProjectDetail)
	mux.HandleFunc("GET /api/projects/my-applications", app.authenticate(requireApplicant(app.handleMyProjectApplications)))
	mux.HandleFunc("POST /api/projects/applications", app.authenticate(requireApplicant(app.handleProjectApplicationCreate)))
	mux.HandleFunc("GET /api/projects/admin/list", app.authenticate(requireAdmin(app.handleProjectsAdminList)))
	mux.HandleFunc("POST /api/projects", app.authenticate(requireAdmin(app.handleProjectCreate)))
	mux.HandleFunc("PUT /api/projects/{id}", app.authenticate(requireAdmin(app.handleProjectUpdate)))
	mux.HandleFunc("PATCH /api/projects/{id}/status", app.authenticate(requireAdmin(app.handleProjectStatusUpdate)))
	mux.HandleFunc("PATCH /api/projects/{id}/review", app.authenticate(requireAdmin(app.handleProjectReview)))

	mux.HandleFunc("GET /api/donations", app.handleDonationsList)
	mux.HandleFunc("GET /api/donations/my", app.authenticate(app.handleMyDonations))
	mux.HandleFunc("POST /api/donations", app.authenticate(app.handleDonationCreate))
	mux.HandleFunc("GET /api/donations/{id}/verify", app.handleDonationVerify)

	mux.HandleFunc("GET /api/disbursements/", app.handleDisbursementRoutes)
	mux.HandleFunc("POST /api/disbursements", app.authenticate(requireAdmin(app.handleDisbursementCreate)))

	mux.HandleFunc("GET /api/logs", app.authenticate(requireAdmin(app.handleLogs)))

	mux.HandleFunc("GET /api/chain/summary", app.handleChainSummary)
	mux.HandleFunc("GET /api/chain/records", app.authenticate(requireAdmin(app.handleChainRecords)))
	mux.HandleFunc("GET /api/chain/tx/{txHash}", app.handleChainTxDetail)
	mux.HandleFunc("POST /api/chain/retry/{businessType}/{businessId}", app.authenticate(requireAdmin(app.handleChainRetry)))

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		mux.ServeHTTP(w, r)
	})

	addr := fmt.Sprintf(":%d", cfg.Port)
	log.Printf("go charity server listening on http://localhost%s", addr)
	return http.ListenAndServe(addr, handler)
}

func (a *App) handleHealth(w http.ResponseWriter, _ *http.Request) {
	data := map[string]interface{}{
		"service": "charity-chain-go-server",
	}
	for k, v := range a.chain.publicConfig() {
		data[k] = v
	}
	success(w, data, "ok")
}

func (a *App) handleRegister(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Password string `json:"password"`
		Role     string `json:"role"`
	}
	if err := decodeJSON(r, &input); err != nil {
		fail(w, http.StatusBadRequest, "请求体格式错误", err.Error())
		return
	}
	input.Username = strings.TrimSpace(input.Username)
	input.Email = strings.ToLower(strings.TrimSpace(input.Email))
	input.Role = strings.ToLower(strings.TrimSpace(input.Role))
	if input.Role == "" {
		input.Role = "user"
	}
	if input.Username == "" || input.Email == "" || input.Password == "" {
		fail(w, http.StatusBadRequest, "用户名、邮箱和密码不能为空", nil)
		return
	}
	if input.Role != "user" && input.Role != "applicant" {
		fail(w, http.StatusBadRequest, "角色必须为 user 或 applicant", nil)
		return
	}
	if len(input.Password) < 6 {
		fail(w, http.StatusBadRequest, "密码长度不能少于 6 位", nil)
		return
	}
	var existingID int64
	err := a.db.QueryRowContext(r.Context(), `SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1`, input.Username, input.Email).Scan(&existingID)
	if err == nil {
		fail(w, http.StatusConflict, "用户名或邮箱已存在", nil)
		return
	}
	if err != nil && !isNotFound(err) {
		fail(w, http.StatusInternalServerError, "服务器内部错误", err.Error())
		return
	}
	hash, err := hashPassword(input.Password)
	if err != nil {
		fail(w, http.StatusInternalServerError, "服务器内部错误", err.Error())
		return
	}
	result, err := a.db.ExecContext(r.Context(), `INSERT INTO users (username, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)`, input.Username, input.Email, hash, input.Role, asISO(time.Now()))
	if err != nil {
		fail(w, http.StatusInternalServerError, "服务器内部错误", err.Error())
		return
	}
	id, _ := result.LastInsertId()
	success(w, map[string]interface{}{"id": id, "username": input.Username, "email": input.Email, "role": input.Role}, "注册成功")
}

func (a *App) handleLogin(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := decodeJSON(r, &input); err != nil {
		fail(w, http.StatusBadRequest, "请求体格式错误", err.Error())
		return
	}
	input.Email = strings.ToLower(strings.TrimSpace(input.Email))
	if input.Email == "" || input.Password == "" {
		fail(w, http.StatusBadRequest, "邮箱和密码不能为空", nil)
		return
	}
	var passwordHash string
	user := AuthUser{}
	err := a.db.QueryRowContext(r.Context(), `SELECT id, username, email, role, password_hash, created_at FROM users WHERE email = ?`, input.Email).
		Scan(&user.ID, &user.Username, &user.Email, &user.Role, &passwordHash, &user.CreatedAt)
	if err != nil || !comparePassword(passwordHash, input.Password) {
		fail(w, http.StatusUnauthorized, "邮箱或密码错误", nil)
		return
	}
	token, err := a.createToken(user.ID)
	if err != nil {
		fail(w, http.StatusInternalServerError, "服务器内部错误", err.Error())
		return
	}
	success(w, map[string]interface{}{"token": token, "user": user}, "登录成功")
}

func (a *App) handleMe(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r.Context())
	success(w, user, "ok")
}

func (a *App) handleProjectsList(w http.ResponseWriter, r *http.Request) {
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	query := `
		SELECT p.id, p.name, p.description, p.target_amount, p.raised_amount, p.disbursed_amount, p.image_url, p.start_time, p.end_time, p.status, p.chain_hash, p.chain_status, p.chain_tx_hash, p.chain_block_number, p.created_at, p.updated_at, COUNT(DISTINCT d.id) AS donation_count,
		       p.creator_user_id, u.username, p.approval_status, p.submitted_at, p.approved_at, p.approved_by_user_id, approver.username, p.review_note
		FROM projects p
		LEFT JOIN users u ON u.id = p.creator_user_id
		LEFT JOIN users approver ON approver.id = p.approved_by_user_id
		LEFT JOIN donations d ON d.project_id = p.id
	`
	args := []interface{}{"approved"}
	conditions := []string{"p.approval_status = ?"}
	if status != "" {
		conditions = append(conditions, "p.status = ?")
		args = append(args, status)
	}
	query += ` WHERE ` + strings.Join(conditions, " AND ")
	query += ` GROUP BY p.id ORDER BY p.created_at DESC`
	rows, err := a.db.QueryContext(r.Context(), query, args...)
	if err != nil {
		fail(w, http.StatusInternalServerError, "服务器内部错误", err.Error())
		return
	}
	defer rows.Close()
	items := []projectRow{}
	for rows.Next() {
		var item projectRow
		if err := scanProject(rows, &item); err != nil {
			fail(w, http.StatusInternalServerError, "服务器内部错误", err.Error())
			return
		}
		items = append(items, item)
	}
	success(w, items, "ok")
}

func (a *App) handleProjectsAdminList(w http.ResponseWriter, r *http.Request) {
	page, pageSize, offset := parsePagination(r)
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	approvalStatus := strings.TrimSpace(r.URL.Query().Get("approvalStatus"))
	keyword := strings.TrimSpace(r.URL.Query().Get("keyword"))
	conditions := []string{}
	args := []interface{}{}
	if status != "" {
		conditions = append(conditions, "status = ?")
		args = append(args, status)
	}
	if approvalStatus != "" {
		conditions = append(conditions, "approval_status = ?")
		args = append(args, approvalStatus)
	}
	if keyword != "" {
		conditions = append(conditions, "(name LIKE ? OR description LIKE ?)")
		like := "%" + keyword + "%"
		args = append(args, like, like)
	}
	where := ""
	if len(conditions) > 0 {
		where = " WHERE " + strings.Join(conditions, " AND ")
	}
	query := `
		SELECT p.id, p.name, p.description, p.target_amount, p.raised_amount, p.disbursed_amount, p.image_url, p.start_time, p.end_time, p.status, p.chain_hash, p.chain_status, p.chain_tx_hash, p.chain_block_number, p.created_at, p.updated_at,
		       p.creator_user_id, creator.username, p.approval_status, p.submitted_at, p.approved_at, p.approved_by_user_id, approver.username, p.review_note
		FROM projects p
		LEFT JOIN users creator ON creator.id = p.creator_user_id
		LEFT JOIN users approver ON approver.id = p.approved_by_user_id
	` + where + ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`
	rows, err := a.db.QueryContext(r.Context(), query, append(args, pageSize, offset)...)
	if err != nil {
		fail(w, http.StatusInternalServerError, "服务器内部错误", err.Error())
		return
	}
	defer rows.Close()
	items := []projectRow{}
	for rows.Next() {
		var item projectRow
		if err := scanProjectNoDonationCount(rows, &item); err != nil {
			fail(w, http.StatusInternalServerError, "服务器内部错误", err.Error())
			return
		}
		items = append(items, item)
	}
	total := 0
	if err := a.db.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM projects`+where, args...).Scan(&total); err != nil {
		fail(w, http.StatusInternalServerError, "服务器内部错误", err.Error())
		return
	}
	success(w, buildPaginatedResult(items, total, page, pageSize), "ok")
}

func (a *App) getProjectByID(ctx context.Context, id int64) (projectRow, error) {
	var item projectRow
	row := a.db.QueryRowContext(ctx, `
		SELECT p.id, p.name, p.description, p.target_amount, p.raised_amount, p.disbursed_amount, p.image_url, p.start_time, p.end_time, p.status, p.chain_hash, p.chain_status, p.chain_tx_hash, p.chain_block_number, p.created_at, p.updated_at,
		       p.creator_user_id, creator.username, p.approval_status, p.submitted_at, p.approved_at, p.approved_by_user_id, approver.username, p.review_note
		FROM projects p
		LEFT JOIN users creator ON creator.id = p.creator_user_id
		LEFT JOIN users approver ON approver.id = p.approved_by_user_id
		WHERE p.id = ?
	`, id)
	err := scanProjectNoDonationCount(row, &item)
	return item, err
}

func (a *App) handleProjectDetail(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
	project, err := a.getProjectByID(r.Context(), id)
	if err != nil {
		fail(w, http.StatusNotFound, "项目不存在", nil)
		return
	}
	if project.ApprovalStatus != "approved" {
		user, ok := currentUser(r.Context())
		creatorID := int64(0)
		if project.CreatorUserID != nil {
			creatorID = *project.CreatorUserID
		}
		if !ok || (user.Role != "admin" && user.ID != creatorID) {
			fail(w, http.StatusNotFound, "项目不存在", nil)
			return
		}
	}
	donations := []donationRow{}
	dRows, err := a.db.QueryContext(r.Context(), `SELECT id, project_id, user_id, donor_name, is_anonymous, amount, message, donated_at, record_hash, chain_status, tx_hash, block_number, chain_recorded_at, created_at FROM donations WHERE project_id = ? ORDER BY donated_at DESC LIMIT 20`, id)
	if err == nil {
		defer dRows.Close()
		for dRows.Next() {
			var item donationRow
			_ = dRows.Scan(&item.ID, &item.ProjectID, &item.UserID, &item.DonorName, &item.IsAnonymous, &item.Amount, &item.Message, &item.DonatedAt, &item.RecordHash, &item.ChainStatus, &item.TxHash, &item.BlockNumber, &item.ChainRecordedAt, &item.CreatedAt)
			donations = append(donations, item)
		}
	}
	disbursements := []disbursementRow{}
	xRows, err := a.db.QueryContext(r.Context(), `SELECT id, project_id, amount, receiver, purpose, description, occurred_at, record_hash, chain_status, tx_hash, block_number, chain_recorded_at, created_at FROM disbursements WHERE project_id = ? ORDER BY occurred_at DESC LIMIT 20`, id)
	if err == nil {
		defer xRows.Close()
		for xRows.Next() {
			var item disbursementRow
			_ = xRows.Scan(&item.ID, &item.ProjectID, &item.Amount, &item.Receiver, &item.Purpose, &item.Description, &item.OccurredAt, &item.RecordHash, &item.ChainStatus, &item.TxHash, &item.BlockNumber, &item.ChainRecordedAt, &item.CreatedAt)
			disbursements = append(disbursements, item)
		}
	}
	success(w, map[string]interface{}{"project": project, "donations": donations, "disbursements": disbursements}, "ok")
}

func (a *App) handleMyDonations(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r.Context())
	page, pageSize, offset := parsePagination(r)
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	query := `SELECT d.id, d.project_id, d.user_id, d.donor_name, d.is_anonymous, d.amount, d.message, d.donated_at, d.record_hash, d.chain_status, d.tx_hash, d.block_number, d.chain_recorded_at, d.created_at, p.name AS project_name FROM donations d JOIN projects p ON p.id = d.project_id WHERE d.user_id = ?`
	args := []interface{}{user.ID}
	if status != "" {
		query += ` AND d.chain_status = ?`
		args = append(args, status)
	}
	query += ` ORDER BY d.donated_at DESC LIMIT ? OFFSET ?`
	args = append(args, pageSize, offset)
	rows, err := a.db.QueryContext(r.Context(), query, args...)
	if err != nil {
		fail(w, http.StatusInternalServerError, "服务器内部错误", err.Error())
		return
	}
	defer rows.Close()
	items := []donationRow{}
	for rows.Next() {
		var item donationRow
		if err := rows.Scan(&item.ID, &item.ProjectID, &item.UserID, &item.DonorName, &item.IsAnonymous, &item.Amount, &item.Message, &item.DonatedAt, &item.RecordHash, &item.ChainStatus, &item.TxHash, &item.BlockNumber, &item.ChainRecordedAt, &item.CreatedAt, &item.ProjectName); err != nil {
			fail(w, http.StatusInternalServerError, "服务器内部错误", err.Error())
			return
		}
		items = append(items, item)
	}
	var total int
	countQuery := `SELECT COUNT(*) FROM donations d WHERE d.user_id = ?`
	countArgs := []interface{}{user.ID}
	if status != "" {
		countQuery += ` AND d.chain_status = ?`
		countArgs = append(countArgs, status)
	}
	if err := a.db.QueryRowContext(r.Context(), countQuery, countArgs...).Scan(&total); err != nil {
		fail(w, http.StatusInternalServerError, "服务器内部错误", err.Error())
		return
	}
	success(w, buildPaginatedResult(items, total, page, pageSize), "ok")
}

func (a *App) handleDonationsList(w http.ResponseWriter, r *http.Request) {
	page, pageSize, offset := parsePagination(r)
	conditions := []string{}
	args := []interface{}{}
	if projectID := strings.TrimSpace(r.URL.Query().Get("projectId")); projectID != "" {
		conditions = append(conditions, "d.project_id = ?")
		args = append(args, projectID)
	}
	if status := strings.TrimSpace(r.URL.Query().Get("status")); status != "" {
		conditions = append(conditions, "d.chain_status = ?")
		args = append(args, status)
	}
	if startDate := strings.TrimSpace(r.URL.Query().Get("startDate")); startDate != "" {
		conditions = append(conditions, "d.donated_at >= ?")
		args = append(args, startDate)
	}
	if endDate := strings.TrimSpace(r.URL.Query().Get("endDate")); endDate != "" {
		conditions = append(conditions, "d.donated_at <= ?")
		args = append(args, endDate)
	}
	where := ""
	if len(conditions) > 0 {
		where = " WHERE " + strings.Join(conditions, " AND ")
	}
	query := `SELECT d.id, d.project_id, d.user_id, d.donor_name, d.is_anonymous, d.amount, d.message, d.donated_at, d.record_hash, d.chain_status, d.tx_hash, d.block_number, d.chain_recorded_at, d.created_at, p.name AS project_name FROM donations d JOIN projects p ON p.id = d.project_id` + where + ` ORDER BY d.donated_at DESC LIMIT ? OFFSET ?`
	rows, err := a.db.QueryContext(r.Context(), query, append(args, pageSize, offset)...)
	if err != nil {
		fail(w, http.StatusInternalServerError, "服务器内部错误", err.Error())
		return
	}
	defer rows.Close()
	items := []donationRow{}
	for rows.Next() {
		var item donationRow
		if err := rows.Scan(&item.ID, &item.ProjectID, &item.UserID, &item.DonorName, &item.IsAnonymous, &item.Amount, &item.Message, &item.DonatedAt, &item.RecordHash, &item.ChainStatus, &item.TxHash, &item.BlockNumber, &item.ChainRecordedAt, &item.CreatedAt, &item.ProjectName); err != nil {
			fail(w, http.StatusInternalServerError, "服务器内部错误", err.Error())
			return
		}
		items = append(items, item)
	}
	var total int
	if err := a.db.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM donations d JOIN projects p ON p.id = d.project_id`+where, args...).Scan(&total); err != nil {
		fail(w, http.StatusInternalServerError, "服务器内部错误", err.Error())
		return
	}
	success(w, buildPaginatedResult(items, total, page, pageSize), "ok")
}

func (a *App) insertChainRecord(ctx context.Context, businessType string, businessID int64, recordHash string, receipt ChainReceipt, payloadJSON string) error {
	_, err := a.db.ExecContext(ctx, `INSERT INTO chain_records (business_type, business_id, record_hash, tx_hash, block_number, status, payload_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		businessType, businessID, recordHash, nullableString(receipt.TxHash), nullableInt64(receipt.BlockNum), receipt.Status, payloadJSON, asISO(time.Now()), asISO(time.Now()))
	return err
}

func nullableString(value string) interface{} {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return value
}

func nullableInt64(value int64) interface{} {
	if value == 0 {
		return nil
	}
	return value
}

func (a *App) handleDonationCreate(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r.Context())
	var input struct {
		ProjectID   int64   `json:"projectId"`
		DonorName   string  `json:"donorName"`
		Amount      float64 `json:"amount"`
		Message     string  `json:"message"`
		DonatedAt   string  `json:"donatedAt"`
		IsAnonymous bool    `json:"isAnonymous"`
	}
	if err := decodeJSON(r, &input); err != nil {
		fail(w, http.StatusBadRequest, "请求体格式错误", err.Error())
		return
	}
	if input.ProjectID == 0 || input.Amount == 0 {
		fail(w, http.StatusBadRequest, "项目编号和捐赠金额不能为空", nil)
		return
	}
	project, err := a.getProjectByID(r.Context(), input.ProjectID)
	if err != nil {
		fail(w, http.StatusNotFound, "项目不存在", nil)
		return
	}
	if project.ApprovalStatus != "approved" {
		fail(w, http.StatusBadRequest, "项目尚未审核通过，当前不能接受捐赠", nil)
		return
	}
	if project.Status != "active" {
		fail(w, http.StatusBadRequest, "当前项目未处于可捐赠状态", nil)
		return
	}
	amountCents, err := normalizeAmountToCents(input.Amount)
	if err != nil {
		fail(w, http.StatusBadRequest, err.Error(), nil)
		return
	}
	donatedAt := time.Now()
	if strings.TrimSpace(input.DonatedAt) != "" {
		donatedAt, err = parseFlexibleTime(input.DonatedAt)
		if err != nil {
			fail(w, http.StatusBadRequest, err.Error(), nil)
			return
		}
	}
	donorName := strings.TrimSpace(input.DonorName)
	if donorName == "" {
		donorName = user.Username
	}
	if input.IsAnonymous {
		donorName = "匿名捐赠者"
	}
	result, err := a.db.ExecContext(r.Context(), `INSERT INTO donations (project_id, user_id, donor_name, is_anonymous, amount, message, donated_at, chain_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
		input.ProjectID, user.ID, donorName, boolToInt(input.IsAnonymous), amountCents, strings.TrimSpace(input.Message), asISO(donatedAt), asISO(time.Now()))
	if err != nil {
		fail(w, http.StatusInternalServerError, "服务器内部错误", err.Error())
		return
	}
	donationID, _ := result.LastInsertId()
	payload := buildDonationPayload(donationID, input.ProjectID, donorName, input.IsAnonymous, amountCents, input.Message, asISO(donatedAt))
	recordHash := sha256Hex(payload)
	_, _ = a.db.ExecContext(r.Context(), `UPDATE donations SET record_hash = ? WHERE id = ?`, recordHash, donationID)
	receipt := ChainReceipt{Status: "failed"}
	if chainReceipt, err := a.chain.recordDonation(r.Context(), donationID, input.ProjectID, recordHash, amountCents); err == nil {
		receipt = chainReceipt
	}
	_, _ = a.db.ExecContext(r.Context(), `UPDATE donations SET record_hash = ?, chain_status = ?, tx_hash = ?, block_number = ?, chain_recorded_at = ? WHERE id = ?`,
		recordHash, receipt.Status, nullableString(receipt.TxHash), nullableInt64(receipt.BlockNum), nullableString(receipt.RecordedAt), donationID)
	_, _ = a.db.ExecContext(r.Context(), `UPDATE projects SET raised_amount = raised_amount + ?, updated_at = ? WHERE id = ?`, amountCents, asISO(time.Now()), input.ProjectID)
	payloadJSON, _ := json.Marshal(map[string]interface{}{"donationId": donationID, "projectId": input.ProjectID, "payload": payload})
	_ = a.insertChainRecord(r.Context(), "donation", donationID, recordHash, receipt, string(payloadJSON))
	item, _ := a.getDonationRow(r.Context(), donationID)
	message := "捐赠已记录，但上链未成功"
	if receipt.Status == "success" {
		message = "捐赠记录已存证"
	}
	success(w, item, message)
}

func (a *App) getDonationRow(ctx context.Context, id int64) (donationRow, error) {
	var item donationRow
	err := a.db.QueryRowContext(ctx, `SELECT id, project_id, user_id, donor_name, is_anonymous, amount, message, donated_at, record_hash, chain_status, tx_hash, block_number, chain_recorded_at, created_at FROM donations WHERE id = ?`, id).
		Scan(&item.ID, &item.ProjectID, &item.UserID, &item.DonorName, &item.IsAnonymous, &item.Amount, &item.Message, &item.DonatedAt, &item.RecordHash, &item.ChainStatus, &item.TxHash, &item.BlockNumber, &item.ChainRecordedAt, &item.CreatedAt)
	return item, err
}

func (a *App) getLatestChainRecord(ctx context.Context, businessType string, businessID int64) (chainRecordRow, error) {
	var item chainRecordRow
	err := a.db.QueryRowContext(ctx, `SELECT id, business_type, business_id, record_hash, tx_hash, block_number, status, payload_json, created_at, updated_at FROM chain_records WHERE business_type = ? AND business_id = ? ORDER BY id DESC LIMIT 1`, businessType, businessID).
		Scan(&item.ID, &item.BusinessType, &item.BusinessID, &item.RecordHash, &item.TxHash, &item.BlockNumber, &item.Status, &item.PayloadJSON, &item.CreatedAt, &item.UpdatedAt)
	item.ExplorerTxURL = a.chain.buildExplorerTxURL(derefString(item.TxHash))
	return item, err
}

func derefString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func (a *App) handleDonationVerify(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
	donation, err := a.getDonationRow(r.Context(), id)
	if err != nil {
		fail(w, http.StatusNotFound, "捐赠记录不存在", nil)
		return
	}
	chainRecord, _ := a.getLatestChainRecord(r.Context(), "donation", id)
	payload := buildDonationPayload(donation.ID, donation.ProjectID, donation.DonorName, donation.IsAnonymous == 1, int64(donation.Amount), donation.Message, donation.DonatedAt)
	calculatedOK := sha256Hex(payload) == donation.RecordHash
	onChainHash := ""
	if a.cfg.ChainMode == "mock" && chainRecord.ID != 0 {
		onChainHash = chainRecord.RecordHash
	}
	if a.cfg.ChainMode != "mock" && donation.ChainStatus == "success" {
		if proof, err := a.chain.getDonationProof(r.Context(), donation.ID); err == nil {
			onChainHash = proof.RecordHash
		}
		if onChainHash == "" && chainRecord.ID != 0 && chainRecord.Status == "success" {
			onChainHash = chainRecord.RecordHash
		}
	}
	chainOK := onChainHash != "" && strings.EqualFold(onChainHash, donation.RecordHash)
	data := map[string]interface{}{
		"donationId":    donation.ID,
		"payload":       payload,
		"databaseHash":  donation.RecordHash,
		"onChainHash":   emptyToNil(onChainHash),
		"txHash":        donation.TxHash,
		"explorerTxUrl": a.chain.buildExplorerTxURL(derefString(donation.TxHash)),
		"calculatedOk":  calculatedOK,
		"chainOk":       chainOK,
		"verified":      calculatedOK && chainOK,
	}
	for k, v := range a.chain.publicConfig() {
		data[k] = v
	}
	success(w, data, "ok")
}

func emptyToNil(value string) interface{} {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return value
}

func (a *App) handleDisbursementsByProject(w http.ResponseWriter, r *http.Request) {
	projectID, _ := strconv.ParseInt(r.PathValue("projectId"), 10, 64)
	page, pageSize, offset := parsePagination(r)
	conditions := []string{"project_id = ?"}
	args := []interface{}{projectID}
	if startDate := strings.TrimSpace(r.URL.Query().Get("startDate")); startDate != "" {
		conditions = append(conditions, "occurred_at >= ?")
		args = append(args, startDate)
	}
	if endDate := strings.TrimSpace(r.URL.Query().Get("endDate")); endDate != "" {
		conditions = append(conditions, "occurred_at <= ?")
		args = append(args, endDate)
	}
	where := " WHERE " + strings.Join(conditions, " AND ")
	rows, err := a.db.QueryContext(r.Context(), `SELECT id, project_id, amount, receiver, purpose, description, occurred_at, record_hash, chain_status, tx_hash, block_number, chain_recorded_at, created_at FROM disbursements`+where+` ORDER BY occurred_at DESC LIMIT ? OFFSET ?`, append(args, pageSize, offset)...)
	if err != nil {
		fail(w, http.StatusInternalServerError, "服务器内部错误", err.Error())
		return
	}
	defer rows.Close()
	items := []disbursementRow{}
	for rows.Next() {
		var item disbursementRow
		if err := rows.Scan(&item.ID, &item.ProjectID, &item.Amount, &item.Receiver, &item.Purpose, &item.Description, &item.OccurredAt, &item.RecordHash, &item.ChainStatus, &item.TxHash, &item.BlockNumber, &item.ChainRecordedAt, &item.CreatedAt); err != nil {
			fail(w, http.StatusInternalServerError, "服务器内部错误", err.Error())
			return
		}
		items = append(items, item)
	}
	var total int
	if err := a.db.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM disbursements`+where, args...).Scan(&total); err != nil {
		fail(w, http.StatusInternalServerError, "服务器内部错误", err.Error())
		return
	}
	success(w, buildPaginatedResult(items, total, page, pageSize), "ok")
}

func (a *App) handleDisbursementRoutes(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/disbursements/")
	switch {
	case strings.HasPrefix(path, "project/"):
		r.SetPathValue("projectId", strings.TrimPrefix(path, "project/"))
		a.handleDisbursementsByProject(w, r)
	case strings.HasSuffix(path, "/verify"):
		r.SetPathValue("id", strings.TrimSuffix(path, "/verify"))
		a.handleDisbursementVerify(w, r)
	default:
		fail(w, http.StatusNotFound, "未找到接口: "+r.Method+" "+r.URL.Path, nil)
	}
}

func (a *App) handleDisbursementCreate(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r.Context())
	var input struct {
		ProjectID   int64   `json:"projectId"`
		Amount      float64 `json:"amount"`
		Receiver    string  `json:"receiver"`
		Purpose     string  `json:"purpose"`
		Description string  `json:"description"`
		OccurredAt  string  `json:"occurredAt"`
	}
	if err := decodeJSON(r, &input); err != nil {
		fail(w, http.StatusBadRequest, "请求体格式错误", err.Error())
		return
	}
	if input.ProjectID == 0 || input.Amount == 0 || strings.TrimSpace(input.Receiver) == "" || strings.TrimSpace(input.Purpose) == "" {
		fail(w, http.StatusBadRequest, "项目编号、金额、接收方和用途不能为空", nil)
		return
	}
	project, err := a.getProjectByID(r.Context(), input.ProjectID)
	if err != nil {
		fail(w, http.StatusNotFound, "项目不存在", nil)
		return
	}
	if project.ApprovalStatus != "approved" {
		fail(w, http.StatusBadRequest, "项目尚未审核通过，当前不能登记拨付", nil)
		return
	}
	amountCents, err := normalizeAmountToCents(input.Amount)
	if err != nil {
		fail(w, http.StatusBadRequest, err.Error(), nil)
		return
	}
	if float64(amountCents) > project.RaisedAmount-project.DisbursedAmount {
		fail(w, http.StatusBadRequest, "拨付金额超过项目可用余额", nil)
		return
	}
	occurredAt := time.Now()
	if strings.TrimSpace(input.OccurredAt) != "" {
		occurredAt, err = parseFlexibleTime(input.OccurredAt)
		if err != nil {
			fail(w, http.StatusBadRequest, err.Error(), nil)
			return
		}
	}
	result, err := a.db.ExecContext(r.Context(), `INSERT INTO disbursements (project_id, amount, receiver, purpose, description, occurred_at, chain_status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
		input.ProjectID, amountCents, strings.TrimSpace(input.Receiver), strings.TrimSpace(input.Purpose), strings.TrimSpace(input.Description), asISO(occurredAt), asISO(time.Now()))
	if err != nil {
		fail(w, http.StatusInternalServerError, "服务器内部错误", err.Error())
		return
	}
	disbursementID, _ := result.LastInsertId()
	payload := buildDisbursementPayload(disbursementID, input.ProjectID, amountCents, input.Receiver, input.Purpose, asISO(occurredAt))
	recordHash := sha256Hex(payload)
	_, _ = a.db.ExecContext(r.Context(), `UPDATE disbursements SET record_hash = ? WHERE id = ?`, recordHash, disbursementID)
	receipt := ChainReceipt{Status: "failed"}
	if chainReceipt, err := a.chain.recordDisbursement(r.Context(), disbursementID, input.ProjectID, recordHash, amountCents); err == nil {
		receipt = chainReceipt
	}
	_, _ = a.db.ExecContext(r.Context(), `UPDATE disbursements SET chain_status = ?, tx_hash = ?, block_number = ?, chain_recorded_at = ? WHERE id = ?`,
		receipt.Status, nullableString(receipt.TxHash), nullableInt64(receipt.BlockNum), nullableString(receipt.RecordedAt), disbursementID)
	_, _ = a.db.ExecContext(r.Context(), `UPDATE projects SET disbursed_amount = disbursed_amount + ?, updated_at = ? WHERE id = ?`, amountCents, asISO(time.Now()), input.ProjectID)
	payloadJSON, _ := json.Marshal(map[string]interface{}{"disbursementId": disbursementID, "projectId": input.ProjectID, "payload": payload})
	_ = a.insertChainRecord(r.Context(), "disbursement", disbursementID, recordHash, receipt, string(payloadJSON))
	detailJSON, _ := json.Marshal(map[string]interface{}{"projectId": input.ProjectID, "amount": amountCents, "purpose": input.Purpose})
	_ = a.insertOperationLog(r.Context(), user, "disbursement_create", "disbursement", disbursementID, string(detailJSON))
	item, _ := a.getDisbursementRow(r.Context(), disbursementID)
	message := "拨付已记录，但上链未成功"
	if receipt.Status == "success" {
		message = "拨付记录已存证"
	}
	success(w, item, message)
}

func (a *App) getDisbursementRow(ctx context.Context, id int64) (disbursementRow, error) {
	var item disbursementRow
	err := a.db.QueryRowContext(ctx, `SELECT id, project_id, amount, receiver, purpose, description, occurred_at, record_hash, chain_status, tx_hash, block_number, chain_recorded_at, created_at FROM disbursements WHERE id = ?`, id).
		Scan(&item.ID, &item.ProjectID, &item.Amount, &item.Receiver, &item.Purpose, &item.Description, &item.OccurredAt, &item.RecordHash, &item.ChainStatus, &item.TxHash, &item.BlockNumber, &item.ChainRecordedAt, &item.CreatedAt)
	return item, err
}

func (a *App) handleDisbursementVerify(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
	record, err := a.getDisbursementRow(r.Context(), id)
	if err != nil {
		fail(w, http.StatusNotFound, "拨付记录不存在", nil)
		return
	}
	chainRecord, _ := a.getLatestChainRecord(r.Context(), "disbursement", id)
	payload := buildDisbursementPayload(record.ID, record.ProjectID, int64(record.Amount), record.Receiver, record.Purpose, record.OccurredAt)
	calculatedOK := sha256Hex(payload) == record.RecordHash
	onChainHash := ""
	if a.cfg.ChainMode == "mock" && chainRecord.ID != 0 {
		onChainHash = chainRecord.RecordHash
	}
	if a.cfg.ChainMode != "mock" && record.ChainStatus == "success" {
		if proof, err := a.chain.getDisbursementProof(r.Context(), record.ID); err == nil {
			onChainHash = proof.RecordHash
		}
		if onChainHash == "" && chainRecord.ID != 0 && chainRecord.Status == "success" {
			onChainHash = chainRecord.RecordHash
		}
	}
	chainOK := onChainHash != "" && strings.EqualFold(onChainHash, record.RecordHash)
	data := map[string]interface{}{
		"disbursementId": record.ID,
		"payload":        payload,
		"databaseHash":   record.RecordHash,
		"onChainHash":    emptyToNil(onChainHash),
		"txHash":         record.TxHash,
		"explorerTxUrl":  a.chain.buildExplorerTxURL(derefString(record.TxHash)),
		"calculatedOk":   calculatedOK,
		"chainOk":        chainOK,
		"verified":       calculatedOK && chainOK,
	}
	for k, v := range a.chain.publicConfig() {
		data[k] = v
	}
	success(w, data, "ok")
}

func latestRecordsFromClause() string {
	return `
		FROM chain_records cr
		INNER JOIN (
			SELECT business_type, business_id, MAX(id) AS latest_id
			FROM chain_records
			GROUP BY business_type, business_id
		) latest ON latest.latest_id = cr.id
	`
}

func (a *App) handleLogs(w http.ResponseWriter, r *http.Request) {
	page, pageSize, offset := parsePagination(r)
	rows, err := a.db.QueryContext(r.Context(), `SELECT id, user_id, username, action, business_type, business_id, detail_json, created_at FROM operation_logs ORDER BY created_at DESC LIMIT ? OFFSET ?`, pageSize, offset)
	if err != nil {
		fail(w, http.StatusInternalServerError, "服务器内部错误", err.Error())
		return
	}
	defer rows.Close()
	items := []operationLogRow{}
	for rows.Next() {
		var item operationLogRow
		if err := rows.Scan(&item.ID, &item.UserID, &item.Username, &item.Action, &item.BusinessType, &item.BusinessID, &item.DetailJSON, &item.CreatedAt); err != nil {
			fail(w, http.StatusInternalServerError, "服务器内部错误", err.Error())
			return
		}
		items = append(items, item)
	}
	var total int
	if err := a.db.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM operation_logs`).Scan(&total); err != nil {
		fail(w, http.StatusInternalServerError, "服务器内部错误", err.Error())
		return
	}
	success(w, buildPaginatedResult(items, total, page, pageSize), "ok")
}

func (a *App) handleChainSummary(w http.ResponseWriter, r *http.Request) {
	data := map[string]interface{}{}
	var projectCount, donationCount int64
	var totalRaised, totalDisbursed, totalDonationAmount float64
	_ = a.db.QueryRowContext(r.Context(), `SELECT COUNT(*), COALESCE(SUM(raised_amount), 0), COALESCE(SUM(disbursed_amount), 0) FROM projects`).Scan(&projectCount, &totalRaised, &totalDisbursed)
	_ = a.db.QueryRowContext(r.Context(), `SELECT COUNT(*), COALESCE(SUM(amount), 0) FROM donations`).Scan(&donationCount, &totalDonationAmount)
	data["project_count"] = projectCount
	data["total_raised"] = totalRaised
	data["total_disbursed"] = totalDisbursed
	data["donation_count"] = donationCount
	data["total_donation_amount"] = totalDonationAmount
	query := `SELECT COUNT(*), SUM(CASE WHEN cr.status = 'success' THEN 1 ELSE 0 END), SUM(CASE WHEN cr.status != 'success' THEN 1 ELSE 0 END)` + latestRecordsFromClause()
	var totalRecords, successCount, failedCount sql.NullInt64
	_ = a.db.QueryRowContext(r.Context(), query).Scan(&totalRecords, &successCount, &failedCount)
	data["total_records"] = totalRecords.Int64
	data["success_count"] = successCount.Int64
	data["failed_count"] = failedCount.Int64

	rows, err := a.db.QueryContext(r.Context(), `SELECT cr.id, cr.business_type, cr.business_id, cr.record_hash, cr.tx_hash, cr.block_number, cr.status, cr.payload_json, cr.created_at, cr.updated_at `+latestRecordsFromClause()+` ORDER BY cr.created_at DESC LIMIT 6`)
	if err == nil {
		defer rows.Close()
		recent := []chainRecordRow{}
		for rows.Next() {
			var item chainRecordRow
			_ = rows.Scan(&item.ID, &item.BusinessType, &item.BusinessID, &item.RecordHash, &item.TxHash, &item.BlockNumber, &item.Status, &item.PayloadJSON, &item.CreatedAt, &item.UpdatedAt)
			item.ExplorerTxURL = a.chain.buildExplorerTxURL(derefString(item.TxHash))
			recent = append(recent, item)
		}
		data["recentRecords"] = recent
	}
	for k, v := range a.chain.publicConfig() {
		data[k] = v
	}
	success(w, data, "ok")
}

func (a *App) handleChainRecords(w http.ResponseWriter, r *http.Request) {
	page, pageSize, offset := parsePagination(r)
	conditions := []string{}
	args := []interface{}{}
	if status := strings.TrimSpace(r.URL.Query().Get("status")); status != "" {
		conditions = append(conditions, "cr.status = ?")
		args = append(args, status)
	}
	if businessType := strings.TrimSpace(r.URL.Query().Get("businessType")); businessType != "" {
		conditions = append(conditions, "cr.business_type = ?")
		args = append(args, businessType)
	}
	where := ""
	if len(conditions) > 0 {
		where = " WHERE " + strings.Join(conditions, " AND ")
	}
	query := `SELECT cr.id, cr.business_type, cr.business_id, cr.record_hash, cr.tx_hash, cr.block_number, cr.status, cr.payload_json, cr.created_at, cr.updated_at ` + latestRecordsFromClause() + where + ` ORDER BY cr.created_at DESC LIMIT ? OFFSET ?`
	rows, err := a.db.QueryContext(r.Context(), query, append(args, pageSize, offset)...)
	if err != nil {
		fail(w, http.StatusInternalServerError, "服务器内部错误", err.Error())
		return
	}
	defer rows.Close()
	items := []chainRecordRow{}
	for rows.Next() {
		var item chainRecordRow
		if err := rows.Scan(&item.ID, &item.BusinessType, &item.BusinessID, &item.RecordHash, &item.TxHash, &item.BlockNumber, &item.Status, &item.PayloadJSON, &item.CreatedAt, &item.UpdatedAt); err != nil {
			fail(w, http.StatusInternalServerError, "服务器内部错误", err.Error())
			return
		}
		item.ExplorerTxURL = a.chain.buildExplorerTxURL(derefString(item.TxHash))
		items = append(items, item)
	}
	var total int
	if err := a.db.QueryRowContext(r.Context(), `SELECT COUNT(*) `+latestRecordsFromClause()+where, args...).Scan(&total); err != nil {
		fail(w, http.StatusInternalServerError, "服务器内部错误", err.Error())
		return
	}
	success(w, buildPaginatedResult(items, total, page, pageSize), "ok")
}

func (a *App) handleChainTxDetail(w http.ResponseWriter, r *http.Request) {
	txHash := strings.TrimSpace(r.PathValue("txHash"))
	if !strings.HasPrefix(txHash, "0x") || len(txHash) != 66 {
		fail(w, http.StatusBadRequest, "交易哈希格式不正确", nil)
		return
	}
	related, _ := a.getChainRecordByTx(r.Context(), txHash)
	if a.cfg.ChainMode == "mock" {
		if related.ID == 0 {
			fail(w, http.StatusNotFound, "未找到对应交易", nil)
			return
		}
		data := map[string]interface{}{"txHash": txHash, "chainMode": a.cfg.ChainMode, "explorerTxUrl": a.chain.buildExplorerTxURL(txHash), "relatedRecord": related, "transaction": nil, "receipt": nil, "block": nil}
		for k, v := range a.chain.publicConfig() {
			data[k] = v
		}
		success(w, data, "ok")
		return
	}
	client, err := a.chain.newClient(r.Context())
	if err != nil {
		fail(w, http.StatusInternalServerError, "服务器内部错误", err.Error())
		return
	}
	defer client.Close()
	hash := common.HexToHash(txHash)
	tx, _, txErr := client.TransactionByHash(r.Context(), hash)
	receipt, receiptErr := client.TransactionReceipt(r.Context(), hash)
	if txErr != nil && receiptErr != nil && related.ID == 0 {
		fail(w, http.StatusNotFound, "未找到对应交易", nil)
		return
	}
	data := map[string]interface{}{"txHash": txHash, "chainMode": a.cfg.ChainMode, "explorerTxUrl": a.chain.buildExplorerTxURL(txHash), "relatedRecord": zeroChainRecordToNil(related)}
	if tx != nil {
		data["transaction"] = map[string]interface{}{
			"hash":                 tx.Hash().Hex(),
			"blockNumber":          nil,
			"from":                 "",
			"to":                   toString(tx.To()),
			"nonce":                tx.Nonce(),
			"type":                 tx.Type(),
			"chainId":              tx.ChainId().String(),
			"gasLimit":             tx.Gas(),
			"gasPrice":             bigIntToString(tx.GasPrice()),
			"maxFeePerGas":         bigIntToString(tx.GasFeeCap()),
			"maxPriorityFeePerGas": bigIntToString(tx.GasTipCap()),
			"value":                tx.Value().String(),
			"data":                 "0x" + fmt.Sprintf("%x", tx.Data()),
		}
	}
	if receipt != nil {
		from := ""
		if tx != nil {
			if sender, err := types.Sender(types.LatestSignerForChainID(tx.ChainId()), tx); err == nil {
				from = sender.Hex()
			}
		}
		logs := []map[string]interface{}{}
		for _, item := range receipt.Logs {
			topics := make([]string, 0, len(item.Topics))
			for _, topic := range item.Topics {
				topics = append(topics, topic.Hex())
			}
			logs = append(logs, map[string]interface{}{
				"address":          item.Address.Hex(),
				"topics":           topics,
				"data":             "0x" + fmt.Sprintf("%x", item.Data),
				"index":            item.Index,
				"transactionIndex": item.TxIndex,
				"blockNumber":      item.BlockNumber,
				"transactionHash":  item.TxHash.Hex(),
				"removed":          item.Removed,
			})
		}
		data["receipt"] = map[string]interface{}{
			"hash":              receipt.TxHash.Hex(),
			"status":            map[uint64]string{1: "success"}[receipt.Status],
			"blockNumber":       receipt.BlockNumber.Uint64(),
			"from":              from,
			"to":                receipt.ContractAddress.Hex(),
			"contractAddress":   emptyToNil(receipt.ContractAddress.Hex()),
			"gasUsed":           receipt.GasUsed,
			"cumulativeGasUsed": receipt.CumulativeGasUsed,
			"effectiveGasPrice": bigIntToString(receipt.EffectiveGasPrice),
			"logsBloom":         fmt.Sprintf("0x%x", receipt.Bloom.Bytes()),
			"logs":              logs,
		}
		if receipt.Status != 1 {
			data["receipt"].(map[string]interface{})["status"] = "failed"
		}
	}
	blockNumber := latestBlockNumber(tx, receipt, related)
	if blockNumber > 0 {
		if block, err := client.BlockByNumber(r.Context(), big.NewInt(blockNumber)); err == nil {
			data["block"] = map[string]interface{}{
				"number":        block.Number().Uint64(),
				"hash":          block.Hash().Hex(),
				"parentHash":    block.ParentHash().Hex(),
				"timestamp":     block.Time(),
				"timestampIso":  asISO(time.Unix(int64(block.Time()), 0)),
				"miner":         block.Coinbase().Hex(),
				"gasLimit":      block.GasLimit(),
				"gasUsed":       block.GasUsed(),
				"baseFeePerGas": bigIntToString(block.BaseFee()),
			}
		}
	}
	for k, v := range a.chain.publicConfig() {
		data[k] = v
	}
	success(w, data, "ok")
}

func bigIntToString(value interface{}) interface{} {
	switch typed := value.(type) {
	case *big.Int:
		if typed == nil {
			return nil
		}
		return typed.String()
	default:
		return nil
	}
}

func toString(address *common.Address) interface{} {
	if address == nil {
		return nil
	}
	return address.Hex()
}

func zeroChainRecordToNil(record chainRecordRow) interface{} {
	if record.ID == 0 {
		return nil
	}
	return record
}

func latestBlockNumber(tx *types.Transaction, receipt *types.Receipt, related chainRecordRow) int64 {
	if receipt != nil && receipt.BlockNumber != nil {
		return receipt.BlockNumber.Int64()
	}
	if related.BlockNumber != nil {
		return *related.BlockNumber
	}
	return 0
}

func (a *App) getChainRecordByTx(ctx context.Context, txHash string) (chainRecordRow, error) {
	var item chainRecordRow
	err := a.db.QueryRowContext(ctx, `SELECT id, business_type, business_id, record_hash, tx_hash, block_number, status, payload_json, created_at, updated_at FROM chain_records WHERE tx_hash = ? ORDER BY id DESC LIMIT 1`, txHash).
		Scan(&item.ID, &item.BusinessType, &item.BusinessID, &item.RecordHash, &item.TxHash, &item.BlockNumber, &item.Status, &item.PayloadJSON, &item.CreatedAt, &item.UpdatedAt)
	item.ExplorerTxURL = a.chain.buildExplorerTxURL(derefString(item.TxHash))
	return item, err
}

func (a *App) handleChainRetry(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r.Context())
	businessType := r.PathValue("businessType")
	businessID, _ := strconv.ParseInt(r.PathValue("businessId"), 10, 64)
	switch businessType {
	case "project":
		project, err := a.getProjectByID(r.Context(), businessID)
		if err != nil {
			fail(w, http.StatusNotFound, "项目不存在", nil)
			return
		}
		if project.ApprovalStatus != "approved" {
			fail(w, http.StatusBadRequest, "项目尚未审核通过，不能执行项目上链重试", nil)
			return
		}
		payload := buildProjectPayload(project.ID, project.Name, int64(project.TargetAmount), project.StartTime, project.EndTime, project.Status)
		recordHash := sha256Hex(payload)
		receipt, err := a.chain.syncProjectProof(r.Context(), project.ID, recordHash)
		if err != nil {
			fail(w, http.StatusInternalServerError, "服务器内部错误", err.Error())
			return
		}
		_, _ = a.db.ExecContext(r.Context(), `UPDATE projects SET chain_hash = ?, chain_status = ?, chain_tx_hash = ?, chain_block_number = ?, updated_at = ? WHERE id = ?`, recordHash, receipt.Status, nullableString(receipt.TxHash), nullableInt64(receipt.BlockNum), asISO(time.Now()), project.ID)
		payloadJSON, _ := json.Marshal(map[string]interface{}{"payload": payload})
		_ = a.insertChainRecord(r.Context(), "project", project.ID, recordHash, receipt, string(payloadJSON))
		detailJSON, _ := json.Marshal(map[string]interface{}{"status": receipt.Status})
		_ = a.insertOperationLog(r.Context(), user, "chain_retry", businessType, businessID, string(detailJSON))
		success(w, map[string]interface{}{"businessType": businessType, "businessId": businessID, "status": receipt.Status, "txHash": emptyToNil(receipt.TxHash)}, "重试完成")
	case "donation":
		donation, err := a.getDonationRow(r.Context(), businessID)
		if err != nil {
			fail(w, http.StatusNotFound, "捐赠记录不存在", nil)
			return
		}
		payload := buildDonationPayload(donation.ID, donation.ProjectID, donation.DonorName, donation.IsAnonymous == 1, int64(donation.Amount), donation.Message, donation.DonatedAt)
		recordHash := sha256Hex(payload)
		receipt, err := a.chain.ensureDonationProof(r.Context(), donation.ID, donation.ProjectID, recordHash, int64(donation.Amount))
		if err != nil {
			fail(w, http.StatusInternalServerError, "服务器内部错误", err.Error())
			return
		}
		_, _ = a.db.ExecContext(r.Context(), `UPDATE donations SET record_hash = ?, chain_status = ?, tx_hash = ?, block_number = ?, chain_recorded_at = ? WHERE id = ?`, recordHash, receipt.Status, nullableString(receipt.TxHash), nullableInt64(receipt.BlockNum), nullableString(receipt.RecordedAt), donation.ID)
		payloadJSON, _ := json.Marshal(map[string]interface{}{"payload": payload})
		_ = a.insertChainRecord(r.Context(), "donation", donation.ID, recordHash, receipt, string(payloadJSON))
		detailJSON, _ := json.Marshal(map[string]interface{}{"status": receipt.Status})
		_ = a.insertOperationLog(r.Context(), user, "chain_retry", businessType, businessID, string(detailJSON))
		success(w, map[string]interface{}{"businessType": businessType, "businessId": businessID, "status": receipt.Status, "txHash": emptyToNil(receipt.TxHash)}, "重试完成")
	case "disbursement":
		disbursement, err := a.getDisbursementRow(r.Context(), businessID)
		if err != nil {
			fail(w, http.StatusNotFound, "拨付记录不存在", nil)
			return
		}
		payload := buildDisbursementPayload(disbursement.ID, disbursement.ProjectID, int64(disbursement.Amount), disbursement.Receiver, disbursement.Purpose, disbursement.OccurredAt)
		recordHash := sha256Hex(payload)
		receipt, err := a.chain.ensureDisbursementProof(r.Context(), disbursement.ID, disbursement.ProjectID, recordHash, int64(disbursement.Amount))
		if err != nil {
			fail(w, http.StatusInternalServerError, "服务器内部错误", err.Error())
			return
		}
		_, _ = a.db.ExecContext(r.Context(), `UPDATE disbursements SET record_hash = ?, chain_status = ?, tx_hash = ?, block_number = ?, chain_recorded_at = ? WHERE id = ?`, recordHash, receipt.Status, nullableString(receipt.TxHash), nullableInt64(receipt.BlockNum), nullableString(receipt.RecordedAt), disbursement.ID)
		payloadJSON, _ := json.Marshal(map[string]interface{}{"payload": payload})
		_ = a.insertChainRecord(r.Context(), "disbursement", disbursement.ID, recordHash, receipt, string(payloadJSON))
		detailJSON, _ := json.Marshal(map[string]interface{}{"status": receipt.Status})
		_ = a.insertOperationLog(r.Context(), user, "chain_retry", businessType, businessID, string(detailJSON))
		success(w, map[string]interface{}{"businessType": businessType, "businessId": businessID, "status": receipt.Status, "txHash": emptyToNil(receipt.TxHash)}, "重试完成")
	default:
		fail(w, http.StatusBadRequest, "仅支持重试 project、donation、disbursement", nil)
	}
}

func (a *App) handleProjectCreate(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r.Context())
	var input struct {
		Name         string  `json:"name"`
		Description  string  `json:"description"`
		TargetAmount float64 `json:"targetAmount"`
		ImageURL     string  `json:"imageUrl"`
		StartTime    string  `json:"startTime"`
		EndTime      string  `json:"endTime"`
		Status       string  `json:"status"`
	}
	if err := decodeJSON(r, &input); err != nil {
		fail(w, http.StatusBadRequest, "请求体格式错误", err.Error())
		return
	}
	if strings.TrimSpace(input.Name) == "" || strings.TrimSpace(input.Description) == "" || input.TargetAmount == 0 || strings.TrimSpace(input.StartTime) == "" || strings.TrimSpace(input.EndTime) == "" {
		fail(w, http.StatusBadRequest, "项目名称、描述、目标金额、开始和结束时间不能为空", nil)
		return
	}
	if strings.TrimSpace(input.Status) == "" {
		input.Status = "active"
	}
	targetAmount, err := normalizeAmountToCents(input.TargetAmount)
	if err != nil {
		fail(w, http.StatusBadRequest, err.Error(), nil)
		return
	}
	startTime, err := parseFlexibleTime(input.StartTime)
	if err != nil {
		fail(w, http.StatusBadRequest, err.Error(), nil)
		return
	}
	endTime, err := parseFlexibleTime(input.EndTime)
	if err != nil {
		fail(w, http.StatusBadRequest, err.Error(), nil)
		return
	}
	now := asISO(time.Now())
	result, err := a.db.ExecContext(r.Context(), `INSERT INTO projects (name, description, target_amount, image_url, start_time, end_time, status, chain_status, created_at, updated_at, creator_user_id, approval_status, submitted_at, approved_at, approved_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, 'approved', ?, ?, ?)`,
		strings.TrimSpace(input.Name), strings.TrimSpace(input.Description), targetAmount, strings.TrimSpace(input.ImageURL), asISO(startTime), asISO(endTime), input.Status, now, now, user.ID, now, now, user.ID)
	if err != nil {
		fail(w, http.StatusInternalServerError, "服务器内部错误", err.Error())
		return
	}
	projectID, _ := result.LastInsertId()
	project, _ := a.getProjectByID(r.Context(), projectID)
	payload := buildProjectPayload(project.ID, project.Name, int64(project.TargetAmount), project.StartTime, project.EndTime, project.Status)
	recordHash := sha256Hex(payload)
	receipt := ChainReceipt{Status: "failed"}
	if chainReceipt, err := a.chain.syncProjectProof(r.Context(), project.ID, recordHash); err == nil {
		receipt = chainReceipt
	}
	_, _ = a.db.ExecContext(r.Context(), `UPDATE projects SET chain_hash = ?, chain_status = ?, chain_tx_hash = ?, chain_block_number = ?, updated_at = ? WHERE id = ?`, recordHash, receipt.Status, nullableString(receipt.TxHash), nullableInt64(receipt.BlockNum), asISO(time.Now()), project.ID)
	payloadJSON, _ := json.Marshal(map[string]interface{}{"projectId": project.ID, "payload": payload})
	_ = a.insertChainRecord(r.Context(), "project", project.ID, recordHash, receipt, string(payloadJSON))
	detailJSON, _ := json.Marshal(map[string]interface{}{"name": project.Name, "status": project.Status})
	_ = a.insertOperationLog(r.Context(), user, "project_create", "project", project.ID, string(detailJSON))
	finalProject, _ := a.getProjectByID(r.Context(), project.ID)
	message := "项目已创建，但上链未成功"
	if receipt.Status == "success" {
		message = "项目创建并上链成功"
	}
	success(w, finalProject, message)
}

func (a *App) handleProjectUpdate(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r.Context())
	id, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
	existing, err := a.getProjectByID(r.Context(), id)
	if err != nil {
		fail(w, http.StatusNotFound, "项目不存在", nil)
		return
	}
	var input struct {
		Name         *string  `json:"name"`
		Description  *string  `json:"description"`
		TargetAmount *float64 `json:"targetAmount"`
		ImageURL     *string  `json:"imageUrl"`
		StartTime    *string  `json:"startTime"`
		EndTime      *string  `json:"endTime"`
	}
	if err := decodeJSON(r, &input); err != nil {
		fail(w, http.StatusBadRequest, "请求体格式错误", err.Error())
		return
	}
	name := existing.Name
	description := existing.Description
	imageURL := existing.ImageURL
	startTime := existing.StartTime
	endTime := existing.EndTime
	targetAmount := existing.TargetAmount
	if input.Name != nil {
		name = strings.TrimSpace(*input.Name)
	}
	if input.Description != nil {
		description = strings.TrimSpace(*input.Description)
	}
	if input.ImageURL != nil {
		imageURL = strings.TrimSpace(*input.ImageURL)
	}
	if input.StartTime != nil {
		parsed, err := parseFlexibleTime(*input.StartTime)
		if err != nil {
			fail(w, http.StatusBadRequest, err.Error(), nil)
			return
		}
		startTime = asISO(parsed)
	}
	if input.EndTime != nil {
		parsed, err := parseFlexibleTime(*input.EndTime)
		if err != nil {
			fail(w, http.StatusBadRequest, err.Error(), nil)
			return
		}
		endTime = asISO(parsed)
	}
	if input.TargetAmount != nil {
		normalized, err := normalizeAmountToCents(*input.TargetAmount)
		if err != nil {
			fail(w, http.StatusBadRequest, err.Error(), nil)
			return
		}
		targetAmount = float64(normalized)
	}
	_, _ = a.db.ExecContext(r.Context(), `UPDATE projects SET name = ?, description = ?, target_amount = ?, image_url = ?, start_time = ?, end_time = ?, updated_at = ? WHERE id = ?`,
		name, description, targetAmount, imageURL, startTime, endTime, asISO(time.Now()), id)
	updated, _ := a.getProjectByID(r.Context(), id)
	if updated.ApprovalStatus == "approved" {
		payload := buildProjectPayload(updated.ID, updated.Name, int64(updated.TargetAmount), updated.StartTime, updated.EndTime, updated.Status)
		recordHash := sha256Hex(payload)
		receipt := ChainReceipt{Status: "failed"}
		if chainReceipt, err := a.chain.syncProjectProof(r.Context(), updated.ID, recordHash); err == nil {
			receipt = chainReceipt
		}
		_, _ = a.db.ExecContext(r.Context(), `UPDATE projects SET chain_hash = ?, chain_status = ?, chain_tx_hash = ?, chain_block_number = ?, updated_at = ? WHERE id = ?`,
			recordHash, receipt.Status, nullableString(receipt.TxHash), nullableInt64(receipt.BlockNum), asISO(time.Now()), updated.ID)
		payloadJSON, _ := json.Marshal(map[string]interface{}{"projectId": updated.ID, "payload": payload})
		_ = a.insertChainRecord(r.Context(), "project", updated.ID, recordHash, receipt, string(payloadJSON))
	}
	detailJSON, _ := json.Marshal(map[string]interface{}{"name": updated.Name})
	_ = a.insertOperationLog(r.Context(), user, "project_update", "project", updated.ID, string(detailJSON))
	finalProject, _ := a.getProjectByID(r.Context(), updated.ID)
	message := "项目申请已更新"
	if updated.ApprovalStatus == "approved" {
		message = "项目更新完成"
	}
	success(w, finalProject, message)
}

func (a *App) handleProjectStatusUpdate(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r.Context())
	id, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
	existing, err := a.getProjectByID(r.Context(), id)
	if err != nil {
		fail(w, http.StatusNotFound, "项目不存在", nil)
		return
	}
	var input struct {
		Status string `json:"status"`
	}
	if err := decodeJSON(r, &input); err != nil {
		fail(w, http.StatusBadRequest, "请求体格式错误", err.Error())
		return
	}
	if input.Status != "draft" && input.Status != "active" && input.Status != "closed" {
		fail(w, http.StatusBadRequest, "项目状态必须为 draft、active 或 closed", nil)
		return
	}
	if existing.ApprovalStatus != "approved" {
		fail(w, http.StatusBadRequest, "项目尚未审核通过，不能直接切换上线状态", nil)
		return
	}
	_, _ = a.db.ExecContext(r.Context(), `UPDATE projects SET status = ?, updated_at = ? WHERE id = ?`, input.Status, asISO(time.Now()), id)
	updated, _ := a.getProjectByID(r.Context(), id)
	payload := buildProjectPayload(updated.ID, updated.Name, int64(updated.TargetAmount), updated.StartTime, updated.EndTime, updated.Status)
	recordHash := sha256Hex(payload)
	receipt := ChainReceipt{Status: "failed"}
	if chainReceipt, err := a.chain.syncProjectProof(r.Context(), updated.ID, recordHash); err == nil {
		receipt = chainReceipt
	}
	_, _ = a.db.ExecContext(r.Context(), `UPDATE projects SET chain_hash = ?, chain_status = ?, chain_tx_hash = ?, chain_block_number = ?, updated_at = ? WHERE id = ?`,
		recordHash, receipt.Status, nullableString(receipt.TxHash), nullableInt64(receipt.BlockNum), asISO(time.Now()), updated.ID)
	payloadJSON, _ := json.Marshal(map[string]interface{}{"projectId": updated.ID, "payload": payload})
	_ = a.insertChainRecord(r.Context(), "project", updated.ID, recordHash, receipt, string(payloadJSON))
	detailJSON, _ := json.Marshal(map[string]interface{}{"status": input.Status})
	_ = a.insertOperationLog(r.Context(), user, "project_status_change", "project", updated.ID, string(detailJSON))
	finalProject, _ := a.getProjectByID(r.Context(), existing.ID)
	success(w, finalProject, "项目状态已更新")
}

func (a *App) handleMyProjectApplications(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r.Context())
	page, pageSize, offset := parsePagination(r)
	status := strings.TrimSpace(r.URL.Query().Get("approvalStatus"))
	args := []interface{}{user.ID}
	where := ` WHERE p.creator_user_id = ?`
	if status != "" {
		where += ` AND p.approval_status = ?`
		args = append(args, status)
	}
	query := `
		SELECT p.id, p.name, p.description, p.target_amount, p.raised_amount, p.disbursed_amount, p.image_url, p.start_time, p.end_time, p.status, p.chain_hash, p.chain_status, p.chain_tx_hash, p.chain_block_number, p.created_at, p.updated_at,
		       p.creator_user_id, creator.username, p.approval_status, p.submitted_at, p.approved_at, p.approved_by_user_id, approver.username, p.review_note
		FROM projects p
		LEFT JOIN users creator ON creator.id = p.creator_user_id
		LEFT JOIN users approver ON approver.id = p.approved_by_user_id
	` + where + ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`
	rows, err := a.db.QueryContext(r.Context(), query, append(args, pageSize, offset)...)
	if err != nil {
		fail(w, http.StatusInternalServerError, "服务器内部错误", err.Error())
		return
	}
	defer rows.Close()
	items := []projectRow{}
	for rows.Next() {
		var item projectRow
		if err := scanProjectNoDonationCount(rows, &item); err != nil {
			fail(w, http.StatusInternalServerError, "服务器内部错误", err.Error())
			return
		}
		items = append(items, item)
	}
	var total int
	if err := a.db.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM projects p`+where, args...).Scan(&total); err != nil {
		fail(w, http.StatusInternalServerError, "服务器内部错误", err.Error())
		return
	}
	success(w, buildPaginatedResult(items, total, page, pageSize), "ok")
}

func (a *App) handleProjectApplicationCreate(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r.Context())
	var input struct {
		Name         string  `json:"name"`
		Description  string  `json:"description"`
		TargetAmount float64 `json:"targetAmount"`
		ImageURL     string  `json:"imageUrl"`
		StartTime    string  `json:"startTime"`
		EndTime      string  `json:"endTime"`
	}
	if err := decodeJSON(r, &input); err != nil {
		fail(w, http.StatusBadRequest, "请求体格式错误", err.Error())
		return
	}
	if strings.TrimSpace(input.Name) == "" || strings.TrimSpace(input.Description) == "" || input.TargetAmount == 0 || strings.TrimSpace(input.StartTime) == "" || strings.TrimSpace(input.EndTime) == "" {
		fail(w, http.StatusBadRequest, "项目名称、描述、目标金额、开始和结束时间不能为空", nil)
		return
	}
	targetAmount, err := normalizeAmountToCents(input.TargetAmount)
	if err != nil {
		fail(w, http.StatusBadRequest, err.Error(), nil)
		return
	}
	startTime, err := parseFlexibleTime(input.StartTime)
	if err != nil {
		fail(w, http.StatusBadRequest, err.Error(), nil)
		return
	}
	endTime, err := parseFlexibleTime(input.EndTime)
	if err != nil {
		fail(w, http.StatusBadRequest, err.Error(), nil)
		return
	}
	now := asISO(time.Now())
	result, err := a.db.ExecContext(r.Context(), `INSERT INTO projects (name, description, target_amount, image_url, start_time, end_time, status, chain_status, created_at, updated_at, creator_user_id, approval_status, submitted_at) VALUES (?, ?, ?, ?, ?, ?, 'draft', 'pending', ?, ?, ?, 'pending', ?)`,
		strings.TrimSpace(input.Name), strings.TrimSpace(input.Description), targetAmount, strings.TrimSpace(input.ImageURL), asISO(startTime), asISO(endTime), now, now, user.ID, now)
	if err != nil {
		fail(w, http.StatusInternalServerError, "服务器内部错误", err.Error())
		return
	}
	projectID, _ := result.LastInsertId()
	project, _ := a.getProjectByID(r.Context(), projectID)
	detailJSON, _ := json.Marshal(map[string]interface{}{"name": project.Name, "approvalStatus": "pending"})
	_ = a.insertOperationLog(r.Context(), user, "project_application_create", "project", projectID, string(detailJSON))
	success(w, project, "项目申请已提交，等待管理员审核")
}

func (a *App) handleProjectReview(w http.ResponseWriter, r *http.Request) {
	user, _ := currentUser(r.Context())
	id, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
	project, err := a.getProjectByID(r.Context(), id)
	if err != nil {
		fail(w, http.StatusNotFound, "项目不存在", nil)
		return
	}
	if project.ApprovalStatus == "approved" {
		fail(w, http.StatusBadRequest, "项目已审核通过，无需重复审核", nil)
		return
	}
	var input struct {
		Action     string `json:"action"`
		ReviewNote string `json:"reviewNote"`
	}
	if err := decodeJSON(r, &input); err != nil {
		fail(w, http.StatusBadRequest, "请求体格式错误", err.Error())
		return
	}
	input.Action = strings.ToLower(strings.TrimSpace(input.Action))
	if input.Action != "approve" && input.Action != "reject" {
		fail(w, http.StatusBadRequest, "审核动作必须为 approve 或 reject", nil)
		return
	}
	if input.Action == "reject" && strings.TrimSpace(input.ReviewNote) == "" {
		fail(w, http.StatusBadRequest, "驳回时请填写审核意见", nil)
		return
	}
	if input.Action == "approve" {
		_, _ = a.db.ExecContext(r.Context(), `UPDATE projects SET approval_status = 'approved', approved_at = ?, approved_by_user_id = ?, review_note = ?, status = 'active', updated_at = ? WHERE id = ?`,
			asISO(time.Now()), user.ID, strings.TrimSpace(input.ReviewNote), asISO(time.Now()), id)
		updated, _ := a.getProjectByID(r.Context(), id)
		payload := buildProjectPayload(updated.ID, updated.Name, int64(updated.TargetAmount), updated.StartTime, updated.EndTime, updated.Status)
		recordHash := sha256Hex(payload)
		receipt := ChainReceipt{Status: "failed"}
		if chainReceipt, err := a.chain.syncProjectProof(r.Context(), updated.ID, recordHash); err == nil {
			receipt = chainReceipt
		}
		_, _ = a.db.ExecContext(r.Context(), `UPDATE projects SET chain_hash = ?, chain_status = ?, chain_tx_hash = ?, chain_block_number = ?, updated_at = ? WHERE id = ?`,
			recordHash, receipt.Status, nullableString(receipt.TxHash), nullableInt64(receipt.BlockNum), asISO(time.Now()), updated.ID)
		payloadJSON, _ := json.Marshal(map[string]interface{}{"projectId": updated.ID, "payload": payload})
		_ = a.insertChainRecord(r.Context(), "project", updated.ID, recordHash, receipt, string(payloadJSON))
		detailJSON, _ := json.Marshal(map[string]interface{}{"action": "approve", "reviewNote": strings.TrimSpace(input.ReviewNote)})
		_ = a.insertOperationLog(r.Context(), user, "project_review", "project", id, string(detailJSON))
		finalProject, _ := a.getProjectByID(r.Context(), id)
		success(w, finalProject, "项目审核通过，已上线")
		return
	}

	_, _ = a.db.ExecContext(r.Context(), `UPDATE projects SET approval_status = 'rejected', approved_at = NULL, approved_by_user_id = ?, review_note = ?, status = 'draft', updated_at = ?, chain_status = 'pending' WHERE id = ?`,
		user.ID, strings.TrimSpace(input.ReviewNote), asISO(time.Now()), id)
	detailJSON, _ := json.Marshal(map[string]interface{}{"action": "reject", "reviewNote": strings.TrimSpace(input.ReviewNote)})
	_ = a.insertOperationLog(r.Context(), user, "project_review", "project", id, string(detailJSON))
	finalProject, _ := a.getProjectByID(r.Context(), id)
	success(w, finalProject, "项目申请已驳回")
}
