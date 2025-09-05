package main

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
	"mywebdrive.local/pkg/config"
	"mywebdrive.local/pkg/database"
)

// UserRepository 用户仓储接口
type UserRepository interface {
	GetByID(id string) (*User, error)
	GetByEmail(email string) (*User, error)
	EmailExists(email string) (bool, error)
	Create(user *User) (*User, error)
	CreateWithTransaction(user *User, callback func() error) (*User, error)
}

// InviteCodeRepository 邀请码仓储接口
type InviteCodeRepository interface {
	ValidateCode(code string) error
	ConsumeCode(code, userID string) error
	Create(req CreateInvitationRequest, issuedBy string) (*InvitationCode, error)
	List() ([]InvitationCode, error)
	GetByCode(code string) (*InvitationCode, error)
	Revoke(code string) (int64, error)
}

// UserRepositoryImpl 用户仓储实现
type UserRepositoryImpl struct {
	db     *sql.DB
	logger *zap.Logger
}

// InviteCodeRepositoryImpl 邀请码仓储实现
type InviteCodeRepositoryImpl struct {
	db     *sql.DB
	config *config.Config
	logger *zap.Logger
}

// NewUserRepository 创建用户仓储实例
func NewUserRepository(db *sql.DB, logger *zap.Logger) UserRepository {
	return &UserRepositoryImpl{
		db:     db,
		logger: logger,
	}
}

// NewInviteCodeRepository 创建邀请码仓储实例
func NewInviteCodeRepository(db *sql.DB, config *config.Config, logger *zap.Logger) InviteCodeRepository {
	return &InviteCodeRepositoryImpl{
		db:     db,
		config: config,
		logger: logger,
	}
}

// UserRepositoryImpl 方法实现

func (r *UserRepositoryImpl) GetByID(id string) (*User, error) {
	var user User
	err := r.db.QueryRow(
		"SELECT id, name, email, password, role, storage_quota, storage_used, created_at, updated_at FROM users WHERE id = ?",
		id,
	).Scan(&user.ID, &user.Name, &user.Email, &user.Password, &user.Role, &user.StorageQuota, &user.StorageUsed, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, NewNotFoundError("user not found")
		}
		return nil, err
	}

	return &user, nil
}

func (r *UserRepositoryImpl) GetByEmail(email string) (*User, error) {
	var user User
	err := r.db.QueryRow(
		"SELECT id, name, email, password, role, storage_quota, storage_used, created_at, updated_at FROM users WHERE email = ?",
		email,
	).Scan(&user.ID, &user.Name, &user.Email, &user.Password, &user.Role, &user.StorageQuota, &user.StorageUsed, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, NewNotFoundError("user not found")
		}
		return nil, err
	}

	return &user, nil
}

func (r *UserRepositoryImpl) EmailExists(email string) (bool, error) {
	var count int
	err := r.db.QueryRow("SELECT COUNT(*) FROM users WHERE email = ?", email).Scan(&count)
	return count > 0, err
}

