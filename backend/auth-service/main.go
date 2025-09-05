package main

import (
    "context"
    "crypto/rand"
    "database/sql"
    "encoding/base64"
    "fmt"
    "net/http"
    "os"
    "os/signal"
    "strings"
    "time"

    "github.com/go-playground/validator/v10"
    "github.com/golang-jwt/jwt/v5"
    "github.com/google/uuid"
    "github.com/labstack/echo/v4"
    "github.com/labstack/echo/v4/middleware"
    _ "github.com/mattn/go-sqlite3"
    "go.uber.org/zap"
    "golang.org/x/crypto/bcrypt"

    "mywebdrive.local/pkg/config"
    "mywebdrive.local/pkg/database"
    "mywebdrive.local/pkg/metrics"
)

// User 用户模型
type User struct {
    ID           string    `json:"id"`
    Name         string    `json:"name"`
    Email        string    `json:"email"`
    Password     string    `json:"-"`
    Role         string    `json:"role"`
    StorageQuota int64     `json:"storageQuota"`
    StorageUsed  int64     `json:"storageUsed"`
    CreatedAt    time.Time `json:"createdAt"`
    UpdatedAt    time.Time `json:"updatedAt"`
}

// RegisterRequest 注册请求
type RegisterRequest struct {
    Name           string `json:"name" validate:"required,min=2,max=100"`
    Email          string `json:"email" validate:"required,email"`
    Password       string `json:"password" validate:"required,min=8"`
    InvitationCode string `json:"invitationCode" validate:"required"`
}

// LoginRequest 登录请求
type LoginRequest struct {
    Email    string `json:"email" validate:"required,email"`
    Password string `json:"password" validate:"required"`
}

// TokenResponse 令牌响应
type TokenResponse struct {
    AccessToken  string `json:"accessToken"`
    RefreshToken string `json:"refreshToken"`
}

// InvitationCode 邀请码模型
type InvitationCode struct {
    ID         string     `json:"id"`
    Code       string     `json:"code"`
    IssuedBy   string     `json:"issuedBy"`
    IssuedAt   time.Time  `json:"issuedAt"`
    ExpiresAt  *time.Time `json:"expiresAt"`
    UsageLimit int        `json:"usageLimit"`
    UsedCount  int        `json:"usedCount"`
    IsActive   bool       `json:"isActive"`
    UsedBy     *string    `json:"usedBy"`
    UsedAt     *time.Time `json:"usedAt"`
    Notes      *string    `json:"notes"`
}

// CreateInvitationRequest 创建邀请码请求
type CreateInvitationRequest struct {
    UsageLimit int    `json:"usageLimit" validate:"min=1,max=100"`
    ExpiresAt  string `json:"expiresAt"` // RFC3339格式，可选
    Notes      string `json:"notes"`     // 可选
}

// AuthService 认证服务
type AuthService struct {
    db               *sql.DB
    config           *config.Config
    logger           *zap.Logger
    metricsCollector *metrics.MetricsCollector
}

// CustomValidator 自定义验证器
type CustomValidator struct {
    validator *validator.Validate
}

func (cv *CustomValidator) Validate(i interface{}) error {
    return cv.validator.Struct(i)
}

