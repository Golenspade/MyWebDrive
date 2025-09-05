package main

import "fmt"

// ErrorCode 错误码类型
type ErrorCode string

const (
	ErrCodeInternal           ErrorCode = "INTERNAL_ERROR"
	ErrCodeInvalidCredentials ErrorCode = "INVALID_CREDENTIALS"
	ErrCodeInvalidToken       ErrorCode = "INVALID_TOKEN"
	ErrCodeInvalidInvite      ErrorCode = "INVALID_INVITATION"
	ErrCodeEmailExists        ErrorCode = "EMAIL_EXISTS"
	ErrCodeUserNotFound       ErrorCode = "USER_NOT_FOUND"
	ErrCodeNotFound           ErrorCode = "NOT_FOUND"
	ErrCodeValidation         ErrorCode = "VALIDATION_ERROR"
	ErrCodeConflict           ErrorCode = "CONFLICT"
)

// AuthError 认证服务错误
type AuthError struct {
	Code    ErrorCode
	Message string
	Cause   error
}

func (e *AuthError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("%s: %s (cause: %v)", e.Code, e.Message, e.Cause)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func NewAuthError(code ErrorCode, message string, cause error) *AuthError {
	return &AuthError{
		Code:    code,
		Message: message,
		Cause:   cause,
	}
}

// 特定错误类型
type NotFoundError struct {
	Message string
}

func (e *NotFoundError) Error() string {
	return e.Message
}

func NewNotFoundError(message string) *NotFoundError {
	return &NotFoundError{Message: message}
}

func IsNotFoundError(err error) bool {
	_, ok := err.(*NotFoundError)
	return ok
}

type ValidationError struct {
	Message string
}

func (e *ValidationError) Error() string {
	return e.Message
}

func NewValidationError(message string) *ValidationError {
	return &ValidationError{Message: message}
}

type ConflictError struct {
	Message string
}

func (e *ConflictError) Error() string {
	return e.Message
}

func NewConflictError(message string) *ConflictError {
	return &ConflictError{Message: message}
}