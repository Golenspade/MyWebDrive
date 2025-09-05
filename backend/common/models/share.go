package models

import "time"

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
    ID            string          `json:"id" db:"id"`
    FileID        string          `json:"fileId" db:"file_id"`
    OwnerID       string          `json:"ownerId" db:"owner_id"`
    ShareToken    string          `json:"shareToken" db:"share_token"`
    ShareType     ShareType       `json:"shareType" db:"share_type"`
    Permission    SharePermission `json:"permission" db:"permission"`
    Password      *string         `json:"password,omitempty" db:"password"`
    ExpiresAt     *time.Time      `json:"expiresAt" db:"expires_at"`
    MaxDownloads  *int            `json:"maxDownloads" db:"max_downloads"`
    DownloadCount int             `json:"downloadCount" db:"download_count"`
    IsActive      bool            `json:"isActive" db:"is_active"`
    CreatedAt     time.Time       `json:"createdAt" db:"created_at"`
    UpdatedAt     time.Time       `json:"updatedAt" db:"updated_at"`
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
    ID              string          `json:"id"`
    FileID          string          `json:"fileId"`
    FileName        string          `json:"fileName"`
    FileSize        int64           `json:"fileSize"`
    MimeType        string          `json:"mimeType"`
    ShareType       ShareType       `json:"shareType"`
    Permission      SharePermission `json:"permission"`
    RequirePassword bool            `json:"requirePassword"`
    ExpiresAt       *time.Time      `json:"expiresAt"`
    MaxDownloads    *int            `json:"maxDownloads"`
    DownloadCount   int             `json:"downloadCount"`
    CreatedAt       time.Time       `json:"createdAt"`
}
