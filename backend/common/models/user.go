package models

import "time"

// User 用户模型
type User struct {
    ID           string    `json:"id" db:"id"`
    Name         string    `json:"name" db:"name"`
    Email        string    `json:"email" db:"email"`
    Password     string    `json:"-" db:"password"`
    StorageQuota int64     `json:"storageQuota" db:"storage_quota"`
    StorageUsed  int64     `json:"storageUsed" db:"storage_used"`
    CreatedAt    time.Time `json:"createdAt" db:"created_at"`
    UpdatedAt    time.Time `json:"updatedAt" db:"updated_at"`
}

// UserCreateRequest 用户创建请求
type UserCreateRequest struct {
    Name     string `json:"name" validate:"required,min=2,max=100"`
    Email    string `json:"email" validate:"required,email"`
    Password string `json:"password" validate:"required,min=8"`
}

// UserUpdateRequest 用户更新请求
type UserUpdateRequest struct {
    Name            *string `json:"name,omitempty" validate:"omitempty,min=2,max=100"`
    CurrentPassword string  `json:"currentPassword,omitempty"`
    NewPassword     string  `json:"newPassword,omitempty" validate:"omitempty,min=8"`
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

// RefreshTokenRequest 刷新令牌请求
type RefreshTokenRequest struct {
    RefreshToken string `json:"refreshToken" validate:"required"`
}