func main() {
    // 初始化日志
    logger, _ := zap.NewProduction()
    defer logger.Sync()

    // 加载配置
    cfg, err := config.Load()
    if err != nil {
        logger.Fatal("Failed to load config", zap.Error(err))
    }

    // 确保数据目录存在
    if err := database.EnsureDataDir(cfg.Database.Path); err != nil {
        logger.Fatal("Failed to ensure data directory", zap.Error(err))
    }

    // 连接数据库
    db, err := sql.Open("sqlite3", cfg.Database.Path)
    if err != nil {
        logger.Fatal("Failed to connect to database", zap.Error(err))
    }
    defer db.Close()

    // 初始化数据库schema
    if err := database.InitSchema(db); err != nil {
        logger.Fatal("Failed to initialize database schema", zap.Error(err))
    }

    // 创建metrics收集器
    metricsCollector := metrics.NewMetricsCollector(db)

    // 创建仓储层实例
    userRepo := NewUserRepository(db, logger)
    inviteRepo := NewInviteCodeRepository(db, cfg, logger)

    // 创建服务层实例
    authService := NewAuthService(logger, cfg, userRepo, inviteRepo, metricsCollector)

    // 创建处理层实例
    authHandler := NewAuthHandler(authService, logger)

    // 创建Echo实例
    e := echo.New()

    // 设置验证器
    e.Validator = &CustomValidator{validator: validator.New()}

    // 中间件配置
    e.Use(middleware.Logger())
    e.Use(middleware.Recover())
    e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
        AllowOrigins: cfg.CORS.AllowedOrigins,
        AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPatch, http.MethodDelete, http.MethodOptions},
        AllowHeaders: []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAuthorization},
    }))

    // 路由设置
    e.GET("/health", healthCheck)
    e.POST("/api/v1/auth/register", authHandler.Register)
    e.POST("/api/v1/auth/login", authHandler.Login)
    e.POST("/api/v1/auth/refresh", authHandler.Refresh)
    e.POST("/api/v1/auth/logout", authHandler.Logout)

    // 邀请码管理路由（需要管理员权限）
    inviteGroup := e.Group("/api/v1/auth/invitations")
    inviteGroup.Use(JWTMiddleware(cfg))
    inviteGroup.Use(RequireAdmin)
    inviteGroup.POST("", authHandler.CreateInvitation)
    inviteGroup.GET("", authHandler.ListInvitations)
    inviteGroup.GET("/:code", authHandler.GetInvitation)
    inviteGroup.POST("/:code/revoke", authHandler.RevokeInvitation)

    // 启动服务器
    go func() {
        if err := e.Start(":8081"); err != nil && err != http.ErrServerClosed {
            logger.Fatal("shutting down the server", zap.Error(err))
        }
    }()

    // 优雅关闭
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, os.Interrupt)
    <-quit
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()
    if err := e.Shutdown(ctx); err != nil {
        logger.Fatal("server shutdown failed", zap.Error(err))
    }
}

func healthCheck(c echo.Context) error {
    return c.JSON(http.StatusOK, map[string]string{
        "status":  "healthy",
        "service": "auth-service",
    })
}

// 以下函数已重构至分层架构，保留用于回滚
// 生产环境中应删除这些函数