func (r *UserRepositoryImpl) Create(user *User) (*User, error) {
	userID := uuid.New().String()
	user.ID = userID

	_, err := r.db.Exec(`
		INSERT INTO users (id, name, email, password, role, storage_quota, storage_used, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		user.ID, user.Name, user.Email, user.Password, user.Role, user.StorageQuota, user.StorageUsed, user.CreatedAt, user.UpdatedAt,
	)

	if err != nil {
		// 检查是否为唯一约束错误
		if database.IsUniqueConstraintError(err, "users.email") {
			return nil, NewConflictError("email already exists")
		}
		return nil, err
	}

	return user, nil
}

func (r *UserRepositoryImpl) CreateWithTransaction(user *User, callback func() error) (*User, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	userID := uuid.New().String()
	user.ID = userID

	_, err = tx.Exec(`
		INSERT INTO users (id, name, email, password, role, storage_quota, storage_used, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		user.ID, user.Name, user.Email, user.Password, user.Role, user.StorageQuota, user.StorageUsed, user.CreatedAt, user.UpdatedAt,
	)

	if err != nil {
		if database.IsUniqueConstraintError(err, "users.email") {
			return nil, NewConflictError("email already exists")
		}
		return nil, err
	}

	// 执行回调函数（如消费邀请码）
	if callback != nil {
		if err = callback(); err != nil {
			return nil, err
		}
	}

	if err = tx.Commit(); err != nil {
		return nil, err
	}

	return user, nil
}

// InviteCodeRepositoryImpl 方法实现

func (r *InviteCodeRepositoryImpl) ValidateCode(code string) error {
	var id, issuedBy string
	var expiresAt sql.NullTime
	var usageLimit, usedCount int
	var isActive bool

	err := r.db.QueryRow(`
		SELECT id, issued_by, expires_at, usage_limit, used_count, is_active
		FROM invitation_codes WHERE code = ?`, code).Scan(
		&id, &issuedBy, &expiresAt, &usageLimit, &usedCount, &isActive)

	if err != nil {
		if err == sql.ErrNoRows {
			return NewNotFoundError("invitation code not found")
		}
		return err
	}

	if !isActive {
		return NewValidationError("invitation code is not active")
	}

	if expiresAt.Valid && expiresAt.Time.Before(time.Now().UTC()) {
		return NewValidationError("invitation code has expired")
	}

	if usedCount >= usageLimit {
		return NewValidationError("invitation code has reached usage limit")
	}

	return nil
}

func (r *InviteCodeRepositoryImpl) ConsumeCode(code, userID string) error {
	now := time.Now().UTC()

	// 更新邀请码使用状态
	_, err := r.db.Exec(`
		UPDATE invitation_codes 
		SET used_count = used_count + 1, used_by = ?, used_at = ?
		WHERE code = ? AND is_active = 1`,
		userID, now, code)
	if err != nil {
		return err
	}

	// 如果单次使用，设置为不活跃
	_, err = r.db.Exec(`
		UPDATE invitation_codes 
		SET is_active = 0
		WHERE code = ? AND usage_limit = 1`,
		code)

	return err
}

func (r *InviteCodeRepositoryImpl) Create(req CreateInvitationRequest, issuedBy string) (*InvitationCode, error) {
	// 生成邀请码
	code, err := r.generateInvitationCode()
	if err != nil {
		return nil, err
	}

	invitation := &InvitationCode{
		ID:         uuid.New().String(),
		Code:       code,
		IssuedBy:   issuedBy,
		IssuedAt:   time.Now().UTC(),
		UsageLimit: req.UsageLimit,
		UsedCount:  0,
		IsActive:   true,
	}

	// 解析过期时间
	if req.ExpiresAt != "" {
		if expTime, err := time.Parse(time.RFC3339, req.ExpiresAt); err == nil {
			invitation.ExpiresAt = &expTime
		} else {
			return nil, NewValidationError("invalid expires_at format")
		}
	} else {
		// 使用默认TTL
		expTime := time.Now().UTC().Add(r.config.Registration.InviteDefaultTTL)
		invitation.ExpiresAt = &expTime
	}

	if req.Notes != "" {
		invitation.Notes = &req.Notes
	}

	// 保存到数据库
	_, err = r.db.Exec(`
		INSERT INTO invitation_codes (id, code, issued_by, issued_at, expires_at, usage_limit, used_count, is_active, notes)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		invitation.ID, invitation.Code, invitation.IssuedBy, invitation.IssuedAt,
		invitation.ExpiresAt, invitation.UsageLimit, invitation.UsedCount, invitation.IsActive, invitation.Notes)

	if err != nil {
		return nil, err
	}

	return invitation, nil
}

func (r *InviteCodeRepositoryImpl) List() ([]InvitationCode, error) {
	rows, err := r.db.Query(`
		SELECT id, code, issued_by, issued_at, expires_at, usage_limit, used_count, is_active, used_by, used_at, notes
		FROM invitation_codes ORDER BY issued_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var invitations []InvitationCode
	for rows.Next() {
		var inv InvitationCode
		var expiresAt, usedAt sql.NullTime
		var usedBy, notes sql.NullString

		err := rows.Scan(&inv.ID, &inv.Code, &inv.IssuedBy, &inv.IssuedAt,
			&expiresAt, &inv.UsageLimit, &inv.UsedCount, &inv.IsActive,
			&usedBy, &usedAt, &notes)
		if err != nil {
			r.logger.Error("Failed to scan invitation", zap.Error(err))
			continue
		}

		if expiresAt.Valid {
			inv.ExpiresAt = &expiresAt.Time
		}
		if usedBy.Valid {
			inv.UsedBy = &usedBy.String
		}
		if usedAt.Valid {
			inv.UsedAt = &usedAt.Time
		}
		if notes.Valid {
			inv.Notes = &notes.String
		}

		invitations = append(invitations, inv)
	}

	return invitations, nil
}

func (r *InviteCodeRepositoryImpl) GetByCode(code string) (*InvitationCode, error) {
	var inv InvitationCode
	var expiresAt, usedAt sql.NullTime
	var usedBy, notes sql.NullString

	err := r.db.QueryRow(`
		SELECT id, code, issued_by, issued_at, expires_at, usage_limit, used_count, is_active, used_by, used_at, notes
		FROM invitation_codes WHERE code = ?`, code).Scan(
		&inv.ID, &inv.Code, &inv.IssuedBy, &inv.IssuedAt,
		&expiresAt, &inv.UsageLimit, &inv.UsedCount, &inv.IsActive,
		&usedBy, &usedAt, &notes)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, NewNotFoundError("invitation not found")
		}
		return nil, err
	}

	if expiresAt.Valid {
		inv.ExpiresAt = &expiresAt.Time
	}
	if usedBy.Valid {
		inv.UsedBy = &usedBy.String
	}
	if usedAt.Valid {
		inv.UsedAt = &usedAt.Time
	}
	if notes.Valid {
		inv.Notes = &notes.String
	}

	return &inv, nil
}

func (r *InviteCodeRepositoryImpl) Revoke(code string) (int64, error) {
	result, err := r.db.Exec("UPDATE invitation_codes SET is_active = 0 WHERE code = ? AND is_active = 1", code)
	if err != nil {
		return 0, err
	}

	return result.RowsAffected()
}

// 私有辅助方法

func (r *InviteCodeRepositoryImpl) generateInvitationCode() (string, error) {
	// 这里复用原来的生成逻辑
	// 为了简化，暂时使用UUID的前8位
	return uuid.New().String()[:8], nil
}
