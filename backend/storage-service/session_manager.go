package main

import (
	"context"
	"os"
	"path/filepath"
	"sync"
	"time"

	"go.uber.org/zap"
)

// SessionEntry 会话条目，包含会话和最后活跃时间
type SessionEntry struct {
	Session      *UploadSession
	LastActivity time.Time
}

// UploadSessionManager 上传会话管理器，线程安全
type UploadSessionManager struct {
	sessions      sync.Map // map[string]*SessionEntry
	logger        *zap.Logger
	storagePath   string
	cleanupPeriod time.Duration
	sessionTTL    time.Duration
	cancelFunc    context.CancelFunc
	ctx           context.Context
}

// UploadSessionManagerConfig 会话管理器配置
type UploadSessionManagerConfig struct {
	Logger        *zap.Logger
	StoragePath   string
	CleanupPeriod time.Duration // 清理周期，默认 30 分钟
	SessionTTL    time.Duration // 会话TTL，默认 24 小时
}

// NewUploadSessionManager 创建新的会话管理器
func NewUploadSessionManager(config UploadSessionManagerConfig) *UploadSessionManager {
	// 设置默认值
	if config.CleanupPeriod == 0 {
		config.CleanupPeriod = 30 * time.Minute
	}
	if config.SessionTTL == 0 {
		config.SessionTTL = 24 * time.Hour
	}

	ctx, cancel := context.WithCancel(context.Background())
	
	manager := &UploadSessionManager{
		sessions:      sync.Map{},
		logger:        config.Logger,
		storagePath:   config.StoragePath,
		cleanupPeriod: config.CleanupPeriod,
		sessionTTL:    config.SessionTTL,
		cancelFunc:    cancel,
		ctx:           ctx,
	}

	// 启动清理协程
	go manager.startCleanupRoutine()

	return manager
}

// Set 存储会话
func (m *UploadSessionManager) Set(sessionID string, session *UploadSession) {
	entry := &SessionEntry{
		Session:      session,
		LastActivity: time.Now(),
	}
	m.sessions.Store(sessionID, entry)
}

// Get 获取会话
func (m *UploadSessionManager) Get(sessionID string) (*UploadSession, bool) {
	value, exists := m.sessions.Load(sessionID)
	if !exists {
		return nil, false
	}

	entry := value.(*SessionEntry)
	
	// 检查会话是否过期
	if m.isExpired(entry) {
		m.Delete(sessionID)
		return nil, false
	}

	// 更新最后活跃时间
	entry.LastActivity = time.Now()
	m.sessions.Store(sessionID, entry)

	return entry.Session, true
}

// Delete 删除会话
func (m *UploadSessionManager) Delete(sessionID string) {
	value, exists := m.sessions.LoadAndDelete(sessionID)
	if exists {
		// 清理临时文件
		m.cleanupSessionFiles(sessionID)
		
		entry := value.(*SessionEntry)
		m.logger.Info("Deleted session", 
			zap.String("sessionId", sessionID),
			zap.String("fileName", entry.Session.FileName))
	}
}

// UpdateActivity 更新会话活跃时间
func (m *UploadSessionManager) UpdateActivity(sessionID string) {
	value, exists := m.sessions.Load(sessionID)
	if exists {
		entry := value.(*SessionEntry)
		entry.LastActivity = time.Now()
		m.sessions.Store(sessionID, entry)
	}
}

// List 列出所有活跃会话（用于调试）
func (m *UploadSessionManager) List() map[string]*UploadSession {
	result := make(map[string]*UploadSession)
	m.sessions.Range(func(key, value interface{}) bool {
		sessionID := key.(string)
		entry := value.(*SessionEntry)
		
		if !m.isExpired(entry) {
			result[sessionID] = entry.Session
		} else {
			// 发现过期会话，删除它
			m.sessions.Delete(sessionID)
			m.cleanupSessionFiles(sessionID)
		}
		return true
	})
	return result
}

// Count 返回活跃会话数量
func (m *UploadSessionManager) Count() int {
	count := 0
	m.sessions.Range(func(key, value interface{}) bool {
		entry := value.(*SessionEntry)
		if !m.isExpired(entry) {
			count++
		} else {
			// 发现过期会话，删除它
			sessionID := key.(string)
			m.sessions.Delete(sessionID)
			m.cleanupSessionFiles(sessionID)
		}
		return true
	})
	return count
}

// Shutdown 关闭会话管理器
func (m *UploadSessionManager) Shutdown() {
	m.cancelFunc()
	m.logger.Info("Upload session manager shutdown")
}

// isExpired 检查会话是否过期
func (m *UploadSessionManager) isExpired(entry *SessionEntry) bool {
	now := time.Now()
	
	// 检查会话本身的过期时间
	if now.After(entry.Session.ExpiresAt) {
		return true
	}
	
	// 检查最后活跃时间的TTL
	if now.Sub(entry.LastActivity) > m.sessionTTL {
		return true
	}
	
	return false
}

// cleanupSessionFiles 清理会话相关的临时文件
func (m *UploadSessionManager) cleanupSessionFiles(sessionID string) {
	tempDir := filepath.Join(m.storagePath, "temp", sessionID)
	if err := os.RemoveAll(tempDir); err != nil {
		m.logger.Warn("Failed to cleanup session files",
			zap.String("sessionId", sessionID),
			zap.String("tempDir", tempDir),
			zap.Error(err))
	}
}

// startCleanupRoutine 启动清理协程
func (m *UploadSessionManager) startCleanupRoutine() {
	ticker := time.NewTicker(m.cleanupPeriod)
	defer ticker.Stop()

	m.logger.Info("Started session cleanup routine",
		zap.Duration("cleanupPeriod", m.cleanupPeriod),
		zap.Duration("sessionTTL", m.sessionTTL))

	for {
		select {
		case <-m.ctx.Done():
			m.logger.Info("Session cleanup routine stopped")
			return
		case <-ticker.C:
			m.performCleanup()
		}
	}
}

// performCleanup 执行清理操作
func (m *UploadSessionManager) performCleanup() {
	now := time.Now()
	cleanedCount := 0
	totalCount := 0

	m.sessions.Range(func(key, value interface{}) bool {
		sessionID := key.(string)
		entry := value.(*SessionEntry)
		totalCount++

		if m.isExpired(entry) {
			m.sessions.Delete(sessionID)
			m.cleanupSessionFiles(sessionID)
			cleanedCount++
			
			m.logger.Debug("Cleaned up expired session",
				zap.String("sessionId", sessionID),
				zap.String("fileName", entry.Session.FileName),
				zap.Duration("inactiveDuration", now.Sub(entry.LastActivity)))
		}
		
		return true
	})

	if cleanedCount > 0 {
		m.logger.Info("Session cleanup completed",
			zap.Int("cleanedCount", cleanedCount),
			zap.Int("activeCount", totalCount-cleanedCount),
			zap.Int("totalCount", totalCount))
	}
}