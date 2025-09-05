package main

import (
	"sync"
	"testing"
	"time"

	"go.uber.org/zap"
)

func TestUploadSessionManager_ConcurrentAccess(t *testing.T) {
	logger, _ := zap.NewDevelopment()

	manager := NewUploadSessionManager(UploadSessionManagerConfig{
		Logger:        logger,
		StoragePath:   "/tmp/test-storage",
		CleanupPeriod: 10 * time.Millisecond, // 快速清理以便测试
		SessionTTL:    100 * time.Millisecond,
	})
	defer manager.Shutdown()

	// 创建测试会话
	testSession := &UploadSession{
		ID:        "test-session",
		FileName:  "test.txt",
		FileSize:  1024,
		ExpiresAt: time.Now().Add(1 * time.Hour),
		Status:    "uploading",
	}

	// 将测试会话写入管理器，避免未使用变量
	manager.Set(testSession.ID, testSession)

	// 并发测试
	const numGoroutines = 100
	var wg sync.WaitGroup

	// 测试并发写入
	wg.Add(numGoroutines)
	for i := 0; i < numGoroutines; i++ {
		go func(id int) {
			defer wg.Done()
			sessionID := "session-" + string(rune(id))
			session := &UploadSession{
				ID:        sessionID,
				FileName:  "test.txt",
				FileSize:  1024,
				ExpiresAt: time.Now().Add(1 * time.Hour),
				Status:    "uploading",
			}
			manager.Set(sessionID, session)
		}(i)
	}
	wg.Wait()

	// 测试并发读取
	wg.Add(numGoroutines)
	for i := 0; i < numGoroutines; i++ {
		go func(id int) {
			defer wg.Done()
			sessionID := "session-" + string(rune(id))
			session, exists := manager.Get(sessionID)
			if exists && session.ID != sessionID {
				t.Errorf("Session ID mismatch: expected %s, got %s", sessionID, session.ID)
			}
		}(i)
	}
	wg.Wait()

	// 验证Count方法的线程安全性
	count := manager.Count()
	if count < 0 || count > numGoroutines {
		t.Errorf("Invalid count: %d", count)
	}
}

func TestUploadSessionManager_TTLExpiry(t *testing.T) {
	logger, _ := zap.NewDevelopment()

	manager := NewUploadSessionManager(UploadSessionManagerConfig{
		Logger:        logger,
		StoragePath:   "/tmp/test-storage",
		CleanupPeriod: 50 * time.Millisecond,
		SessionTTL:    100 * time.Millisecond, // 很短的TTL
	})
	defer manager.Shutdown()

	// 创建会话
	sessionID := "ttl-test-session"
	session := &UploadSession{
		ID:        sessionID,
		FileName:  "test.txt",
		FileSize:  1024,
		ExpiresAt: time.Now().Add(10 * time.Hour), // 很长的过期时间
		Status:    "uploading",
	}

	manager.Set(sessionID, session)

	// 立即应该能获取到
	if _, exists := manager.Get(sessionID); !exists {
		t.Error("Session should exist immediately after creation")
	}

	// 等待TTL过期
	time.Sleep(150 * time.Millisecond)

	// 现在应该获取不到了（由于TTL过期）
	if _, exists := manager.Get(sessionID); exists {
		t.Error("Session should be expired due to TTL")
	}
}

func TestUploadSessionManager_CleanupRoutine(t *testing.T) {
	logger, _ := zap.NewDevelopment()

	manager := NewUploadSessionManager(UploadSessionManagerConfig{
		Logger:        logger,
		StoragePath:   "/tmp/test-storage",
		CleanupPeriod: 50 * time.Millisecond,
		SessionTTL:    200 * time.Millisecond,
	})
	defer manager.Shutdown()

	// 创建多个会话
	for i := 0; i < 10; i++ {
		sessionID := "cleanup-test-" + string(rune(i))
		session := &UploadSession{
			ID:        sessionID,
			FileName:  "test.txt",
			FileSize:  1024,
			ExpiresAt: time.Now().Add(10 * time.Hour),
			Status:    "uploading",
		}
		manager.Set(sessionID, session)
	}

	initialCount := manager.Count()
	if initialCount != 10 {
		t.Errorf("Expected 10 sessions, got %d", initialCount)
	}

	// 等待清理协程运行
	time.Sleep(300 * time.Millisecond)

	// 所有会话应该因TTL过期而被清理
	finalCount := manager.Count()
	if finalCount != 0 {
		t.Errorf("Expected 0 sessions after cleanup, got %d", finalCount)
	}
}

func TestUploadSessionManager_ActivityUpdate(t *testing.T) {
	logger, _ := zap.NewDevelopment()

	manager := NewUploadSessionManager(UploadSessionManagerConfig{
		Logger:        logger,
		StoragePath:   "/tmp/test-storage",
		CleanupPeriod: 200 * time.Millisecond,
		SessionTTL:    100 * time.Millisecond,
	})
	defer manager.Shutdown()

	sessionID := "activity-test"
	session := &UploadSession{
		ID:        sessionID,
		FileName:  "test.txt",
		FileSize:  1024,
		ExpiresAt: time.Now().Add(10 * time.Hour),
		Status:    "uploading",
	}

	manager.Set(sessionID, session)

	// 在TTL到期前持续更新活跃时间
	for i := 0; i < 3; i++ {
		time.Sleep(80 * time.Millisecond)
		manager.UpdateActivity(sessionID)

		// 会话应该仍然存在
		if _, exists := manager.Get(sessionID); !exists {
			t.Errorf("Session should still exist after activity update %d", i+1)
		}
	}
}