// Register 用户注册 (已废弃，由 AuthHandler.Register 替代)
func (s *AuthService) Register(c echo.Context) error {
    var req RegisterRequest
    if err := c.Bind(&req); err != nil {
        return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
    }

    // 验证请求数据
    if err := c.Validate(&req); err != nil {
        return c.JSON(http.StatusBadRequest, map[string]string{"error": "Validation failed: " + err.Error()})
    }

    // 如果配置要求邀请码，则验证邀请码
    if s.config.Registration.RequireInvite {
        if err := s.validateAndConsumeInvitation(req.InvitationCode); err != nil {
            s.logger.Warn("Invalid invitation code", zap.String("code", req.InvitationCode), zap.Error(err))
            return c.JSON(http.StatusForbidden, map[string]string{"error": "Invalid or expired invitation code"})
        }
    }

    // 哈希密码
    hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), s.config.Security.BcryptCost)
    if err != nil {
        s.logger.Error("Failed to hash password", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
    }

    // 创建用户（事务中）
    tx, err := s.db.Begin()
    if err != nil {
        s.logger.Error("Failed to begin transaction", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
    }
    defer tx.Rollback()

    userID := uuid.New().String()
    now := time.Now().UTC()
    quota := s.config.GetDefaultQuotaBytes()

    _, err = tx.Exec(`
        INSERT INTO users (id, name, email, password, role, storage_quota, storage_used, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'user', ?, 0, ?, ?)`,
        userID, req.Name, req.Email, string(hashedPassword), quota, now, now,
    )
    if err != nil {
        // 检查是否为唯一约束错误
        if database.IsUniqueConstraintError(err, "users.email") {
            return c.JSON(http.StatusConflict, map[string]string{"error": "Email already exists"})
        }
        s.logger.Error("Failed to create user", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create user"})
    }

    // 如果使用了邀请码，更新邀请码使用状态
    if s.config.Registration.RequireInvite {
        _, err = tx.Exec(`
            UPDATE invitation_codes 
            SET used_count = used_count + 1, used_by = ?, used_at = ?
            WHERE code = ? AND is_active = 1`,
            userID, now, req.InvitationCode)
        if err != nil {
            s.logger.Error("Failed to update invitation code", zap.Error(err))
            return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
        }

        // 如果单次使用，设置为不活跃
        _, err = tx.Exec(`
            UPDATE invitation_codes 
            SET is_active = 0
            WHERE code = ? AND usage_limit = 1`,
            req.InvitationCode)
        if err != nil {
            s.logger.Error("Failed to deactivate single-use invitation", zap.Error(err))
            return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
        }
    }

    if err = tx.Commit(); err != nil {
        s.logger.Error("Failed to commit transaction", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
    }

    // 记录注册事件
    s.metricsCollector.RecordEvent(&metrics.Event{
        Service: "auth",
        Type:    "register",
        UserID:  userID,
        IP:      c.RealIP(),
        Attrs: map[string]interface{}{
            "email": req.Email,
            "name":  req.Name,
        },
    })

    return c.JSON(http.StatusCreated, map[string]interface{}{
        "id":    userID,
        "name":  req.Name,
        "email": req.Email,
        "role":  "user",
    })
}

// Login 用户登录
func (s *AuthService) Login(c echo.Context) error {
    var req LoginRequest
    if err := c.Bind(&req); err != nil {
        return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
    }

    // 验证请求数据
    if err := c.Validate(&req); err != nil {
        return c.JSON(http.StatusBadRequest, map[string]string{"error": "Validation failed: " + err.Error()})
    }

    // 查询用户
    var user User
    err := s.db.QueryRow(
        "SELECT id, name, email, password, role FROM users WHERE email = ?",
        req.Email,
    ).Scan(&user.ID, &user.Name, &user.Email, &user.Password, &user.Role)
    if err != nil {
        if err == sql.ErrNoRows {
            return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid credentials"})
        }
        s.logger.Error("Database error", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
    }

    // 验证密码
    if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
        return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid credentials"})
    }

    // 生成JWT令牌
    accessToken, err := s.generateAccessToken(user.ID, user.Role)
    if err != nil {
        s.logger.Error("Failed to generate access token", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to generate token"})
    }

    refreshToken, err := s.generateRefreshToken(user.ID)
    if err != nil {
        s.logger.Error("Failed to generate refresh token", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to generate token"})
    }

    // 记录登录事件
    s.metricsCollector.RecordEvent(&metrics.Event{
        Service: "auth",
        Type:    "login",
        UserID:  user.ID,
        IP:      c.RealIP(),
        Attrs: map[string]interface{}{
            "email": req.Email,
            "role":  user.Role,
        },
    })

    return c.JSON(http.StatusOK, TokenResponse{
        AccessToken:  accessToken,
        RefreshToken: refreshToken,
    })
}

// Refresh 刷新令牌
func (s *AuthService) Refresh(c echo.Context) error {
    var req struct {
        RefreshToken string `json:"refreshToken"`
    }
    if err := c.Bind(&req); err != nil {
        return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
    }

    // 验证刷新令牌
    token, err := jwt.Parse(req.RefreshToken, func(token *jwt.Token) (interface{}, error) {
        return []byte(s.config.Security.JWTSecret), nil
    })
    if err != nil || !token.Valid {
        return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid refresh token"})
    }

    claims, ok := token.Claims.(jwt.MapClaims)
    if !ok {
        return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid token claims"})
    }

    userID, ok := claims["user_id"].(string)
    if !ok {
        return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid user ID in token"})
    }

    // 查询用户角色
    var role string
    err = s.db.QueryRow("SELECT role FROM users WHERE id = ?", userID).Scan(&role)
    if err != nil {
        if err == sql.ErrNoRows {
            return c.JSON(http.StatusUnauthorized, map[string]string{"error": "User not found"})
        }
        s.logger.Error("Failed to query user role", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
    }

    // 生成新的访问令牌
    accessToken, err := s.generateAccessToken(userID, role)
    if err != nil {
        s.logger.Error("Failed to generate access token", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to generate token"})
    }

    return c.JSON(http.StatusOK, map[string]string{
        "accessToken": accessToken,
    })
}

// Logout 用户登出
func (s *AuthService) Logout(c echo.Context) error {
    // TODO: 实现令牌黑名单机制
    return c.NoContent(http.StatusNoContent)
}

// generateAccessToken 生成访问令牌
func (s *AuthService) generateAccessToken(userID, role string) (string, error) {
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
func (s *AuthService) generateRefreshToken(userID string) (string, error) {
    claims := jwt.MapClaims{
        "user_id": userID,
        "type":    "refresh",
        "exp":     time.Now().Add(s.config.Security.RefreshTokenDuration).Unix(),
        "iat":     time.Now().Unix(),
    }
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    return token.SignedString([]byte(s.config.Security.JWTSecret))
}

// validateAndConsumeInvitation 验证邀请码是否有效（不消费）
func (s *AuthService) validateAndConsumeInvitation(code string) error {
    var id, issuedBy string
    var expiresAt sql.NullTime
    var usageLimit, usedCount int
    var isActive bool

    err := s.db.QueryRow(`
        SELECT id, issued_by, expires_at, usage_limit, used_count, is_active
        FROM invitation_codes WHERE code = ?`, code).Scan(
        &id, &issuedBy, &expiresAt, &usageLimit, &usedCount, &isActive)

    if err != nil {
        if err == sql.ErrNoRows {
            return fmt.Errorf("invitation code not found")
        }
        return err
    }

    if !isActive {
        return fmt.Errorf("invitation code is not active")
    }

    if expiresAt.Valid && expiresAt.Time.Before(time.Now().UTC()) {
        return fmt.Errorf("invitation code has expired")
    }

    if usedCount >= usageLimit {
        return fmt.Errorf("invitation code has reached usage limit")
    }

    return nil
}

// JWTMiddleware JWT中间件
func (s *AuthService) JWTMiddleware() echo.MiddlewareFunc {
    return middleware.JWTWithConfig(middleware.JWTConfig{
        SigningKey:  []byte(s.config.Security.JWTSecret),
        TokenLookup: "header:Authorization",
        AuthScheme:  "Bearer",
        ErrorHandler: func(err error) error {
            s.logger.Warn("JWT validation failed", zap.Error(err))
            return echo.NewHTTPError(http.StatusUnauthorized, "Invalid or expired token")
        },
    })
}

// RequireAdmin 管理员权限中间件
func (s *AuthService) RequireAdmin(next echo.HandlerFunc) echo.HandlerFunc {
    return func(c echo.Context) error {
        token, ok := c.Get("user").(*jwt.Token)
        if !ok {
            return echo.NewHTTPError(http.StatusUnauthorized, "No token found")
        }

        claims, ok := token.Claims.(jwt.MapClaims)
        if !ok {
            return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token claims")
        }

        role, ok := claims["role"].(string)
        if !ok || role != "admin" {
            return echo.NewHTTPError(http.StatusForbidden, "Admin access required")
        }

        return next(c)
    }
}

// CreateInvitation 创建邀请码
func (s *AuthService) CreateInvitation(c echo.Context) error {
    var req CreateInvitationRequest
    if err := c.Bind(&req); err != nil {
        return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
    }

    // 设置默认值
    if req.UsageLimit == 0 {
        req.UsageLimit = s.config.Registration.InviteDefaultUsageLimit
    }

    // 从JWT获取管理员ID
    token := c.Get("user").(*jwt.Token)
    claims := token.Claims.(jwt.MapClaims)
    issuedBy := claims["user_id"].(string)

    // 生成邀请码
    code, err := s.generateInvitationCode()
    if err != nil {
        s.logger.Error("Failed to generate invitation code", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
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
            return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid expires_at format"})
        }
    } else {
        // 使用默认TTL
        expTime := time.Now().UTC().Add(s.config.Registration.InviteDefaultTTL)
        invitation.ExpiresAt = &expTime
    }

    if req.Notes != "" {
        invitation.Notes = &req.Notes
    }

    // 保存到数据库
    _, err = s.db.Exec(`
        INSERT INTO invitation_codes (id, code, issued_by, issued_at, expires_at, usage_limit, used_count, is_active, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        invitation.ID, invitation.Code, invitation.IssuedBy, invitation.IssuedAt,
        invitation.ExpiresAt, invitation.UsageLimit, invitation.UsedCount, invitation.IsActive, invitation.Notes)

    if err != nil {
        s.logger.Error("Failed to save invitation code", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
    }

    return c.JSON(http.StatusCreated, invitation)
}

// ListInvitations 列出邀请码
func (s *AuthService) ListInvitations(c echo.Context) error {
    rows, err := s.db.Query(`
        SELECT id, code, issued_by, issued_at, expires_at, usage_limit, used_count, is_active, used_by, used_at, notes
        FROM invitation_codes ORDER BY issued_at DESC`)
    if err != nil {
        s.logger.Error("Failed to query invitations", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
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
            s.logger.Error("Failed to scan invitation", zap.Error(err))
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

    return c.JSON(http.StatusOK, invitations)
}

// GetInvitation 获取邀请码详情
func (s *AuthService) GetInvitation(c echo.Context) error {
    code := c.Param("code")

    var inv InvitationCode
    var expiresAt, usedAt sql.NullTime
    var usedBy, notes sql.NullString

    err := s.db.QueryRow(`
        SELECT id, code, issued_by, issued_at, expires_at, usage_limit, used_count, is_active, used_by, used_at, notes
        FROM invitation_codes WHERE code = ?`, code).Scan(
        &inv.ID, &inv.Code, &inv.IssuedBy, &inv.IssuedAt,
        &expiresAt, &inv.UsageLimit, &inv.UsedCount, &inv.IsActive,
        &usedBy, &usedAt, &notes)

    if err != nil {
        if err == sql.ErrNoRows {
            return c.JSON(http.StatusNotFound, map[string]string{"error": "Invitation not found"})
        }
        s.logger.Error("Failed to query invitation", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
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

    return c.JSON(http.StatusOK, inv)
}

// RevokeInvitation 撤销邀请码
func (s *AuthService) RevokeInvitation(c echo.Context) error {
    code := c.Param("code")

    result, err := s.db.Exec("UPDATE invitation_codes SET is_active = 0 WHERE code = ? AND is_active = 1", code)
    if err != nil {
        s.logger.Error("Failed to revoke invitation", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
    }

    affected, _ := result.RowsAffected()
    if affected == 0 {
        return c.JSON(http.StatusNotFound, map[string]string{"error": "Invitation not found or already revoked"})
    }

    return c.JSON(http.StatusOK, map[string]string{"message": "Invitation revoked successfully"})
}

// generateInvitationCode 生成安全的邀请码
func (s *AuthService) generateInvitationCode() (string, error) {
    bytes := make([]byte, s.config.Registration.InviteCodeLength*3/4) // Base64编码后长度约为原长度4/3
    if _, err := rand.Read(bytes); err != nil {
        return "", err
    }
    
    // 使用URL安全的Base64编码，并移除填充
    code := base64.URLEncoding.EncodeToString(bytes)
    code = strings.TrimRight(code, "=")
    
    // 如果长度超过配置，截断到指定长度
    if len(code) > s.config.Registration.InviteCodeLength {
        code = code[:s.config.Registration.InviteCodeLength]
    }
    
    return code, nil
}