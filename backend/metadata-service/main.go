package main

import (
    "context"
    "database/sql"
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

// FileType 文件类型
type FileType string

const (
    TypeFile   FileType = "file"
    TypeFolder FileType = "folder"
)

// FileMetadata 文件元数据
type FileMetadata struct {
    ID        string    `json:"id"`
    Name      string    `json:"name"`
    Type      FileType  `json:"type"`
    Size      int64     `json:"size,omitempty"`
    MimeType  string    `json:"mimeType,omitempty"`
    ParentID  *string   `json:"parentId"`
    OwnerID   string    `json:"ownerId"`
    Path      string    `json:"path"`
    Version   int       `json:"version"`
    CreatedAt time.Time `json:"createdAt"`
    UpdatedAt time.Time `json:"updatedAt"`
    DeletedAt *time.Time `json:"deletedAt,omitempty"`
}

// CreateFolderRequest 创建文件夹请求
type CreateFolderRequest struct {
    Name     string  `json:"name" validate:"required,min=1,max=255"`
    ParentID *string `json:"parentId"`
}

// MoveRequest 移动文件/文件夹请求
type MoveRequest struct {
    NewParentID *string `json:"newParentId"`
}

// ListResponse 列表响应
type ListResponse struct {
    Items      []FileMetadata `json:"items"`
    NextCursor *string        `json:"nextCursor"`
}

// MetadataService 元数据服务
type MetadataService struct {
    db        *sql.DB
    jwtSecret string
    logger    *zap.Logger
}

func main() {
    // 初始化日志
    logger, _ := zap.NewProduction()
    defer logger.Sync()

    // 连接数据库
    dbPath := os.Getenv("DATABASE_PATH")
    if dbPath == "" {
        dbPath = "./metadata.db"
    }
    db, err := sql.Open("sqlite3", dbPath)
    if err != nil {
        logger.Fatal("Failed to connect to database", zap.Error(err))
    }
    defer db.Close()

    // 创建服务实例
    metadataService := &MetadataService{
        db:        db,
        jwtSecret: os.Getenv("JWT_SECRET"),
        logger:    logger,
    }

    // 创建Echo实例
    e := echo.New()

    // 中间件配置
    e.Use(middleware.Logger())
    e.Use(middleware.Recover())
    e.Use(middleware.CORS())

    // JWT中间件
    jwtMiddleware := middleware.JWTWithConfig(middleware.JWTConfig{
        SigningKey:  []byte(metadataService.jwtSecret),
        TokenLookup: "header:Authorization",
        AuthScheme:  "Bearer",
    })

    // 路由设置
    e.GET("/health", healthCheck)

    api := e.Group("/api/v1")
    api.Use(jwtMiddleware)

    // 文件夹路由
    api.POST("/folders", metadataService.CreateFolder)
    api.GET("/folders/:folderId/children", metadataService.ListFolderContents)
    api.PATCH("/folders/:folderId", metadataService.UpdateFolder)
    api.DELETE("/folders/:folderId", metadataService.DeleteFolder)
    api.POST("/folders/:folderId/move", metadataService.MoveFolder)

    // 文件路由
    api.GET("/files/:fileId", metadataService.GetFile)
    api.PATCH("/files/:fileId", metadataService.UpdateFile)
    api.DELETE("/files/:fileId", metadataService.DeleteFile)
    api.POST("/files/:fileId/move", metadataService.MoveFile)
    api.GET("/files/:fileId/versions", metadataService.ListFileVersions)
    api.POST("/files/:fileId/versions/:versionId/restore", metadataService.RestoreFileVersion)

    // 启动服务器
    go func() {
        if err := e.Start(":8083"); err != nil && err != http.ErrServerClosed {
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
        "service": "metadata-service",
    })
}

// getUserID 从JWT中获取用户ID
func getUserID(c echo.Context) string {
    token := c.Get("user").(*jwt.Token)
    claims := token.Claims.(jwt.MapClaims)
    return claims["user_id"].(string)
}

// CreateFolder 创建文件夹
func (s *MetadataService) CreateFolder(c echo.Context) error {
    userID := getUserID(c)

    var req CreateFolderRequest
    if err := c.Bind(&req); err != nil {
        return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
    }

    // 检查父文件夹是否存在
    if req.ParentID != nil {
        var exists bool
        err := s.db.QueryRow(`
            SELECT EXISTS(SELECT 1 FROM files WHERE id = ? AND type = 'folder' AND owner_id = ? AND deleted_at IS NULL)
        `, *req.ParentID, userID).Scan(&exists)
        if err != nil || !exists {
            return c.JSON(http.StatusNotFound, map[string]string{"error": "Parent folder not found"})
        }
    }

    // 检查同名文件夹
    var exists bool
    query := `SELECT EXISTS(SELECT 1 FROM files WHERE name = ? AND parent_id = ? AND owner_id = ? AND deleted_at IS NULL)`
    if req.ParentID == nil {
        query = `SELECT EXISTS(SELECT 1 FROM files WHERE name = ? AND parent_id IS NULL AND owner_id = ? AND deleted_at IS NULL)`
        err := s.db.QueryRow(query, req.Name, userID).Scan(&exists)
        if err != nil {
            s.logger.Error("Database error", zap.Error(err))
            return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
        }
    } else {
        err := s.db.QueryRow(query, req.Name, *req.ParentID, userID).Scan(&exists)
        if err != nil {
            s.logger.Error("Database error", zap.Error(err))
            return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
        }
    }

    if exists {
        return c.JSON(http.StatusBadRequest, map[string]string{"error": "Folder with the same name already exists"})
    }

    // 创建文件夹
    folderID := uuid.New().String()
    now := time.Now()

    // 计算路径
    var path string
    if req.ParentID == nil {
        path = "/" + req.Name
    } else {
        var parentPath string
        err := s.db.QueryRow("SELECT path FROM files WHERE id = ?", *req.ParentID).Scan(&parentPath)
        if err != nil {
            s.logger.Error("Failed to get parent path", zap.Error(err))
            return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create folder"})
        }
        path = parentPath + "/" + req.Name
    }

    _, err := s.db.Exec(`
        INSERT INTO files (id, name, type, parent_id, owner_id, path, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, folderID, req.Name, TypeFolder, req.ParentID, userID, path, now, now)

    if err != nil {
        s.logger.Error("Failed to create folder", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create folder"})
    }

    return c.JSON(http.StatusCreated, FileMetadata{
        ID:        folderID,
        Name:      req.Name,
        Type:      TypeFolder,
        ParentID:  req.ParentID,
        OwnerID:   userID,
        Path:      path,
        CreatedAt: now,
        UpdatedAt: now,
    })
}

// ListFolderContents 列出文件夹内容
func (s *MetadataService) ListFolderContents(c echo.Context) error {
    userID := getUserID(c)
    folderID := c.Param("folderId")
    
    // 如果folderID是"root"，则查询根目录
    var query string
    var args []interface{}
    
    if folderID == "root" {
        query = `
            SELECT id, name, type, size, mime_type, parent_id, path, version, created_at, updated_at
            FROM files
            WHERE parent_id IS NULL AND owner_id = ? AND deleted_at IS NULL
            ORDER BY type DESC, name ASC
            LIMIT 50
        `
        args = []interface{}{userID}
    } else {
        // 验证文件夹所有权
        var exists bool
        err := s.db.QueryRow(`
            SELECT EXISTS(SELECT 1 FROM files WHERE id = ? AND type = 'folder' AND owner_id = ? AND deleted_at IS NULL)
        `, folderID, userID).Scan(&exists)
        if err != nil || !exists {
            return c.JSON(http.StatusNotFound, map[string]string{"error": "Folder not found"})
        }

        query = `
            SELECT id, name, type, size, mime_type, parent_id, path, version, created_at, updated_at
            FROM files
            WHERE parent_id = ? AND owner_id = ? AND deleted_at IS NULL
            ORDER BY type DESC, name ASC
            LIMIT 50
        `
        args = []interface{}{folderID, userID}
    }

    rows, err := s.db.Query(query, args...)
    if err != nil {
        s.logger.Error("Failed to list folder contents", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to list folder contents"})
    }
    defer rows.Close()

    var items []FileMetadata
    for rows.Next() {
        var item FileMetadata
        var size, version sql.NullInt64
        var mimeType sql.NullString
        var parentID sql.NullString

        err := rows.Scan(
            &item.ID, &item.Name, &item.Type, &size, &mimeType,
            &parentID, &item.Path, &version, &item.CreatedAt, &item.UpdatedAt,
        )
        if err != nil {
            s.logger.Error("Failed to scan row", zap.Error(err))
            continue
        }

        if size.Valid {
            item.Size = size.Int64
        }
        if mimeType.Valid {
            item.MimeType = mimeType.String
        }
        if parentID.Valid {
            item.ParentID = &parentID.String
        }
        if version.Valid {
            item.Version = int(version.Int64)
        }
        item.OwnerID = userID

        items = append(items, item)
    }

    return c.JSON(http.StatusOK, ListResponse{
        Items:      items,
        NextCursor: nil, // TODO: 实现分页
    })
}

// GetFile 获取文件信息
func (s *MetadataService) GetFile(c echo.Context) error {
    userID := getUserID(c)
    fileID := c.Param("fileId")

    var file FileMetadata
    var size, version sql.NullInt64
    var mimeType sql.NullString
    var parentID sql.NullString

    err := s.db.QueryRow(`
        SELECT id, name, type, size, mime_type, parent_id, path, version, created_at, updated_at
        FROM files
        WHERE id = ? AND owner_id = ? AND deleted_at IS NULL
    `, fileID, userID).Scan(
        &file.ID, &file.Name, &file.Type, &size, &mimeType,
        &parentID, &file.Path, &version, &file.CreatedAt, &file.UpdatedAt,
    )

    if err != nil {
        if err == sql.ErrNoRows {
            return c.JSON(http.StatusNotFound, map[string]string{"error": "File not found"})
        }
        s.logger.Error("Database error", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
    }

    if size.Valid {
        file.Size = size.Int64
    }
    if mimeType.Valid {
        file.MimeType = mimeType.String
    }
    if parentID.Valid {
        file.ParentID = &parentID.String
    }
    if version.Valid {
        file.Version = int(version.Int64)
    }
    file.OwnerID = userID

    return c.JSON(http.StatusOK, file)
}

// UpdateFile 更新文件
func (s *MetadataService) UpdateFile(c echo.Context) error {
    userID := getUserID(c)
    fileID := c.Param("fileId")

    var req struct {
        Name string `json:"name"`
    }
    if err := c.Bind(&req); err != nil {
        return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
    }

    result, err := s.db.Exec(`
        UPDATE files SET name = ?, updated_at = ?
        WHERE id = ? AND owner_id = ? AND type = 'file' AND deleted_at IS NULL
    `, req.Name, time.Now(), fileID, userID)

    if err != nil {
        s.logger.Error("Failed to update file", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to update file"})
    }

    rowsAffected, _ := result.RowsAffected()
    if rowsAffected == 0 {
        return c.JSON(http.StatusNotFound, map[string]string{"error": "File not found"})
    }

    return s.GetFile(c)
}

// UpdateFolder 更新文件夹
func (s *MetadataService) UpdateFolder(c echo.Context) error {
    userID := getUserID(c)
    folderID := c.Param("folderId")

    var req struct {
        Name string `json:"name"`
    }
    if err := c.Bind(&req); err != nil {
        return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
    }

    result, err := s.db.Exec(`
        UPDATE files SET name = ?, updated_at = ?
        WHERE id = ? AND owner_id = ? AND type = 'folder' AND deleted_at IS NULL
    `, req.Name, time.Now(), folderID, userID)

    if err != nil {
        s.logger.Error("Failed to update folder", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to update folder"})
    }

    rowsAffected, _ := result.RowsAffected()
    if rowsAffected == 0 {
        return c.JSON(http.StatusNotFound, map[string]string{"error": "Folder not found"})
    }

    return c.NoContent(http.StatusNoContent)
}

// DeleteFile 删除文件（软删除）
func (s *MetadataService) DeleteFile(c echo.Context) error {
    userID := getUserID(c)
    fileID := c.Param("fileId")

    result, err := s.db.Exec(`
        UPDATE files SET deleted_at = ?
        WHERE id = ? AND owner_id = ? AND type = 'file' AND deleted_at IS NULL
    `, time.Now(), fileID, userID)

    if err != nil {
        s.logger.Error("Failed to delete file", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to delete file"})
    }

    rowsAffected, _ := result.RowsAffected()
    if rowsAffected == 0 {
        return c.JSON(http.StatusNotFound, map[string]string{"error": "File not found"})
    }

    return c.NoContent(http.StatusNoContent)
}

// DeleteFolder 删除文件夹（软删除）
func (s *MetadataService) DeleteFolder(c echo.Context) error {
    userID := getUserID(c)
    folderID := c.Param("folderId")

    // 使用递归CTE删除文件夹及其所有子内容
    _, err := s.db.Exec(`
        WITH RECURSIVE folder_tree AS (
            SELECT id FROM files WHERE id = ? AND owner_id = ? AND type = 'folder'
            UNION ALL
            SELECT f.id FROM files f
            INNER JOIN folder_tree ft ON f.parent_id = ft.id
        )
        UPDATE files SET deleted_at = ?
        WHERE id IN (SELECT id FROM folder_tree) AND deleted_at IS NULL
    `, folderID, userID, time.Now())

    if err != nil {
        s.logger.Error("Failed to delete folder", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to delete folder"})
    }

    return c.NoContent(http.StatusNoContent)
}

// MoveFile 移动文件
func (s *MetadataService) MoveFile(c echo.Context) error {
    userID := getUserID(c)
    fileID := c.Param("fileId")

    var req MoveRequest
    if err := c.Bind(&req); err != nil {
        return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
    }

    // 验证新父文件夹
    if req.NewParentID != nil {
        var exists bool
        err := s.db.QueryRow(`
            SELECT EXISTS(SELECT 1 FROM files WHERE id = ? AND type = 'folder' AND owner_id = ? AND deleted_at IS NULL)
        `, *req.NewParentID, userID).Scan(&exists)
        if err != nil || !exists {
            return c.JSON(http.StatusNotFound, map[string]string{"error": "Target folder not found"})
        }
    }

    result, err := s.db.Exec(`
        UPDATE files SET parent_id = ?, updated_at = ?
        WHERE id = ? AND owner_id = ? AND type = 'file' AND deleted_at IS NULL
    `, req.NewParentID, time.Now(), fileID, userID)

    if err != nil {
        s.logger.Error("Failed to move file", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to move file"})
    }

    rowsAffected, _ := result.RowsAffected()
    if rowsAffected == 0 {
        return c.JSON(http.StatusNotFound, map[string]string{"error": "File not found"})
    }

    return c.NoContent(http.StatusNoContent)
}

// MoveFolder 移动文件夹
func (s *MetadataService) MoveFolder(c echo.Context) error {
    userID := getUserID(c)
    folderID := c.Param("folderId")

    var req MoveRequest
    if err := c.Bind(&req); err != nil {
        return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
    }

    // 防止移动到自己或子文件夹
    if req.NewParentID != nil && *req.NewParentID == folderID {
        return c.JSON(http.StatusBadRequest, map[string]string{"error": "Cannot move folder to itself"})
    }

    // TODO: 检查是否移动到子文件夹（需要递归查询）

    result, err := s.db.Exec(`
        UPDATE files SET parent_id = ?, updated_at = ?
        WHERE id = ? AND owner_id = ? AND type = 'folder' AND deleted_at IS NULL
    `, req.NewParentID, time.Now(), folderID, userID)

    if err != nil {
        s.logger.Error("Failed to move folder", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to move folder"})
    }

    rowsAffected, _ := result.RowsAffected()
    if rowsAffected == 0 {
        return c.JSON(http.StatusNotFound, map[string]string{"error": "Folder not found"})
    }

    return c.NoContent(http.StatusNoContent)
}

// FileVersion 文件版本
type FileVersion struct {
    ID          string    `json:"id"`
    FileID      string    `json:"fileId"`
    Version     int       `json:"version"`
    Size        int64     `json:"size"`
    StoragePath string    `json:"storagePath"`
    MD5Hash     string    `json:"md5Hash"`
    Comment     string    `json:"comment"`
    CreatedAt   time.Time `json:"createdAt"`
}

// ListFileVersions 列出文件版本
func (s *MetadataService) ListFileVersions(c echo.Context) error {
    userID := getUserID(c)
    fileID := c.Param("fileId")

    // 验证文件所有权
    var ownerID string
    err := s.db.QueryRow("SELECT owner_id FROM files WHERE id = ? AND deleted_at IS NULL", fileID).Scan(&ownerID)
    if err != nil {
        if err == sql.ErrNoRows {
            return c.JSON(http.StatusNotFound, map[string]string{"error": "File not found"})
        }
        s.logger.Error("Database error", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
    }

    if ownerID != userID {
        return c.JSON(http.StatusForbidden, map[string]string{"error": "Access denied"})
    }

    // 查询文件版本历史
    rows, err := s.db.Query(`
        SELECT id, file_id, version, size, storage_path, md5_hash, comment, created_at
        FROM file_versions
        WHERE file_id = ?
        ORDER BY version DESC
        LIMIT 20
    `, fileID)

    if err != nil {
        s.logger.Error("Failed to list file versions", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to list versions"})
    }
    defer rows.Close()

    var versions []FileVersion
    for rows.Next() {
        var version FileVersion
        var comment sql.NullString

        err := rows.Scan(
            &version.ID, &version.FileID, &version.Version,
            &version.Size, &version.StoragePath, &version.MD5Hash,
            &comment, &version.CreatedAt,
        )
        if err != nil {
            s.logger.Error("Failed to scan version row", zap.Error(err))
            continue
        }

        if comment.Valid {
            version.Comment = comment.String
        }

        versions = append(versions, version)
    }

    return c.JSON(http.StatusOK, map[string]interface{}{
        "versions": versions,
    })
}

// RestoreFileVersion 恢复文件版本
func (s *MetadataService) RestoreFileVersion(c echo.Context) error {
    userID := getUserID(c)
    fileID := c.Param("fileId")
    versionID := c.Param("versionId")

    // 验证文件所有权
    var ownerID string
    err := s.db.QueryRow("SELECT owner_id FROM files WHERE id = ? AND deleted_at IS NULL", fileID).Scan(&ownerID)
    if err != nil {
        if err == sql.ErrNoRows {
            return c.JSON(http.StatusNotFound, map[string]string{"error": "File not found"})
        }
        s.logger.Error("Database error", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
    }

    if ownerID != userID {
        return c.JSON(http.StatusForbidden, map[string]string{"error": "Access denied"})
    }

    // 获取要恢复的版本信息
    var version FileVersion
    err = s.db.QueryRow(`
        SELECT id, file_id, version, size, storage_path, md5_hash
        FROM file_versions
        WHERE id = ? AND file_id = ?
    `, versionID, fileID).Scan(
        &version.ID, &version.FileID, &version.Version,
        &version.Size, &version.StoragePath, &version.MD5Hash,
    )

    if err != nil {
        if err == sql.ErrNoRows {
            return c.JSON(http.StatusNotFound, map[string]string{"error": "Version not found"})
        }
        s.logger.Error("Failed to get version info", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to restore version"})
    }

    // 开始事务
    tx, err := s.db.Begin()
    if err != nil {
        s.logger.Error("Failed to begin transaction", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to restore version"})
    }
    defer tx.Rollback()

    // 获取当前文件信息，准备创建新版本
    var currentVersion int
    var currentSize int64
    var currentStoragePath, currentMD5Hash sql.NullString

    err = tx.QueryRow(`
        SELECT version, size, storage_path, md5_hash
        FROM files
        WHERE id = ?
    `, fileID).Scan(&currentVersion, &currentSize, &currentStoragePath, &currentMD5Hash)

    if err != nil {
        s.logger.Error("Failed to get current file info", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to restore version"})
    }

    // 保存当前版本到历史记录
    if currentStoragePath.Valid && currentMD5Hash.Valid {
        _, err = tx.Exec(`
            INSERT INTO file_versions (id, file_id, version, size, storage_path, md5_hash, comment, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, uuid.New().String(), fileID, currentVersion, currentSize, currentStoragePath.String, currentMD5Hash.String, "Auto-backup before restore", time.Now())

        if err != nil {
            s.logger.Error("Failed to create version backup", zap.Error(err))
            return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to restore version"})
        }
    }

    // 更新文件为指定版本
    newVersion := currentVersion + 1
    _, err = tx.Exec(`
        UPDATE files 
        SET version = ?, size = ?, storage_path = ?, md5_hash = ?, updated_at = ?
        WHERE id = ?
    `, newVersion, version.Size, version.StoragePath, version.MD5Hash, time.Now(), fileID)

    if err != nil {
        s.logger.Error("Failed to update file", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to restore version"})
    }

    // 提交事务
    if err = tx.Commit(); err != nil {
        s.logger.Error("Failed to commit transaction", zap.Error(err))
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to restore version"})
    }

    s.logger.Info("File version restored",
        zap.String("fileId", fileID),
        zap.String("versionId", versionID),
        zap.Int("newVersion", newVersion))

    return c.JSON(http.StatusOK, map[string]interface{}{
        "message":    "Version restored successfully",
        "newVersion": newVersion,
    })
}
