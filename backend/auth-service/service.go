package main

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
	"mywebdrive.local/pkg/config"
	"mywebdrive.local/pkg/metrics"
)

// AuthService 认证服务接口
type AuthServiceInterface interface {
	Register(req RegisterRequest) (*UserResponse, error)
	Login(req LoginRequest) (*TokenResponse, error)
	RefreshToken(refreshToken string) (string, error)
	CreateInvitation(req CreateInvitationRequest, issuedBy string) (*InvitationCode, error)
	ListInvitations() ([]InvitationCode, error)
	GetInvitation(code string) (*InvitationCode, error)
	RevokeInvitation(code string) error
}

// UserResponse 用户响应结构
type UserResponse struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
	Role  string `json:"role"`
}

// AuthServiceImpl 认证服务实现
type AuthServiceImpl struct {
	logger           *zap.Logger
	config           *config.Config
	userRepo         UserRepository
	inviteRepo       InviteCodeRepository
	metricsCollector *metrics.MetricsCollector
}

// NewAuthService 创建认证服务实例
func NewAuthService(
	logger *zap.Logger,
	config *config.Config,
	userRepo UserRepository,
	inviteRepo InviteCodeRepository,
	metricsCollector *metrics.MetricsCollector,
) AuthServiceInterface {
	return &AuthServiceImpl{
		logger:           logger,
		config:           config,
		userRepo:         userRepo,
		inviteRepo:       inviteRepo,
		metricsCollector: metricsCollector,
	}
}

// Register 用户注册业务逻辑
func (s *AuthServiceImpl) Register(req RegisterRequest) (*UserResponse, error) {
	// 如果配置要求邀请码，则验证邀请码
	if s.config.Registration.RequireInvite {
		if err := s.inviteRepo.ValidateCode(req.InvitationCode); err != nil {
			s.logger.Warn("Invalid invitation code", zap.String("code", req.InvitationCode), zap.Error(err))
			return nil, NewAuthError(ErrCodeInvalidInvite, "Invalid or expired invitation code", err)
		}
	}

	// 检查邮箱是否已存在
	if exists, err := s.userRepo.EmailExists(req.Email); err != nil {
		s.logger.Error("Failed to check email existence", zap.Error(err))
		return nil, NewAuthError(ErrCodeInternal, "Internal server error", err)
	} else if exists {
		return nil, NewAuthError(ErrCodeEmailExists, "Email already exists", nil)
	}

	// 哈希密码
	hashedPassword, err := s.hashPassword(req.Password)
	if err != nil {
		s.logger.Error("Failed to hash password", zap.Error(err))
		return nil, NewAuthError(ErrCodeInternal, "Internal server error", err)
	}

	// 创建用户
	user := &User{
		Name:         req.Name,
		Email:        req.Email,
		Password:     string(hashedPassword),
		Role:         "user",
		StorageQuota: s.config.GetDefaultQuotaBytes(),
		StorageUsed:  0,
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	}

	// 在事务中创建用户和消费邀请码
	createdUser, err := s.userRepo.CreateWithTransaction(user, func() error {
		if s.config.Registration.RequireInvite {
			return s.inviteRepo.ConsumeCode(req.InvitationCode, user.ID)
		}
		return nil
	})
	if err != nil {
		s.logger.Error("Failed to create user", zap.Error(err))
		return nil, NewAuthError(ErrCodeInternal, "Failed to create user", err)
	}

	// 记录注册事件
	s.metricsCollector.RecordEvent(&metrics.Event{
		Service: "auth",
		Type:    "register",
		UserID:  createdUser.ID,
		Attrs: map[string]interface{}{
			"email": req.Email,
			"name":  req.Name,
		},
	})

	return &UserResponse{
		ID:    createdUser.ID,
		Name:  createdUser.Name,
		Email: createdUser.Email,
		Role:  createdUser.Role,
	}, nil
}

// Login 用户登录业务逻辑
func (s *AuthServiceImpl) Login(req LoginRequest) (*TokenResponse, error) {
	// 查询用户
	user, err := s.userRepo.GetByEmail(req.Email)
	if err != nil {
		if IsNotFoundError(err) {
			return nil, NewAuthError(ErrCodeInvalidCredentials, "Invalid credentials", nil)
		}
		s.logger.Error("Database error", zap.Error(err))
		return nil, NewAuthError(ErrCodeInternal, "Internal server error", err)
	}

	// 验证密码
	if !s.verifyPassword(user.Password, req.Password) {
		return nil, NewAuthError(ErrCodeInvalidCredentials, "Invalid credentials", nil)
	}

	// 生成JWT令牌
	accessToken, err := s.generateAccessToken(user.ID, user.Role)
	if err != nil {
		s.logger.Error("Failed to generate access token", zap.Error(err))
		return nil, NewAuthError(ErrCodeInternal, "Failed to generate token", err)
	}

	refreshToken, err := s.generateRefreshToken(user.ID)
	if err != nil {
		s.logger.Error("Failed to generate refresh token", zap.Error(err))
		return nil, NewAuthError(ErrCodeInternal, "Failed to generate token", err)
	}

	// 记录登录事件
	s.metricsCollector.RecordEvent(&metrics.Event{
		Service: "auth",
		Type:    "login",
		UserID:  user.ID,
		Attrs: map[string]interface{}{
			"email": req.Email,
			"role":  user.Role,
		},
	})

	return &TokenResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	}, nil
}

