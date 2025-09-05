package main

import (
    "context"
    "crypto/rand"
    "database/sql"
    "encoding/base64"
    "fmt"
    "io"
    "net/http"
    "os"
    "os/signal"
    "time"

    "github.com/golang-jwt/jwt/v5"
    "github.com/google/uuid"
    "github.com/labstack/echo/v4"
    "github.com/labstack/echo/v4/middleware"
    _ "github.com/mattn/go-sqlite3"
    "go.uber.org/zap"
)

// ShareType 分享类型
type ShareType string

const (
    ShareTypePrivate ShareType = "private" // 私有分享，需要密码
    ShareTypePublic  ShareType = "public"  // 公开分享
)

// SharePermission 分享权限
type SharePermission string

const (
    PermissionView     SharePermission = "view"     // 只读
    PermissionDownload SharePermission = "download" // 下载
    PermissionEdit     SharePermission = "edit"     // 编辑（暂不实现）
)

// Share 分享模型
type Share struct {
    ID          string          `json:"id"`
    FileID      string          `json:"fileId"`
    OwnerID     string          `json:"ownerId"`
    ShareToken  string          `json:"shareToken"`
    ShareType   ShareType       `json:"shareType"`
    Permission  SharePermission `json:"permission"`
    Password    *string         `json:"password,omitempty"`
    ExpiresAt   *time.Time      `json:"expiresAt"`
    MaxDownloads *int           `json:"maxDownloads"`
    DownloadCount int           `json:"downloadCount"`
    IsActive    bool            `json:"isActive"`
    CreatedAt   time.Time       `json:"createdAt"`
    UpdatedAt   time.Time       `json:"updatedAt"`
}

// CreateShareRequest 创建分享请求
type CreateShareRequest struct {
    FileID       string          `json:"fileId" validate:"required"`
    ShareType    ShareType       `json:"shareType" validate:"required"`
    Permission   SharePermission `json:"permission" validate:"required"`
    Password     *string         `json:"password,omitempty"`
    ExpiresAt    *time.Time      `json:"expiresAt"`
    MaxDownloads *int            `json:"maxDownloads"`
}

// UpdateShareRequest 更新分享请求
type UpdateShareRequest struct {
    ShareType     *ShareType       `json:"shareType,omitempty"`
    Permission    *SharePermission `json:"permission,omitempty"`
    Password      *string          `json:"password,omitempty"`
    ExpiresAt     *time.Time       `json:"expiresAt"`
    MaxDownloads  *int             `json:"maxDownloads"`
    IsActive      *bool            `json:"isActive,omitempty"`
}

// AccessShareRequest 访问分享请求
type AccessShareRequest struct {
    Password *string `json:"password,omitempty"`
}

// ShareInfo 分享信息（公开访问）
type ShareInfo struct {
    ID           string          `json:"id"`
    FileID       string          `json:"fileId"`
    FileName     string          `json:"fileName"`
    FileSize     int64           `json:"fileSize"`
    MimeType     string          `json:"mimeType"`
    ShareType    ShareType       `json:"shareType"`
    Permission   SharePermission `json:"permission"`
    RequirePassword bool         `json:"requirePassword"`
    ExpiresAt    *time.Time      `json:"expiresAt"`
    MaxDownloads *int            `json:"maxDownloads"`
    DownloadCount int            `json:"downloadCount"`
    CreatedAt    time.Time       `json:"createdAt"`
}

// SharingService 分享服务
type SharingService struct {
    db            *sql.DB
    jwtSecret     string
    logger        *zap.Logger
    httpClient    *http.Client
    storageServiceURL string
}

