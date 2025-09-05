package main

import (
    "context"
    "crypto/md5"
    "database/sql"
    "encoding/hex"
    "fmt"
    "io"
    "net/http"
    "os"
    "os/signal"
    "path/filepath"
    "strconv"
    "strings"
    "time"

    "github.com/golang-jwt/jwt/v5"
    "github.com/google/uuid"
    "github.com/labstack/echo/v4"
    "github.com/labstack/echo/v4/middleware"
    _ "github.com/mattn/go-sqlite3"
    "github.com/minio/minio-go/v7"
    "github.com/minio/minio-go/v7/pkg/credentials"
    "go.uber.org/zap"

    "mywebdrive.local/pkg/config"
    "mywebdrive.local/pkg/database"
    "mywebdrive.local/pkg/metrics"
)

// UploadSession 上传会话
type UploadSession struct {
    ID         string    `json:"id"`
    FileName   string    `json:"fileName"`
    FileSize   int64     `json:"fileSize"`
    MimeType   string    `json:"mimeType"`
    ChunkSize  int64     `json:"chunkSize"`
    TotalChunks int      `json:"totalChunks"`
    UploadedChunks map[int]bool `json:"uploadedChunks"`
    OwnerID    string    `json:"ownerId"`
    CreatedAt  time.Time `json:"createdAt"`
    UpdatedAt  time.Time `json:"updatedAt"`
    ExpiresAt  time.Time `json:"expiresAt"`
    Status     string    `json:"status"` // "uploading", "completed", "failed"
    StoragePath string   `json:"storagePath,omitempty"`
    MD5Hash    string    `json:"md5Hash,omitempty"`
}

// CreateUploadRequest 创建上传请求
type CreateUploadRequest struct {
    FileName  string `json:"fileName" validate:"required"`
    FileSize  int64  `json:"fileSize" validate:"required,min=1"`
    MimeType  string `json:"mimeType"`
    ChunkSize int64  `json:"chunkSize,omitempty"`
}

// UploadChunkResponse 上传块响应
type UploadChunkResponse struct {
    ChunkIndex     int    `json:"chunkIndex"`
    UploadedChunks []int  `json:"uploadedChunks"`
    IsComplete     bool   `json:"isComplete"`
    FileURL        string `json:"fileUrl,omitempty"`
}

// StorageService 存储服务
type StorageService struct {
    jwtSecret         string
    logger            *zap.Logger
    db                *sql.DB
    metricsCollector  *metrics.MetricsCollector
    sessionManager    *UploadSessionManager // 线程安全的会话管理器
    minioClient       *minio.Client
    bucketName        string
    storagePath       string // 本地存储路径
    useMinIO          bool   // 是否使用MinIO
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

    storagePath := getEnvOrDefault("STORAGE_PATH", "./storage")
    
    // 初始化会话管理器
    sessionManager := NewUploadSessionManager(UploadSessionManagerConfig{
        Logger:        logger,
        StoragePath:   storagePath,
        CleanupPeriod: 30 * time.Minute, // 可配置
        SessionTTL:    24 * time.Hour,    // 可配置
    })

    // 初始化存储服务
    storageService := &StorageService{
        jwtSecret:         os.Getenv("JWT_SECRET"),
        logger:            logger,
        db:                db,
        metricsCollector:  metricsCollector,
        sessionManager:    sessionManager,
        bucketName:        getEnvOrDefault("MINIO_BUCKET", "mywebdrive"),
        storagePath:       storagePath,
        useMinIO:          os.Getenv("USE_MINIO") == "true",
    }

    // 初始化存储后端
    if err := storageService.initStorage(); err != nil {
        logger.Fatal("Failed to initialize storage", zap.Error(err))
    }

    // 创建Echo实例
    e := echo.New()

    // 中间件配置
    e.Use(middleware.Logger())
    e.Use(middleware.Recover())
    e.Use(middleware.CORS())

    // JWT中间件
    jwtMiddleware := middleware.JWTWithConfig(middleware.JWTConfig{
        SigningKey:  []byte(storageService.jwtSecret),
        TokenLookup: "header:Authorization",
        AuthScheme:  "Bearer",
    })

    // 路由设置
    e.GET("/health", healthCheck)

    api := e.Group("/api/v1/storage")
    api.Use(jwtMiddleware)

    // 上传相关路由 - 需要用户或管理员权限
    uploadGroup := api.Group("")
    uploadGroup.Use(storageService.RequireUploader)
    uploadGroup.POST("/uploads", storageService.CreateUpload)
    uploadGroup.PATCH("/uploads/:uploadId", storageService.UploadChunk)
    uploadGroup.HEAD("/uploads/:uploadId", storageService.GetUploadStatus)
    uploadGroup.POST("/uploads/:uploadId/finalize", storageService.FinalizeUpload)
    uploadGroup.DELETE("/uploads/:uploadId", storageService.CancelUpload)

    // 下载路由
    api.GET("/files/:fileId", storageService.DownloadFile)

    // 启动服务器
    go func() {
        if err := e.Start(":8084"); err != nil && err != http.ErrServerClosed {
            logger.Fatal("shutting down the server", zap.Error(err))
        }
    }()

    // 优雅关闭
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, os.Interrupt)
    <-quit
    
    logger.Info("Shutting down storage service...")
    
    // 关闭会话管理器
    sessionManager.Shutdown()
    
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()
    if err := e.Shutdown(ctx); err != nil {
        logger.Fatal("server shutdown failed", zap.Error(err))
    }
}

