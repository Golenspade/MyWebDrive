package response

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"go.uber.org/zap"

	"mywebdrive/common/errors"
)

// Response 统一响应结构
type Response struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   *ErrorInfo  `json:"error,omitempty"`
}

// ErrorInfo 错误信息结构
type ErrorInfo struct {
	Code    errors.ErrorCode       `json:"code"`
	Message string                 `json:"message"`
	Details map[string]interface{} `json:"details,omitempty"`
}

// Success 返回成功响应
func Success(c echo.Context, data interface{}) error {
	return c.JSON(http.StatusOK, Response{
		Success: true,
		Data:    data,
	})
}

// Created 返回创建成功响应
func Created(c echo.Context, data interface{}) error {
	return c.JSON(http.StatusCreated, Response{
		Success: true,
		Data:    data,
	})
}

// NoContent 返回无内容响应
func NoContent(c echo.Context) error {
	return c.NoContent(http.StatusNoContent)
}

// Error 返回错误响应
func Error(c echo.Context, err *errors.AppError) error {
	response := Response{
		Success: false,
		Error: &ErrorInfo{
			Code:    err.Code,
			Message: err.Message,
			Details: err.Details,
		},
	}
	
	return c.JSON(err.HTTPStatus(), response)
}

// ErrorWithStatus 返回指定状态码的错误响应
func ErrorWithStatus(c echo.Context, status int, code errors.ErrorCode, message string) error {
	response := Response{
		Success: false,
		Error: &ErrorInfo{
			Code:    code,
			Message: message,
		},
	}
	
	return c.JSON(status, response)
}

// ErrorWithLogger 返回错误响应并记录日志
func ErrorWithLogger(c echo.Context, err *errors.AppError, logger *zap.Logger) error {
	// 记录内部错误日志
	if err.Cause != nil {
		logger.Error("Request failed",
			zap.String("error_code", string(err.Code)),
			zap.String("message", err.Message),
			zap.Error(err.Cause),
			zap.String("path", c.Request().URL.Path),
			zap.String("method", c.Request().Method),
			zap.String("remote_addr", c.RealIP()),
		)
	} else {
		logger.Warn("Request failed",
			zap.String("error_code", string(err.Code)),
			zap.String("message", err.Message),
			zap.String("path", c.Request().URL.Path),
			zap.String("method", c.Request().Method),
			zap.String("remote_addr", c.RealIP()),
		)
	}
	
	return Error(c, err)
}

// InternalError 返回内部服务器错误（用于兼容现有代码）
func InternalError(c echo.Context, message string) error {
	err := errors.Internal(message)
	return Error(c, err)
}

// BadRequest 返回请求错误（用于兼容现有代码）
func BadRequest(c echo.Context, message string) error {
	err := errors.InvalidRequest(message)
	return Error(c, err)
}

// NotFound 返回未找到错误（用于兼容现有代码）
func NotFound(c echo.Context, message string) error {
	err := errors.NotFound(message)
	return Error(c, err)
}

// Unauthorized 返回未授权错误（用于兼容现有代码）
func Unauthorized(c echo.Context, message string) error {
	err := errors.Unauthorized(message)
	return Error(c, err)
}

// Forbidden 返回禁止访问错误（用于兼容现有代码）
func Forbidden(c echo.Context, message string) error {
	err := errors.Forbidden(message)
	return Error(c, err)
}

// Conflict 返回冲突错误（用于兼容现有代码）
func Conflict(c echo.Context, message string) error {
	err := errors.Conflict(message)
	return Error(c, err)
}

// ValidationError 返回验证错误
func ValidationError(c echo.Context, message string, details map[string]interface{}) error {
	err := errors.Validation(message).WithDetails(details)
	return Error(c, err)
}