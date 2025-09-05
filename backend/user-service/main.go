package main

import (
    "context"
    "database/sql"
    "net/http"
    "os"
    "os/signal"
    "time"

    "github.com/go-playground/validator/v10"
    "github.com/golang-jwt/jwt/v5"
    "github.com/labstack/echo/v4"
    "github.com/labstack/echo/v4/middleware"
    _ "github.com/mattn/go-sqlite3"
    "go.uber.org/zap"
    "golang.org/x/crypto/bcrypt"

    "mywebdrive.local/pkg/config"
    "mywebdrive.local/pkg/database"
)

// User 用户模型
type User struct {
    ID           string    `json:"id"`
    Name         string    `json:"name"`
    Email        string    `json:"email"`
    StorageQuota int64     `json:"storageQuota"` // 存储配额（字节）
    StorageUsed  int64     `json:"storageUsed"`  // 已使用存储（字节）
    CreatedAt    time.Time `json:"createdAt"`
    UpdatedAt    time.Time `json:"updatedAt"`
}

// UpdateProfileRequest 更新个人资料请求
type UpdateProfileRequest struct {
    Name            *string `json:"name,omitempty"`
    CurrentPassword string  `json:"currentPassword,omitempty"`
    NewPassword     string  `json:"newPassword,omitempty"`
}

// UserService 用户服务
type UserService struct {
    db     *sql.DB
    config *config.Config
    logger *zap.Logger
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

    // 创建服务实例
    userService := &UserService{
        db:     db,
        config: cfg,
        logger: logger,
    }

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

    // JWT中间件
    jwtMiddleware := middleware.JWTWithConfig(middleware.JWTConfig{
        SigningKey: []byte(cfg.Security.JWTSecret),
        TokenLookup: "header:Authorization",
        AuthScheme: "Bearer",
    })

    // 路由设置
    e.GET("/health", healthCheck)
    
    api := e.Group("/api/v1/users")
    api.Use(jwtMiddleware)
    api.GET("/me", userService.GetProfile)
    api.PATCH("/me", userService.UpdateProfile)
    api.GET("/me/storage", userService.GetStorageInfo)

    // 启动服务器
    go func() {
        if err := e.Start(":8082"); err != nil && err != http.ErrServerClosed {
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
        "service": "user-service",
    })
}

// GetProfile 获取用户个人资料
func (s *UserService) GetProfile(c echo.Context) error {
    // 从JWT中获取用户ID
    token := c.Get("user").(*jwt.Token)
    claims := token.Claims.(jwt.MapClaims)
    userID := claims["user_id"].(string)

    // 查询用户信息
    var user User
    err := s.db.QueryRow(`
        SELECT id, name, email, storage_quota, storage_used, created_at, updated_at
        FROM users WHERE id = ?
    `, userID).Scan(
        &user.ID, &user.Name, &user.Email,
        &user.StorageQuota, &user.StorageUsed,
        &user.CreatedAt, &user.UpdatedAt,
    )

    if err != nil {
        if err == sql.ErrNoRows {
            return c.JSON(http.StatusNotFound, map[string]string{"error": "User not found"})
        }
        s.logger.Error("Database error", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
    }

    return c.JSON(http.StatusOK, user)
}

// UpdateProfile 更新用户个人资料
func (s *UserService) UpdateProfile(c echo.Context) error {
    // 从JWT中获取用户ID
    token := c.Get("user").(*jwt.Token)
    claims := token.Claims.(jwt.MapClaims)
    userID := claims["user_id"].(string)

    var req UpdateProfileRequest
    if err := c.Bind(&req); err != nil {
        return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
    }

    // 如果要更新密码，先验证当前密码
    if req.NewPassword != "" {
        if req.CurrentPassword == "" {
            return c.JSON(http.StatusBadRequest, map[string]string{"error": "Current password is required"})
        }

        var currentPasswordHash string
        err := s.db.QueryRow("SELECT password FROM users WHERE id = ?", userID).Scan(&currentPasswordHash)
        if err != nil {
            s.logger.Error("Failed to get current password", zap.Error(err))
            return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
        }

        if err := bcrypt.CompareHashAndPassword([]byte(currentPasswordHash), []byte(req.CurrentPassword)); err != nil {
            return c.JSON(http.StatusForbidden, map[string]string{"error": "Current password is incorrect"})
        }
    }

    // 构建更新查询
    tx, err := s.db.Begin()
    if err != nil {
        s.logger.Error("Failed to begin transaction", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
    }
    defer tx.Rollback()

    // 更新名称
    if req.Name != nil {
        _, err = tx.Exec("UPDATE users SET name = ?, updated_at = ? WHERE id = ?",
            *req.Name, time.Now(), userID)
        if err != nil {
            s.logger.Error("Failed to update name", zap.Error(err))
            return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to update profile"})
        }
    }

    // 更新密码
    if req.NewPassword != "" {
        hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
        if err != nil {
            s.logger.Error("Failed to hash password", zap.Error(err))
            return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to update password"})
        }

        _, err = tx.Exec("UPDATE users SET password = ?, updated_at = ? WHERE id = ?",
            string(hashedPassword), time.Now(), userID)
        if err != nil {
            s.logger.Error("Failed to update password", zap.Error(err))
            return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to update password"})
        }
    }

    if err = tx.Commit(); err != nil {
        s.logger.Error("Failed to commit transaction", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to update profile"})
    }

    // 返回更新后的用户信息
    return s.GetProfile(c)
}

// GetStorageInfo 获取存储信息
func (s *UserService) GetStorageInfo(c echo.Context) error {
    // 从JWT中获取用户ID
    token := c.Get("user").(*jwt.Token)
    claims := token.Claims.(jwt.MapClaims)
    userID := claims["user_id"].(string)

    var storageQuota, storageUsed int64
    err := s.db.QueryRow(`
        SELECT storage_quota, storage_used FROM users WHERE id = ?
    `, userID).Scan(&storageQuota, &storageUsed)

    if err != nil {
        if err == sql.ErrNoRows {
            return c.JSON(http.StatusNotFound, map[string]string{"error": "User not found"})
        }
        s.logger.Error("Database error", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
    }

    return c.JSON(http.StatusOK, map[string]interface{}{
        "quota":     storageQuota,
        "used":      storageUsed,
        "available": storageQuota - storageUsed,
        "usagePercentage": float64(storageUsed) / float64(storageQuota) * 100,
    })
}