// RefreshToken 刷新令牌业务逻辑
func (s *AuthServiceImpl) RefreshToken(refreshToken string) (string, error) {
	// 验证刷新令牌并获取用户ID
	userID, err := s.validateRefreshToken(refreshToken)
	if err != nil {
		return "", NewAuthError(ErrCodeInvalidToken, "Invalid refresh token", err)
	}

	// 获取用户角色
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		if IsNotFoundError(err) {
			return "", NewAuthError(ErrCodeUserNotFound, "User not found", nil)
		}
		s.logger.Error("Failed to query user", zap.Error(err))
		return "", NewAuthError(ErrCodeInternal, "Internal server error", err)
	}

	// 生成新的访问令牌
	accessToken, err := s.generateAccessToken(user.ID, user.Role)
	if err != nil {
		s.logger.Error("Failed to generate access token", zap.Error(err))
		return "", NewAuthError(ErrCodeInternal, "Failed to generate token", err)
	}

	return accessToken, nil
}

// CreateInvitation 创建邀请码业务逻辑
func (s *AuthServiceImpl) CreateInvitation(req CreateInvitationRequest, issuedBy string) (*InvitationCode, error) {
	// 设置默认值
	if req.UsageLimit == 0 {
		req.UsageLimit = s.config.Registration.InviteDefaultUsageLimit
	}

	invitation, err := s.inviteRepo.Create(req, issuedBy)
	if err != nil {
		s.logger.Error("Failed to create invitation", zap.Error(err))
		return nil, NewAuthError(ErrCodeInternal, "Internal server error", err)
	}

	return invitation, nil
}

// ListInvitations 列出邀请码业务逻辑
func (s *AuthServiceImpl) ListInvitations() ([]InvitationCode, error) {
	invitations, err := s.inviteRepo.List()
	if err != nil {
		s.logger.Error("Failed to list invitations", zap.Error(err))
		return nil, NewAuthError(ErrCodeInternal, "Internal server error", err)
	}

	return invitations, nil
}

// GetInvitation 获取邀请码详情业务逻辑
func (s *AuthServiceImpl) GetInvitation(code string) (*InvitationCode, error) {
	invitation, err := s.inviteRepo.GetByCode(code)
	if err != nil {
		if IsNotFoundError(err) {
			return nil, NewAuthError(ErrCodeNotFound, "Invitation not found", nil)
		}
		s.logger.Error("Failed to get invitation", zap.Error(err))
		return nil, NewAuthError(ErrCodeInternal, "Internal server error", err)
	}

	return invitation, nil
}

// RevokeInvitation 撤销邀请码业务逻辑
func (s *AuthServiceImpl) RevokeInvitation(code string) error {
	affected, err := s.inviteRepo.Revoke(code)
	if err != nil {
		s.logger.Error("Failed to revoke invitation", zap.Error(err))
		return NewAuthError(ErrCodeInternal, "Internal server error", err)
	}

	if affected == 0 {
		return NewAuthError(ErrCodeNotFound, "Invitation not found or already revoked", nil)
	}

	return nil
}

// 私有辅助方法

// hashPassword 哈希密码
func (s *AuthServiceImpl) hashPassword(password string) ([]byte, error) {
	return bcrypt.GenerateFromPassword([]byte(password), s.config.Security.BcryptCost)
}

// verifyPassword 验证密码
func (s *AuthServiceImpl) verifyPassword(hashedPassword, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(password)) == nil
}

// generateAccessToken 生成访问令牌
func (s *AuthServiceImpl) generateAccessToken(userID, role string) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID,
		"role":    role,
		"type":    "access",
		"exp":     time.Now().Add(s.config.Security.AccessTokenDuration).Unix(),
		"iat":     time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.config.Security.JWTSecret))
}

// generateRefreshToken 生成刷新令牌
func (s *AuthServiceImpl) generateRefreshToken(userID string) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID,
		"type":    "refresh",
		"exp":     time.Now().Add(s.config.Security.RefreshTokenDuration).Unix(),
		"iat":     time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.config.Security.JWTSecret))
}

// validateRefreshToken 验证刷新令牌并返回用户ID
func (s *AuthServiceImpl) validateRefreshToken(tokenString string) (string, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return []byte(s.config.Security.JWTSecret), nil
	})
	if err != nil || !token.Valid {
		return "", err
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", fmt.Errorf("invalid token claims")
	}

	userID, ok := claims["user_id"].(string)
	if !ok {
		return "", fmt.Errorf("invalid user ID in token")
	}

	return userID, nil
}