func main() {
    // 初始化日志
    logger, _ := zap.NewProduction()
    defer logger.Sync()

    // 连接数据库
    dbPath := os.Getenv("DATABASE_PATH")
    if dbPath == "" {
        dbPath = "./sharing.db"
    }
    db, err := sql.Open("sqlite3", dbPath)
    if err != nil {
        logger.Fatal("Failed to connect to database", zap.Error(err))
    }
    defer db.Close()

    // 初始化数据库表
    if err := initDatabase(db); err != nil {
        logger.Fatal("Failed to initialize database", zap.Error(err))
    }

    // 创建服务实例
    storageServiceURL := os.Getenv("STORAGE_SERVICE_URL")
    if storageServiceURL == "" {
        storageServiceURL = "http://localhost:8084" // 默认值
    }
    
    sharingService := &SharingService{
        db:                db,
        jwtSecret:         os.Getenv("JWT_SECRET"),
        logger:            logger,
        httpClient:        &http.Client{Timeout: 30 * time.Second},
        storageServiceURL: storageServiceURL,
    }

    // 创建Echo实例
    e := echo.New()

    // 中间件配置
    e.Use(middleware.Logger())
    e.Use(middleware.Recover())
    e.Use(middleware.CORS())

    // JWT中间件（仅用于需要认证的路由）
    jwtMiddleware := middleware.JWTWithConfig(middleware.JWTConfig{
        SigningKey:  []byte(sharingService.jwtSecret),
        TokenLookup: "header:Authorization",
        AuthScheme:  "Bearer",
    })

    // 路由设置
    e.GET("/health", healthCheck)

    // 公开访问路由（不需要JWT）
    e.GET("/api/v1/shares/:shareToken", sharingService.GetShareInfo)
    e.POST("/api/v1/shares/:shareToken/access", sharingService.AccessShare)
    e.GET("/api/v1/shares/:shareToken/download", sharingService.DownloadSharedFile)

    // 需要认证的路由
    api := e.Group("/api/v1")
    api.Use(jwtMiddleware)

    // 文件分享管理
    api.POST("/files/:fileId/shares", sharingService.CreateShare)
    api.GET("/files/:fileId/shares", sharingService.ListFileShares)
    api.PATCH("/shares/:shareId", sharingService.UpdateShare)
    api.DELETE("/shares/:shareId", sharingService.DeleteShare)
    api.GET("/shares", sharingService.ListUserShares)

    // 启动服务器
    go func() {
        if err := e.Start(":8085"); err != nil && err != http.ErrServerClosed {
            logger.Fatal("shutting down the server", zap.Error(err))
        }
    }()

    // 启动清理任务
    go sharingService.cleanupExpiredShares()

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
        "service": "sharing-service",
    })
}

// initDatabase 初始化数据库表
func initDatabase(db *sql.DB) error {
    schema := `
    CREATE TABLE IF NOT EXISTS shares (
        id TEXT PRIMARY KEY,
        file_id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        share_token TEXT UNIQUE NOT NULL,
        share_type TEXT NOT NULL,
        permission TEXT NOT NULL,
        password TEXT,
        expires_at DATETIME,
        max_downloads INTEGER,
        download_count INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_shares_file_id ON shares(file_id);
    CREATE INDEX IF NOT EXISTS idx_shares_owner_id ON shares(owner_id);
    CREATE INDEX IF NOT EXISTS idx_shares_token ON shares(share_token);
    CREATE INDEX IF NOT EXISTS idx_shares_active ON shares(is_active);
    `

    _, err := db.Exec(schema)
    return err
}

// getUserID 从JWT中获取用户ID
func getUserID(c echo.Context) string {
    token := c.Get("user").(*jwt.Token)
    claims := token.Claims.(jwt.MapClaims)
    return claims["user_id"].(string)
}

// generateShareToken 生成分享令牌
func generateShareToken() (string, error) {
    bytes := make([]byte, 32)
    if _, err := rand.Read(bytes); err != nil {
        return "", err
    }
    return base64.URLEncoding.EncodeToString(bytes), nil
}

