package main

import (
	"testing"

	"go.uber.org/zap"
	"mywebdrive.local/pkg/config"
	"mywebdrive.local/pkg/metrics"
)

// MockUserRepository 模拟用户仓储
type MockUserRepository struct {
	users map[string]*User
}

func NewMockUserRepository() *MockUserRepository {
	return &MockUserRepository{
		users: make(map[string]*User),
	}
}

func (m *MockUserRepository) GetByID(id string) (*User, error) {
	if user, exists := m.users[id]; exists {
		return user, nil
	}
	return nil, NewNotFoundError("user not found")
}

func (m *MockUserRepository) GetByEmail(email string) (*User, error) {
	for _, user := range m.users {
		if user.Email == email {
			return user, nil
		}
	}
	return nil, NewNotFoundError("user not found")
}

func (m *MockUserRepository) EmailExists(email string) (bool, error) {
	for _, user := range m.users {
		if user.Email == email {
			return true, nil
		}
	}
	return false, nil
}

func (m *MockUserRepository) Create(user *User) (*User, error) {
	if exists, _ := m.EmailExists(user.Email); exists {
		return nil, NewConflictError("email already exists")
	}
	user.ID = "test-user-id"
	m.users[user.ID] = user
	return user, nil
}

func (m *MockUserRepository) CreateWithTransaction(user *User, callback func() error) (*User, error) {
	if exists, _ := m.EmailExists(user.Email); exists {
		return nil, NewConflictError("email already exists")
	}
	
	if callback != nil {
		if err := callback(); err != nil {
			return nil, err
		}
	}
	
	user.ID = "test-user-id"
	m.users[user.ID] = user
	return user, nil
}

// MockInviteCodeRepository 模拟邀请码仓储
type MockInviteCodeRepository struct {
	codes map[string]*InvitationCode
}

func NewMockInviteCodeRepository() *MockInviteCodeRepository {
	return &MockInviteCodeRepository{
		codes: make(map[string]*InvitationCode),
	}
}

func (m *MockInviteCodeRepository) ValidateCode(code string) error {
	if _, exists := m.codes[code]; exists {
		return nil
	}
	return NewNotFoundError("invitation code not found")
}

func (m *MockInviteCodeRepository) ConsumeCode(code, userID string) error {
	if invitation, exists := m.codes[code]; exists {
		invitation.UsedCount++
		return nil
	}
	return NewNotFoundError("invitation code not found")
}

func (m *MockInviteCodeRepository) Create(req CreateInvitationRequest, issuedBy string) (*InvitationCode, error) {
	invitation := &InvitationCode{
		ID:         "test-invite-id",
		Code:       "TEST-CODE",
		IssuedBy:   issuedBy,
		UsageLimit: req.UsageLimit,
		UsedCount:  0,
		IsActive:   true,
	}
	m.codes[invitation.Code] = invitation
	return invitation, nil
}

func (m *MockInviteCodeRepository) List() ([]InvitationCode, error) {
	var invitations []InvitationCode
	for _, inv := range m.codes {
		invitations = append(invitations, *inv)
	}
	return invitations, nil
}

func (m *MockInviteCodeRepository) GetByCode(code string) (*InvitationCode, error) {
	if invitation, exists := m.codes[code]; exists {
		return invitation, nil
	}
	return nil, NewNotFoundError("invitation not found")
}

func (m *MockInviteCodeRepository) Revoke(code string) (int64, error) {
	if invitation, exists := m.codes[code]; exists {
		invitation.IsActive = false
		return 1, nil
	}
	return 0, nil
}

// TestAuthService_Register 测试用户注册
func TestAuthService_Register(t *testing.T) {
	logger, _ := zap.NewDevelopment()
	cfg := &config.Config{
		Registration: config.RegistrationConfig{
			RequireInvite: false,
		},
		Security: config.SecurityConfig{
			BcryptCost: 10, // 使用较低的成本以加快测试速度
		},
	}
	
	userRepo := NewMockUserRepository()
	inviteRepo := NewMockInviteCodeRepository()
	metricsCollector := &metrics.MetricsCollector{} // 简化的metrics收集器
	
	authService := NewAuthService(logger, cfg, userRepo, inviteRepo, metricsCollector)
	
	// 测试成功注册
	req := RegisterRequest{
		Name:     "Test User",
		Email:    "test@example.com",
		Password: "password123",
	}
	
	user, err := authService.Register(req)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	
	if user.Name != req.Name {
		t.Errorf("Expected name %s, got %s", req.Name, user.Name)
	}
	
	if user.Email != req.Email {
		t.Errorf("Expected email %s, got %s", req.Email, user.Email)
	}
	
	// 测试重复邮箱注册
	_, err = authService.Register(req)
	if err == nil {
		t.Error("Expected error for duplicate email, got nil")
	}
	
	if authErr, ok := err.(*AuthError); !ok || authErr.Code != ErrCodeEmailExists {
		t.Errorf("Expected ErrCodeEmailExists, got %v", err)
	}
}

// TestAuthService_Login 测试用户登录
func TestAuthService_Login(t *testing.T) {
	logger, _ := zap.NewDevelopment()
	cfg := &config.Config{
		Security: config.SecurityConfig{
			JWTSecret:            "test-secret",
			BcryptCost:           10,
			AccessTokenDuration:  3600,
			RefreshTokenDuration: 86400,
		},
	}
	
	userRepo := NewMockUserRepository()
	inviteRepo := NewMockInviteCodeRepository()
	metricsCollector := &metrics.MetricsCollector{}
	
	authService := NewAuthService(logger, cfg, userRepo, inviteRepo, metricsCollector)
	
	// 先注册一个用户
	registerReq := RegisterRequest{
		Name:     "Test User",
		Email:    "test@example.com",
		Password: "password123",
	}
	
	_, err := authService.Register(registerReq)
	if err != nil {
		t.Fatalf("Failed to register user: %v", err)
	}
	
	// 测试成功登录
	loginReq := LoginRequest{
		Email:    "test@example.com",
		Password: "password123",
	}
	
	tokens, err := authService.Login(loginReq)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	
	if tokens.AccessToken == "" {
		t.Error("Expected access token, got empty string")
	}
	
	if tokens.RefreshToken == "" {
		t.Error("Expected refresh token, got empty string")
	}
	
	// 测试错误密码登录
	wrongLoginReq := LoginRequest{
		Email:    "test@example.com",
		Password: "wrongpassword",
	}
	
	_, err = authService.Login(wrongLoginReq)
	if err == nil {
		t.Error("Expected error for wrong password, got nil")
	}
	
	if authErr, ok := err.(*AuthError); !ok || authErr.Code != ErrCodeInvalidCredentials {
		t.Errorf("Expected ErrCodeInvalidCredentials, got %v", err)
	}
}