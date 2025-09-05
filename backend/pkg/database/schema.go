package database

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
)

// InitSchema 初始化数据库schema
func InitSchema(db *sql.DB) error {
	// 创建users表
	createUsersTable := `
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		email TEXT NOT NULL UNIQUE,
		password TEXT NOT NULL,
		role TEXT NOT NULL DEFAULT 'user',
		storage_quota INTEGER NOT NULL DEFAULT 5368709120,
		storage_used INTEGER NOT NULL DEFAULT 0,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL
	);`

	if _, err := db.Exec(createUsersTable); err != nil {
		return fmt.Errorf("failed to create users table: %w", err)
	}

	// 为现有用户表添加role字段（安全的幂等操作）
	if err := addRoleColumnIfNotExists(db); err != nil {
		return fmt.Errorf("failed to add role column: %w", err)
	}

	// 创建invitation_codes表
	createInvitationCodesTable := `
	CREATE TABLE IF NOT EXISTS invitation_codes (
		id TEXT PRIMARY KEY,
		code TEXT UNIQUE NOT NULL,
		issued_by TEXT NOT NULL,
		issued_at DATETIME NOT NULL,
		expires_at DATETIME,
		usage_limit INTEGER NOT NULL DEFAULT 1,
		used_count INTEGER NOT NULL DEFAULT 0,
		is_active BOOLEAN NOT NULL DEFAULT 1,
		used_by TEXT,
		used_at DATETIME,
		notes TEXT
	);`

	if _, err := db.Exec(createInvitationCodesTable); err != nil {
		return fmt.Errorf("failed to create invitation_codes table: %w", err)
	}

	// 创建email唯一索引（如果不存在）
	createEmailIndex := `
	CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);`

	if _, err := db.Exec(createEmailIndex); err != nil {
		return fmt.Errorf("failed to create email index: %w", err)
	}

	// 创建邀请码索引
	createInviteCodeIndex := `
	CREATE UNIQUE INDEX IF NOT EXISTS idx_invitation_codes_code ON invitation_codes(code);`

	if _, err := db.Exec(createInviteCodeIndex); err != nil {
		return fmt.Errorf("failed to create invitation code index: %w", err)
	}

	// 创建metrics相关表
	if err := initMetricsTables(db); err != nil {
		return fmt.Errorf("failed to initialize metrics tables: %w", err)
	}

	return nil
}

// addRoleColumnIfNotExists 安全地添加role列到现有用户表
func addRoleColumnIfNotExists(db *sql.DB) error {
	// 检查role列是否已存在
	var columnExists bool
	err := db.QueryRow(`
		SELECT COUNT(*) > 0 
		FROM pragma_table_info('users') 
		WHERE name = 'role'
	`).Scan(&columnExists)
	
	if err != nil {
		return fmt.Errorf("failed to check role column existence: %w", err)
	}
	
	// 如果列不存在，则添加
	if !columnExists {
		_, err = db.Exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`)
		if err != nil {
			return fmt.Errorf("failed to add role column: %w", err)
		}
	}
	
	return nil
}

// initMetricsTables 初始化metrics相关表
func initMetricsTables(db *sql.DB) error {
	// events表 - 原始事件流
	createEventsTable := `
	CREATE TABLE IF NOT EXISTS events (
		id TEXT PRIMARY KEY,
		ts DATETIME NOT NULL,
		service TEXT NOT NULL,
		type TEXT NOT NULL,
		user_id TEXT,
		ip TEXT,
		size_bytes INTEGER DEFAULT 0,
		attrs TEXT
	);`
	
	if _, err := db.Exec(createEventsTable); err != nil {
		return fmt.Errorf("failed to create events table: %w", err)
	}

	// daily_stats表 - 日聚合数据
	createDailyStatsTable := `
	CREATE TABLE IF NOT EXISTS daily_stats (
		date TEXT NOT NULL,
		metric TEXT NOT NULL,
		value INTEGER NOT NULL DEFAULT 0,
		PRIMARY KEY (date, metric)
	);`
	
	if _, err := db.Exec(createDailyStatsTable); err != nil {
		return fmt.Errorf("failed to create daily_stats table: %w", err)
	}

	// totals表 - 总量数据
	createTotalsTable := `
	CREATE TABLE IF NOT EXISTS totals (
		metric TEXT PRIMARY KEY,
		value INTEGER NOT NULL DEFAULT 0
	);`
	
	if _, err := db.Exec(createTotalsTable); err != nil {
		return fmt.Errorf("failed to create totals table: %w", err)
	}

	// 创建索引
	indexes := []string{
		`CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);`,
		`CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);`,
		`CREATE INDEX IF NOT EXISTS idx_events_service ON events(service);`,
		`CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);`,
	}

	for _, idx := range indexes {
		if _, err := db.Exec(idx); err != nil {
			return fmt.Errorf("failed to create events index: %w", err)
		}
	}

	return nil
}

// EnsureDataDir 确保数据目录存在
func EnsureDataDir(dbPath string) error {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create data directory %s: %w", dir, err)
	}
	return nil
}

// IsUniqueConstraintError 检查是否为唯一约束错误
func IsUniqueConstraintError(err error, field string) bool {
	if err == nil {
		return false
	}
	errStr := err.Error()
	return contains(errStr, "UNIQUE constraint failed") && contains(errStr, field)
}

// contains 检查字符串是否包含子字符串（不区分大小写）
func contains(s, substr string) bool {
	return len(s) >= len(substr) && 
		   (s == substr || 
		    len(s) > len(substr) && 
		    (s[:len(substr)] == substr || 
		     s[len(s)-len(substr):] == substr || 
		     containsAt(s, substr)))
}

func containsAt(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