// CreateShare 创建分享
func (s *SharingService) CreateShare(c echo.Context) error {
    userID := getUserID(c)
    fileID := c.Param("fileId")

    var req CreateShareRequest
    if err := c.Bind(&req); err != nil {
        return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
    }

    // TODO: 验证文件是否存在且用户有权限（调用元数据服务）
    // 这里简化处理

    // 生成分享令牌
    shareToken, err := generateShareToken()
    if err != nil {
        s.logger.Error("Failed to generate share token", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create share"})
    }

    // 创建分享
    shareID := uuid.New().String()
    now := time.Now()

    share := &Share{
        ID:            shareID,
        FileID:        fileID,
        OwnerID:       userID,
        ShareToken:    shareToken,
        ShareType:     req.ShareType,
        Permission:    req.Permission,
        Password:      req.Password,
        ExpiresAt:     req.ExpiresAt,
        MaxDownloads:  req.MaxDownloads,
        DownloadCount: 0,
        IsActive:      true,
        CreatedAt:     now,
        UpdatedAt:     now,
    }

    _, err = s.db.Exec(`
        INSERT INTO shares (id, file_id, owner_id, share_token, share_type, permission, 
                          password, expires_at, max_downloads, download_count, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, share.ID, share.FileID, share.OwnerID, share.ShareToken, share.ShareType, share.Permission,
        share.Password, share.ExpiresAt, share.MaxDownloads, share.DownloadCount, share.IsActive,
        share.CreatedAt, share.UpdatedAt)

    if err != nil {
        s.logger.Error("Failed to create share", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create share"})
    }

    s.logger.Info("Created share",
        zap.String("shareId", shareID),
        zap.String("fileId", fileID),
        zap.String("shareToken", shareToken))

    return c.JSON(http.StatusCreated, share)
}

// ListFileShares 列出文件的所有分享
func (s *SharingService) ListFileShares(c echo.Context) error {
    userID := getUserID(c)
    fileID := c.Param("fileId")

    rows, err := s.db.Query(`
        SELECT id, file_id, owner_id, share_token, share_type, permission, password,
               expires_at, max_downloads, download_count, is_active, created_at, updated_at
        FROM shares
        WHERE file_id = ? AND owner_id = ?
        ORDER BY created_at DESC
    `, fileID, userID)

    if err != nil {
        s.logger.Error("Failed to list file shares", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to list shares"})
    }
    defer rows.Close()

    var shares []Share
    for rows.Next() {
        var share Share
        var password sql.NullString
        var expiresAt sql.NullTime
        var maxDownloads sql.NullInt64

        err := rows.Scan(
            &share.ID, &share.FileID, &share.OwnerID, &share.ShareToken,
            &share.ShareType, &share.Permission, &password, &expiresAt,
            &maxDownloads, &share.DownloadCount, &share.IsActive,
            &share.CreatedAt, &share.UpdatedAt,
        )
        if err != nil {
            s.logger.Error("Failed to scan share row", zap.Error(err))
            continue
        }

        if password.Valid {
            share.Password = &password.String
        }
        if expiresAt.Valid {
            share.ExpiresAt = &expiresAt.Time
        }
        if maxDownloads.Valid {
            maxDl := int(maxDownloads.Int64)
            share.MaxDownloads = &maxDl
        }

        shares = append(shares, share)
    }

    return c.JSON(http.StatusOK, map[string]interface{}{
        "shares": shares,
    })
}

// UpdateShare 更新分享
func (s *SharingService) UpdateShare(c echo.Context) error {
    userID := getUserID(c)
    shareID := c.Param("shareId")

    var req UpdateShareRequest
    if err := c.Bind(&req); err != nil {
        return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
    }

    // 检查分享是否存在且属于当前用户
    var ownerID string
    err := s.db.QueryRow("SELECT owner_id FROM shares WHERE id = ?", shareID).Scan(&ownerID)
    if err != nil {
        if err == sql.ErrNoRows {
            return c.JSON(http.StatusNotFound, map[string]string{"error": "Share not found"})
        }
        s.logger.Error("Database error", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
    }

    if ownerID != userID {
        return c.JSON(http.StatusForbidden, map[string]string{"error": "Access denied"})
    }

    // 构建更新查询
    updates := []string{}
    args := []interface{}{}

    if req.ShareType != nil {
        updates = append(updates, "share_type = ?")
        args = append(args, *req.ShareType)
    }
    if req.Permission != nil {
        updates = append(updates, "permission = ?")
        args = append(args, *req.Permission)
    }
    if req.Password != nil {
        updates = append(updates, "password = ?")
        args = append(args, *req.Password)
    }
    if req.ExpiresAt != nil {
        updates = append(updates, "expires_at = ?")
        args = append(args, *req.ExpiresAt)
    }
    if req.MaxDownloads != nil {
        updates = append(updates, "max_downloads = ?")
        args = append(args, *req.MaxDownloads)
    }
    if req.IsActive != nil {
        updates = append(updates, "is_active = ?")
        args = append(args, *req.IsActive)
    }

    if len(updates) == 0 {
        return c.JSON(http.StatusBadRequest, map[string]string{"error": "No fields to update"})
    }

    updates = append(updates, "updated_at = ?")
    args = append(args, time.Now())
    args = append(args, shareID)

    query := "UPDATE shares SET " + updates[0]
    for i := 1; i < len(updates); i++ {
        query += ", " + updates[i]
    }
    query += " WHERE id = ?"

    result, err := s.db.Exec(query, args...)
    if err != nil {
        s.logger.Error("Failed to update share", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to update share"})
    }

    rowsAffected, _ := result.RowsAffected()
    if rowsAffected == 0 {
        return c.JSON(http.StatusNotFound, map[string]string{"error": "Share not found"})
    }

    return c.JSON(http.StatusOK, map[string]string{"message": "Share updated successfully"})
}

// DeleteShare 删除分享
func (s *SharingService) DeleteShare(c echo.Context) error {
    userID := getUserID(c)
    shareID := c.Param("shareId")

    result, err := s.db.Exec("DELETE FROM shares WHERE id = ? AND owner_id = ?", shareID, userID)
    if err != nil {
        s.logger.Error("Failed to delete share", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to delete share"})
    }

    rowsAffected, _ := result.RowsAffected()
    if rowsAffected == 0 {
        return c.JSON(http.StatusNotFound, map[string]string{"error": "Share not found"})
    }

    s.logger.Info("Deleted share", zap.String("shareId", shareID))

    return c.NoContent(http.StatusNoContent)
}

// ListUserShares 列出用户的所有分享
func (s *SharingService) ListUserShares(c echo.Context) error {
    userID := getUserID(c)

    rows, err := s.db.Query(`
        SELECT id, file_id, owner_id, share_token, share_type, permission, password,
               expires_at, max_downloads, download_count, is_active, created_at, updated_at
        FROM shares
        WHERE owner_id = ?
        ORDER BY created_at DESC
        LIMIT 50
    `, userID)

    if err != nil {
        s.logger.Error("Failed to list user shares", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to list shares"})
    }
    defer rows.Close()

    var shares []Share
    for rows.Next() {
        var share Share
        var password sql.NullString
        var expiresAt sql.NullTime
        var maxDownloads sql.NullInt64

        err := rows.Scan(
            &share.ID, &share.FileID, &share.OwnerID, &share.ShareToken,
            &share.ShareType, &share.Permission, &password, &expiresAt,
            &maxDownloads, &share.DownloadCount, &share.IsActive,
            &share.CreatedAt, &share.UpdatedAt,
        )
        if err != nil {
            s.logger.Error("Failed to scan share row", zap.Error(err))
            continue
        }

        if password.Valid {
            share.Password = &password.String
        }
        if expiresAt.Valid {
            share.ExpiresAt = &expiresAt.Time
        }
        if maxDownloads.Valid {
            maxDl := int(maxDownloads.Int64)
            share.MaxDownloads = &maxDl
        }

        shares = append(shares, share)
    }

    return c.JSON(http.StatusOK, map[string]interface{}{
        "shares": shares,
    })
}

// GetShareInfo 获取分享信息（公开访问）
func (s *SharingService) GetShareInfo(c echo.Context) error {
    shareToken := c.Param("shareToken")

    var share Share
    var password sql.NullString
    var expiresAt sql.NullTime
    var maxDownloads sql.NullInt64

    err := s.db.QueryRow(`
        SELECT id, file_id, owner_id, share_token, share_type, permission, password,
               expires_at, max_downloads, download_count, is_active, created_at, updated_at
        FROM shares
        WHERE share_token = ? AND is_active = 1
    `, shareToken).Scan(
        &share.ID, &share.FileID, &share.OwnerID, &share.ShareToken,
        &share.ShareType, &share.Permission, &password, &expiresAt,
        &maxDownloads, &share.DownloadCount, &share.IsActive,
        &share.CreatedAt, &share.UpdatedAt,
    )

    if err != nil {
        if err == sql.ErrNoRows {
            return c.JSON(http.StatusNotFound, map[string]string{"error": "Share not found"})
        }
        s.logger.Error("Database error", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
    }

    if password.Valid {
        share.Password = &password.String
    }
    if expiresAt.Valid {
        share.ExpiresAt = &expiresAt.Time
    }
    if maxDownloads.Valid {
        maxDl := int(maxDownloads.Int64)
        share.MaxDownloads = &maxDl
    }

    // 检查是否过期
    if share.ExpiresAt != nil && time.Now().After(*share.ExpiresAt) {
        return c.JSON(http.StatusGone, map[string]string{"error": "Share has expired"})
    }

    // 检查下载次数限制
    if share.MaxDownloads != nil && share.DownloadCount >= *share.MaxDownloads {
        return c.JSON(http.StatusGone, map[string]string{"error": "Download limit exceeded"})
    }

    // TODO: 从元数据服务获取文件信息
    // 这里简化处理
    shareInfo := ShareInfo{
        ID:              share.ID,
        FileID:          share.FileID,
        FileName:        "sample_file.txt", // 应该从元数据服务获取
        FileSize:        1024,              // 应该从元数据服务获取
        MimeType:        "text/plain",      // 应该从元数据服务获取
        ShareType:       share.ShareType,
        Permission:      share.Permission,
        RequirePassword: share.Password != nil,
        ExpiresAt:       share.ExpiresAt,
        MaxDownloads:    share.MaxDownloads,
        DownloadCount:   share.DownloadCount,
        CreatedAt:       share.CreatedAt,
    }

    return c.JSON(http.StatusOK, shareInfo)
}

// AccessShare 访问分享（验证密码）
func (s *SharingService) AccessShare(c echo.Context) error {
    shareToken := c.Param("shareToken")

    var req AccessShareRequest
    if err := c.Bind(&req); err != nil {
        return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
    }

    var share Share
    var password sql.NullString

    err := s.db.QueryRow(`
        SELECT id, file_id, password, is_active, expires_at, max_downloads, download_count
        FROM shares
        WHERE share_token = ? AND is_active = 1
    `, shareToken).Scan(
        &share.ID, &share.FileID, &password, &share.IsActive,
        &share.ExpiresAt, &share.MaxDownloads, &share.DownloadCount,
    )

    if err != nil {
        if err == sql.ErrNoRows {
            return c.JSON(http.StatusNotFound, map[string]string{"error": "Share not found"})
        }
        s.logger.Error("Database error", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
    }

    // 检查密码
    if password.Valid {
        if req.Password == nil || *req.Password != password.String {
            return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid password"})
        }
    }

    return c.JSON(http.StatusOK, map[string]string{
        "message": "Access granted",
        "fileId":  share.FileID,
    })
}

// DownloadSharedFile 下载分享的文件（代理下载）
func (s *SharingService) DownloadSharedFile(c echo.Context) error {
    shareToken := c.Param("shareToken")

    var share Share
    var password sql.NullString
    var expiresAt sql.NullTime
    var maxDownloads sql.NullInt64

    err := s.db.QueryRow(`
        SELECT id, file_id, password, expires_at, max_downloads, download_count, permission
        FROM shares
        WHERE share_token = ? AND is_active = 1
    `, shareToken).Scan(
        &share.ID, &share.FileID, &password, &expiresAt,
        &maxDownloads, &share.DownloadCount, &share.Permission,
    )

    if err != nil {
        if err == sql.ErrNoRows {
            return c.JSON(http.StatusNotFound, map[string]string{"error": "Share not found"})
        }
        s.logger.Error("Database error", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
    }

    if expiresAt.Valid {
        share.ExpiresAt = &expiresAt.Time
    }
    if maxDownloads.Valid {
        maxDl := int(maxDownloads.Int64)
        share.MaxDownloads = &maxDl
    }

    // 检查权限
    if share.Permission != PermissionDownload && share.Permission != PermissionView {
        return c.JSON(http.StatusForbidden, map[string]string{"error": "Download not allowed"})
    }

    // 检查是否过期
    if share.ExpiresAt != nil && time.Now().After(*share.ExpiresAt) {
        return c.JSON(http.StatusGone, map[string]string{"error": "Share has expired"})
    }

    // 检查下载次数限制
    if share.MaxDownloads != nil && share.DownloadCount >= *share.MaxDownloads {
        return c.JSON(http.StatusGone, map[string]string{"error": "Download limit exceeded"})
    }

    // 检查密码（从查询参数获取）
    if password.Valid {
        providedPassword := c.QueryParam("password")
        if providedPassword != password.String {
            return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid password"})
        }
    }

    // 代理下载：直接调用存储服务获取文件并流式返回
    err = s.proxyDownloadFromStorage(c, share.FileID)
    if err != nil {
        s.logger.Error("Failed to proxy download", zap.String("fileId", share.FileID), zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Download failed"})
    }

    // 更新下载计数（下载成功后）
    _, err = s.db.Exec("UPDATE shares SET download_count = download_count + 1 WHERE id = ?", share.ID)
    if err != nil {
        s.logger.Error("Failed to update download count", zap.Error(err))
    }

    return nil // 文件已在 proxyDownloadFromStorage 中直接写入响应
}

// proxyDownloadFromStorage 从存储服务代理下载文件
func (s *SharingService) proxyDownloadFromStorage(c echo.Context, fileID string) error {
    // 构建存储服务的内部 API URL（绕过网关）
    storageURL := fmt.Sprintf("%s/api/v1/storage/files/%s", s.storageServiceURL, fileID)
    
    // 生成服务间调用的 JWT token
    serviceToken, err := s.generateServiceToken()
    if err != nil {
        return fmt.Errorf("failed to generate service token: %w", err)
    }

    // 创建到存储服务的请求
    req, err := http.NewRequest("GET", storageURL, nil)
    if err != nil {
        return fmt.Errorf("failed to create request: %w", err)
    }

    // 设置服务间认证头
    req.Header.Set("Authorization", "Bearer "+serviceToken)
    req.Header.Set("X-Service-Request", "sharing-service")

    // 发送请求到存储服务
    resp, err := s.httpClient.Do(req)
    if err != nil {
        return fmt.Errorf("failed to request storage service: %w", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("storage service returned status %d", resp.StatusCode)
    }

    // 复制存储服务的响应头到当前响应
    for name, values := range resp.Header {
        for _, value := range values {
            c.Response().Header().Set(name, value)
        }
    }

    // 设置正确的状态码
    c.Response().WriteHeader(resp.StatusCode)

    // 流式复制文件内容
    _, err = io.Copy(c.Response().Writer, resp.Body)
    if err != nil {
        return fmt.Errorf("failed to copy file content: %w", err)
    }

    return nil
}

// generateServiceToken 生成服务间调用的 JWT token
func (s *SharingService) generateServiceToken() (string, error) {
    claims := jwt.MapClaims{
        "service": "sharing-service",
        "role":    "admin", // 服务间调用使用管理员权限
        "exp":     time.Now().Add(5 * time.Minute).Unix(), // 短期有效
        "iat":     time.Now().Unix(),
    }
    
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    return token.SignedString([]byte(s.jwtSecret))
}

// cleanupExpiredShares 清理过期的分享
func (s *SharingService) cleanupExpiredShares() {
    ticker := time.NewTicker(1 * time.Hour)
    defer ticker.Stop()

    for range ticker.C {
        result, err := s.db.Exec(`
            UPDATE shares SET is_active = 0
            WHERE is_active = 1 AND expires_at IS NOT NULL AND expires_at < ?
        `, time.Now())

        if err != nil {
            s.logger.Error("Failed to cleanup expired shares", zap.Error(err))
            continue
        }

        rowsAffected, _ := result.RowsAffected()
        if rowsAffected > 0 {
            s.logger.Info("Cleaned up expired shares", zap.Int64("count", rowsAffected))
        }
    }
}
