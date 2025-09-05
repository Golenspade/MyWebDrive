package utils

import (
    "net/http"

    "github.com/labstack/echo/v4"
)

// APIResponse 标准API响应
type APIResponse struct {
    Success bool        `json:"success"`
    Data    interface{} `json:"data,omitempty"`
    Error   *APIError   `json:"error,omitempty"`
}

// APIError API错误
type APIError struct {
    Code    string `json:"code"`
    Message string `json:"message"`
    Details string `json:"details,omitempty"`
}

// SuccessResponse 成功响应
func SuccessResponse(c echo.Context, data interface{}) error {
    return c.JSON(http.StatusOK, APIResponse{
        Success: true,
        Data:    data,
    })
}

// ErrorResponse 错误响应
func ErrorResponse(c echo.Context, statusCode int, code, message string, details ...string) error {
    apiError := &APIError{
        Code:    code,
        Message: message,
    }
    
    if len(details) > 0 {
        apiError.Details = details[0]
    }

    return c.JSON(statusCode, APIResponse{
        Success: false,
        Error:   apiError,
    })
}

// ValidationErrorResponse 验证错误响应
func ValidationErrorResponse(c echo.Context, message string) error {
    return ErrorResponse(c, http.StatusBadRequest, "VALIDATION_ERROR", message)
}

// NotFoundErrorResponse 未找到错误响应
func NotFoundErrorResponse(c echo.Context, resource string) error {
    return ErrorResponse(c, http.StatusNotFound, "NOT_FOUND", resource+" not found")
}

// UnauthorizedErrorResponse 未授权错误响应
func UnauthorizedErrorResponse(c echo.Context, message string) error {
    if message == "" {
        message = "Unauthorized access"
    }
    return ErrorResponse(c, http.StatusUnauthorized, "UNAUTHORIZED", message)
}

// ForbiddenErrorResponse 禁止访问错误响应
func ForbiddenErrorResponse(c echo.Context, message string) error {
    if message == "" {
        message = "Access forbidden"
    }
    return ErrorResponse(c, http.StatusForbidden, "FORBIDDEN", message)
}

// InternalErrorResponse 内部错误响应
func InternalErrorResponse(c echo.Context, message string) error {
    if message == "" {
        message = "Internal server error"
    }
    return ErrorResponse(c, http.StatusInternalServerError, "INTERNAL_ERROR", message)
}

// ConflictErrorResponse 冲突错误响应
func ConflictErrorResponse(c echo.Context, message string) error {
    return ErrorResponse(c, http.StatusConflict, "CONFLICT", message)
}