func healthCheck(c echo.Context) error {
    return c.JSON(http.StatusOK, map[string]string{
        "status":  "healthy",
        "service": "storage-service",
    })
}

// initStorage 初始化存储后端
func (s *StorageService) initStorage() error {
    if s.useMinIO {
        // 初始化MinIO客户端
        endpoint := getEnvOrDefault("MINIO_ENDPOINT", "localhost:9000")
        accessKey := os.Getenv("MINIO_ACCESS_KEY")
        secretKey := os.Getenv("MINIO_SECRET_KEY")
        useSSL := os.Getenv("MINIO_USE_SSL") == "true"

        if accessKey == "" || secretKey == "" {
            return fmt.Errorf("MinIO credentials not provided")
        }

        client, err := minio.New(endpoint, &minio.Options{
            Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
            Secure: useSSL,
        })
        if err != nil {
            return fmt.Errorf("failed to create MinIO client: %w", err)
        }

        s.minioClient = client

        // 确保存储桶存在
        ctx := context.Background()
        exists, err := client.BucketExists(ctx, s.bucketName)
        if err != nil {
            return fmt.Errorf("failed to check bucket existence: %w", err)
        }

        if !exists {
            err = client.MakeBucket(ctx, s.bucketName, minio.MakeBucketOptions{})
            if err != nil {
                return fmt.Errorf("failed to create bucket: %w", err)
            }
            s.logger.Info("Created MinIO bucket", zap.String("bucket", s.bucketName))
        }
    } else {
        // 确保本地存储目录存在
        if err := os.MkdirAll(s.storagePath, 0755); err != nil {
            return fmt.Errorf("failed to create storage directory: %w", err)
        }
        s.logger.Info("Using local storage", zap.String("path", s.storagePath))
    }

    return nil
}

// getUserID 从JWT中获取用户ID
func getUserID(c echo.Context) string {
    token := c.Get("user").(*jwt.Token)
    claims := token.Claims.(jwt.MapClaims)
    return claims["user_id"].(string)
}

// CreateUpload 创建上传会话
func (s *StorageService) CreateUpload(c echo.Context) error {
    userID := getUserID(c)

    var req CreateUploadRequest
    if err := c.Bind(&req); err != nil {
        return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
    }

    // 设置默认块大小（5MB）
    if req.ChunkSize == 0 {
        req.ChunkSize = 5 * 1024 * 1024
    }

    // 计算总块数
    totalChunks := int((req.FileSize + req.ChunkSize - 1) / req.ChunkSize)

    // 创建上传会话
    session := &UploadSession{
        ID:             uuid.New().String(),
        FileName:       req.FileName,
        FileSize:       req.FileSize,
        MimeType:       req.MimeType,
        ChunkSize:      req.ChunkSize,
        TotalChunks:    totalChunks,
        UploadedChunks: make(map[int]bool),
        OwnerID:        userID,
        CreatedAt:      time.Now(),
        UpdatedAt:      time.Now(),
        ExpiresAt:      time.Now().Add(24 * time.Hour), // 24小时过期
        Status:         "uploading",
    }

    s.sessionManager.Set(session.ID, session)

    s.logger.Info("Created upload session",
        zap.String("sessionId", session.ID),
        zap.String("fileName", req.FileName),
        zap.Int64("fileSize", req.FileSize),
        zap.Int("totalChunks", totalChunks))

    return c.JSON(http.StatusCreated, session)
}

