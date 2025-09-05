package errors

import (
	"fmt"
	"net/http"
)

// ErrorCode 错误码类型
type ErrorCode string

// 预定义错误码
const (
	// 通用错误码
	ErrCodeInternal       ErrorCode = "INTERNAL_ERROR"
	ErrCodeInvalidRequest ErrorCode = "INVALID_REQUEST"
	ErrCodeValidation     ErrorCode = "VALIDATION_ERROR"
	ErrCodeNotFound       ErrorCode = "NOT_FOUND"
	ErrCodeUnauthorized   ErrorCode = "UNAUTHORIZED"
	ErrCodeForbidden      ErrorCode = "FORBIDDEN"
	ErrCodeConflict       ErrorCode = "CONFLICT"
	
	// 业务错误码
	ErrCodeUserNotFound    ErrorCode = "USER_NOT_FOUND"
	ErrCodeFileNotFound    ErrorCode = "FILE_NOT_FOUND"
	ErrCodeInvalidToken    ErrorCode = "INVALID_TOKEN"
	ErrCodeExpiredToken    ErrorCode = "EXPIRED_TOKEN"
	ErrCodeInvalidPassword ErrorCode = "INVALID_PASSWORD"
	ErrCodeEmailExists     ErrorCode = "EMAIL_EXISTS"
	ErrCodeInvalidInvite   ErrorCode = "INVALID_INVITATION"
	ErrCodeQuotaExceeded   ErrorCode = "QUOTA_EXCEEDED"
	ErrCodeUploadFailed    ErrorCode = "UPLOAD_FAILED"
	ErrCodeDownloadFailed  ErrorCode = "DOWNLOAD_FAILED"
)

// AppError 应用错误类型
type AppError struct {
	Code    ErrorCode              `json:"code"`
	Message string                 `json:"message"`
	Details map[string]interface{} `json:"details,omitempty"`
	Cause   error                  `json:"-"` // 内部错误，不返回给客户端
}

// Error 实现 error 接口
func (e *AppError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("%s: %s (caused by: %v)", e.Code, e.Message, e.Cause)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// New 创建新的应用错误
func New(code ErrorCode, message string) *AppError {
	return &AppError{
		Code:    code,
		Message: message,
	}
}

// WithCause 添加原因错误
func (e *AppError) WithCause(cause error) *AppError {
	e.Cause = cause
	return e
}

// WithDetails 添加详细信息
func (e *AppError) WithDetails(details map[string]interface{}) *AppError {
	e.Details = details
	return e
}

// WithDetail 添加单个详细信息
func (e *AppError) WithDetail(key string, value interface{}) *AppError {
	if e.Details == nil {
		e.Details = make(map[string]interface{})
	}
	e.Details[key] = value
	return e
}

// 快捷创建错误的函数
func Internal(message string) *AppError {
	return New(ErrCodeInternal, message)
}

func InvalidRequest(message string) *AppError {
	return New(ErrCodeInvalidRequest, message)
}

func Validation(message string) *AppError {
	return New(ErrCodeValidation, message)
}

func NotFound(message string) *AppError {
	return New(ErrCodeNotFound, message)
}

func Unauthorized(message string) *AppError {
	return New(ErrCodeUnauthorized, message)
}

func Forbidden(message string) *AppError {
	return New(ErrCodeForbidden, message)
}

func Conflict(message string) *AppError {
	return New(ErrCodeConflict, message)
}

// 业务错误快捷函数
func UserNotFound() *AppError {
	return New(ErrCodeUserNotFound, "User not found")
}

func FileNotFound() *AppError {
	return New(ErrCodeFileNotFound, "File not found")
}

func InvalidToken() *AppError {
	return New(ErrCodeInvalidToken, "Invalid or expired token")
}

func InvalidPassword() *AppError {
	return New(ErrCodeInvalidPassword, "Invalid password")
}

func EmailExists() *AppError {
	return New(ErrCodeEmailExists, "Email already exists")
}

func InvalidInvite() *AppError {
	return New(ErrCodeInvalidInvite, "Invalid or expired invitation code")
}

func QuotaExceeded() *AppError {
	return New(ErrCodeQuotaExceeded, "Storage quota exceeded")
}

// HTTPStatus 返回对应的HTTP状态码
func (e *AppError) HTTPStatus() int {
	switch e.Code {
	case ErrCodeInvalidRequest, ErrCodeValidation:
		return http.StatusBadRequest
	case ErrCodeUnauthorized, ErrCodeInvalidToken, ErrCodeExpiredToken:
		return http.StatusUnauthorized
	case ErrCodeForbidden:
		return http.StatusForbidden
	case ErrCodeNotFound, ErrCodeUserNotFound, ErrCodeFileNotFound:
		return http.StatusNotFound
	case ErrCodeConflict, ErrCodeEmailExists:
		return http.StatusConflict
	case ErrCodeQuotaExceeded:
		return http.StatusPaymentRequired
	default:
		return http.StatusInternalServerError
	}
}