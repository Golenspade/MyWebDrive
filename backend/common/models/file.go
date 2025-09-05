package models

import "time"

// FileType 文件类型
type FileType string

const (
    TypeFile   FileType = "file"
    TypeFolder FileType = "folder"
)

// FileMetadata 文件元数据
type FileMetadata struct {
    ID        string     `json:"id" db:"id"`
    Name      string     `json:"name" db:"name"`
    Type      FileType   `json:"type" db:"type"`
    Size      int64      `json:"size,omitempty" db:"size"`
    MimeType  string     `json:"mimeType,omitempty" db:"mime_type"`
    ParentID  *string    `json:"parentId" db:"parent_id"`
    OwnerID   string     `json:"ownerId" db:"owner_id"`
    Path      string     `json:"path" db:"path"`
    Version   int        `json:"version" db:"version"`
    StoragePath *string  `json:"storagePath,omitempty" db:"storage_path"`
    MD5Hash   *string    `json:"md5Hash,omitempty" db:"md5_hash"`
    CreatedAt time.Time  `json:"createdAt" db:"created_at"`
    UpdatedAt time.Time  `json:"updatedAt" db:"updated_at"`
    DeletedAt *time.Time `json:"deletedAt,omitempty" db:"deleted_at"`
}

// CreateFolderRequest 创建文件夹请求
type CreateFolderRequest struct {
    Name     string  `json:"name" validate:"required,min=1,max=255"`
    ParentID *string `json:"parentId"`
}

// CreateFileRequest 创建文件请求
type CreateFileRequest struct {
    Name        string  `json:"name" validate:"required,min=1,max=255"`
    Size        int64   `json:"size" validate:"required,min=1"`
    MimeType    string  `json:"mimeType"`
    ParentID    *string `json:"parentId"`
    StoragePath string  `json:"storagePath" validate:"required"`
    MD5Hash     string  `json:"md5Hash" validate:"required"`
}

// UpdateFileRequest 更新文件请求
type UpdateFileRequest struct {
    Name *string `json:"name,omitempty" validate:"omitempty,min=1,max=255"`
}

// MoveRequest 移动文件/文件夹请求
type MoveRequest struct {
    NewParentID *string `json:"newParentId"`
}

// ListResponse 列表响应
type ListResponse struct {
    Items      []FileMetadata `json:"items"`
    NextCursor *string        `json:"nextCursor"`
    Total      int            `json:"total"`
}