// UploadChunk 上传文件块
func (s *StorageService) UploadChunk(c echo.Context) error {
    uploadID := c.Param("uploadId")
    session, exists := s.sessionManager.Get(uploadID)
    if !exists {
        return c.JSON(http.StatusNotFound, map[string]string{"error": "Upload session not found"})
    }

    // 会话管理器已经处理了过期检查

    // 验证用户权限
    userID := getUserID(c)
    if session.OwnerID != userID {
        return c.JSON(http.StatusForbidden, map[string]string{"error": "Access denied"})
    }

    // 获取块索引
    chunkIndexStr := c.FormValue("chunkIndex")
    chunkIndex, err := strconv.Atoi(chunkIndexStr)
    if err != nil || chunkIndex < 0 || chunkIndex >= session.TotalChunks {
        return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid chunk index"})
    }

    // 检查块是否已上传
    if session.UploadedChunks[chunkIndex] {
        return c.JSON(http.StatusOK, UploadChunkResponse{
            ChunkIndex:     chunkIndex,
            UploadedChunks: s.getUploadedChunksList(session),
            IsComplete:     len(session.UploadedChunks) == session.TotalChunks,
        })
    }

    // 读取文件数据
    file, err := c.FormFile("chunk")
    if err != nil {
        return c.JSON(http.StatusBadRequest, map[string]string{"error": "Failed to read chunk"})
    }

    src, err := file.Open()
    if err != nil {
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to open chunk"})
    }
    defer src.Close()

    // 保存块到临时位置
    chunkPath := filepath.Join(s.storagePath, "temp", uploadID, fmt.Sprintf("chunk_%d", chunkIndex))
    if err := os.MkdirAll(filepath.Dir(chunkPath), 0755); err != nil {
        s.logger.Error("Failed to create chunk directory", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to save chunk"})
    }

    dst, err := os.Create(chunkPath)
    if err != nil {
        s.logger.Error("Failed to create chunk file", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to save chunk"})
    }
    defer dst.Close()

    if _, err := io.Copy(dst, src); err != nil {
        s.logger.Error("Failed to write chunk", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to save chunk"})
    }

    // 标记块已上传
    session.UploadedChunks[chunkIndex] = true
    session.UpdatedAt = time.Now()
    
    // 更新会话活跃时间
    s.sessionManager.UpdateActivity(uploadID)

    uploadedChunks := s.getUploadedChunksList(session)
    isComplete := len(session.UploadedChunks) == session.TotalChunks

    s.logger.Info("Uploaded chunk",
        zap.String("sessionId", uploadID),
        zap.Int("chunkIndex", chunkIndex),
        zap.Int("uploadedChunks", len(uploadedChunks)),
        zap.Int("totalChunks", session.TotalChunks))

    return c.JSON(http.StatusOK, UploadChunkResponse{
        ChunkIndex:     chunkIndex,
        UploadedChunks: uploadedChunks,
        IsComplete:     isComplete,
    })
}

// GetUploadStatus 获取上传状态
func (s *StorageService) GetUploadStatus(c echo.Context) error {
    uploadID := c.Param("uploadId")
    session, exists := s.sessionManager.Get(uploadID)
    if !exists {
        return c.JSON(http.StatusNotFound, map[string]string{"error": "Upload session not found"})
    }

    // 验证用户权限
    userID := getUserID(c)
    if session.OwnerID != userID {
        return c.JSON(http.StatusForbidden, map[string]string{"error": "Access denied"})
    }

    return c.JSON(http.StatusOK, session)
}

// FinalizeUpload 完成上传
func (s *StorageService) FinalizeUpload(c echo.Context) error {
    uploadID := c.Param("uploadId")
    session, exists := s.sessionManager.Get(uploadID)
    if !exists {
        return c.JSON(http.StatusNotFound, map[string]string{"error": "Upload session not found"})
    }

    // 验证用户权限
    userID := getUserID(c)
    if session.OwnerID != userID {
        return c.JSON(http.StatusForbidden, map[string]string{"error": "Access denied"})
    }

    // 检查所有块是否已上传
    if len(session.UploadedChunks) != session.TotalChunks {
        return c.JSON(http.StatusBadRequest, map[string]string{"error": "Not all chunks uploaded"})
    }

    // 可选：从请求体读取期望的MD5以做校验
    var body struct {
        ExpectedMD5 string `json:"expectedMd5"`
    }
    _ = c.Bind(&body)

    // 合并文件块（可能上传到 MinIO）
    finalPath, md5Hash, err := s.mergeChunks(session)
    if err != nil {
        s.logger.Error("Failed to merge chunks", zap.Error(err))
        session.Status = "failed"
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to merge file"})
    }

    // 如果提供了期望MD5，则进行校验
    if body.ExpectedMD5 != "" && !strings.EqualFold(body.ExpectedMD5, md5Hash) {
        // 不删除分片，便于客户端纠正后重试 finalize
        session.Status = "failed"
        return c.JSON(http.StatusUnprocessableEntity, map[string]string{"error": "MD5 checksum mismatch"})
    }

    // 更新会话状态
    session.Status = "completed"
    session.StoragePath = finalPath
    session.MD5Hash = md5Hash
    session.UpdatedAt = time.Now()

    s.logger.Info("Finalized upload",
        zap.String("sessionId", uploadID),
        zap.String("fileName", session.FileName),
        zap.String("storagePath", finalPath))

    // 记录上传事件
    s.metricsCollector.RecordEvent(&metrics.Event{
        Service:   "storage",
        Type:      "upload",
        UserID:    userID,
        IP:        c.RealIP(),
        SizeBytes: session.FileSize,
        Attrs: map[string]interface{}{
            "upload_id":     uploadID,
            "file_name":     session.FileName,
            "mime_type":     session.MimeType,
            "storage_path":  finalPath,
            "md5_hash":      md5Hash,
            "total_chunks":  session.TotalChunks,
        },
    })

    return c.JSON(http.StatusOK, map[string]interface{}{
        "uploadId":    uploadID,
        "fileName":    session.FileName,
        "fileSize":    session.FileSize,
        "storagePath": finalPath,
        "md5Hash":     md5Hash,
        "status":      "completed",
        "fileId":      uploadID, // 添加fileId用于后续引用
    })
}

// CancelUpload 取消上传
func (s *StorageService) CancelUpload(c echo.Context) error {
    uploadID := c.Param("uploadId")
    session, exists := s.sessionManager.Get(uploadID)
    if !exists {
        return c.JSON(http.StatusNotFound, map[string]string{"error": "Upload session not found"})
    }

    // 验证用户权限
    userID := getUserID(c)
    if session.OwnerID != userID {
        return c.JSON(http.StatusForbidden, map[string]string{"error": "Access denied"})
    }

    // 删除会话（会话管理器会自动清理临时文件）
    s.sessionManager.Delete(uploadID)

    s.logger.Info("Cancelled upload", zap.String("sessionId", uploadID))

    return c.NoContent(http.StatusNoContent)
}

// DownloadFile 下载文件
func (s *StorageService) DownloadFile(c echo.Context) error {
    fileID := c.Param("fileId")
    
    // TODO: 从元数据服务获取文件信息和验证权限
    // 这里简化处理，实际应该调用元数据服务API
    
    filePath := filepath.Join(s.storagePath, "files", fileID)
    
    // 检查文件是否存在
    if _, err := os.Stat(filePath); os.IsNotExist(err) {
        return c.JSON(http.StatusNotFound, map[string]string{"error": "File not found"})
    }

    return c.File(filePath)
}

// mergeChunks 合并文件块
func (s *StorageService) mergeChunks(session *UploadSession) (string, string, error) {
    // 先合并到临时文件
    tempDir := filepath.Join(s.storagePath, "temp", session.ID)
    if err := os.MkdirAll(tempDir, 0755); err != nil {
        return "", "", err
    }
    tempMergedPath := filepath.Join(tempDir, "merged")

    mergedFile, err := os.Create(tempMergedPath)
    if err != nil {
        return "", "", err
    }
    defer mergedFile.Close()

    // 计算MD5哈希（边写边算）
    hasher := md5.New()
    writer := io.MultiWriter(mergedFile, hasher)

    // 按顺序合并所有块
    for i := 0; i < session.TotalChunks; i++ {
        chunkPath := filepath.Join(tempDir, fmt.Sprintf("chunk_%d", i))
        chunkFile, err := os.Open(chunkPath)
        if err != nil {
            return "", "", err
        }
        if _, err := io.Copy(writer, chunkFile); err != nil {
            chunkFile.Close()
            return "", "", err
        }
        chunkFile.Close()
    }

    // 计算最终MD5
    md5Hash := hex.EncodeToString(hasher.Sum(nil))

    // 提交到最终存储
    if s.useMinIO {
        // 上传到 MinIO
        ctx := context.Background()
        objectName := filepath.ToSlash(filepath.Join("files", session.ID))

        // 重新打开文件以供上传
        mergedForUpload, err := os.Open(tempMergedPath)
        if err != nil {
            return "", "", err
        }
        defer mergedForUpload.Close()

        // 确保存储桶存在（一般在初始化已处理）
        exists, err := s.minioClient.BucketExists(ctx, s.bucketName)
        if err != nil {
            return "", "", fmt.Errorf("failed to check bucket existence: %w", err)
        }
        if !exists {
            if err := s.minioClient.MakeBucket(ctx, s.bucketName, minio.MakeBucketOptions{}); err != nil {
                return "", "", fmt.Errorf("failed to create bucket: %w", err)
            }
        }

        // 执行上传
        _, err = s.minioClient.PutObject(ctx, s.bucketName, objectName, mergedForUpload, session.FileSize, minio.PutObjectOptions{
            ContentType: session.MimeType,
        })
        if err != nil {
            return "", "", fmt.Errorf("failed to upload to MinIO: %w", err)
        }

        // 清理临时目录
        os.RemoveAll(tempDir)

        finalPath := fmt.Sprintf("minio://%s/%s", s.bucketName, objectName)
        return finalPath, md5Hash, nil
    }

    // 本地存储：移动到 files 目录
    finalDir := filepath.Join(s.storagePath, "files")
    if err := os.MkdirAll(finalDir, 0755); err != nil {
        return "", "", err
    }
    finalPath := filepath.Join(finalDir, session.ID)

    if err := os.Rename(tempMergedPath, finalPath); err != nil {
        // 跨设备移动失败则改为复制
        src, err2 := os.Open(tempMergedPath)
        if err2 != nil {
            return "", "", err2
        }
        defer src.Close()
        dst, err2 := os.Create(finalPath)
        if err2 != nil {
            return "", "", err2
        }
        if _, err2 = io.Copy(dst, src); err2 != nil {
            dst.Close()
            return "", "", err2
        }
        dst.Close()
        os.Remove(tempMergedPath)
    }

    // 清理临时目录
    os.RemoveAll(tempDir)

    return finalPath, md5Hash, nil
}

// getUploadedChunksList 获取已上传块的列表
func (s *StorageService) getUploadedChunksList(session *UploadSession) []int {
    var chunks []int
    for i := 0; i < session.TotalChunks; i++ {
        if session.UploadedChunks[i] {
            chunks = append(chunks, i)
        }
    }
    return chunks
}

// cleanupExpiredSessions 已废弃，由 UploadSessionManager 处理
// 保留此函数以便回滚，生产环境中应删除

// RequireUploader 要求用户或管理员权限的中间件
func (s *StorageService) RequireUploader(next echo.HandlerFunc) echo.HandlerFunc {
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
        if !ok {
            // 如果没有角色信息，拒绝访问
            return echo.NewHTTPError(http.StatusForbidden, "Access denied: role information required")
        }

        // 只允许 user 和 admin 角色上传
        if role != "user" && role != "admin" {
            return echo.NewHTTPError(http.StatusForbidden, "Access denied: insufficient privileges")
        }

        return next(c)
    }
}

// getEnvOrDefault 获取环境变量或返回默认值
func getEnvOrDefault(key, defaultValue string) string {
    if value := os.Getenv(key); value != "" {
        return value
    }
    return defaultValue
}
