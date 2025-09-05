package main

import (
	"net/http"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
)

// AuthHandler 认证处理器
type AuthHandler struct {
	authService AuthServiceInterface
	logger      *zap.Logger
}

// NewAuthHandler 创建认证处理器实例
func NewAuthHandler(authService AuthServiceInterface, logger *zap.Logger) *AuthHandler {
	return &AuthHandler{
		authService: authService,
		logger:      logger,
	}
}

// Register 用户注册处理器
func (h *AuthHandler) Register(c echo.Context) error {
	var req RegisterRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	// 验证请求数据
	if err := c.Validate(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Validation failed: " + err.Error()})
	}

	// 调用业务服务
	user, err := h.authService.Register(req)
	if err != nil {
		return h.handleError(c, err)
	}

	return c.JSON(http.StatusCreated, user)
}

// Login 用户登录处理器
func (h *AuthHandler) Login(c echo.Context) error {
	var req LoginRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	// 验证请求数据
	if err := c.Validate(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Validation failed: " + err.Error()})
	}

	// 调用业务服务
	tokens, err := h.authService.Login(req)
	if err != nil {
		return h.handleError(c, err)
	}

	return c.JSON(http.StatusOK, tokens)
}

// Refresh 刷新令牌处理器
func (h *AuthHandler) Refresh(c echo.Context) error {
	var req struct {
		RefreshToken string `json:"refreshToken"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	// 调用业务服务
	accessToken, err := h.authService.RefreshToken(req.RefreshToken)
	if err != nil {
		return h.handleError(c, err)
	}

	return c.JSON(http.StatusOK, map[string]string{
		"accessToken": accessToken,
	})
}

// Logout 用户登出处理器
func (h *AuthHandler) Logout(c echo.Context) error {
	// TODO: 实现令牌黑名单机制
	return c.NoContent(http.StatusNoContent)
}

// CreateInvitation 创建邀请码处理器
func (h *AuthHandler) CreateInvitation(c echo.Context) error {
	var req CreateInvitationRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	// 从JWT获取管理员ID
	token := c.Get("user").(*jwt.Token)
	claims := token.Claims.(jwt.MapClaims)
	issuedBy := claims["user_id"].(string)

	// 调用业务服务
	invitation, err := h.authService.CreateInvitation(req, issuedBy)
	if err != nil {
		return h.handleError(c, err)
	}

	return c.JSON(http.StatusCreated, invitation)
}

// ListInvitations 列出邀请码处理器
func (h *AuthHandler) ListInvitations(c echo.Context) error {
	invitations, err := h.authService.ListInvitations()
	if err != nil {
		return h.handleError(c, err)
	}

	return c.JSON(http.StatusOK, invitations)
}

// GetInvitation 获取邀请码详情处理器
func (h *AuthHandler) GetInvitation(c echo.Context) error {
	code := c.Param("code")

	invitation, err := h.authService.GetInvitation(code)
	if err != nil {
		return h.handleError(c, err)
	}

	return c.JSON(http.StatusOK, invitation)
}

// RevokeInvitation 撤销邀请码处理器
func (h *AuthHandler) RevokeInvitation(c echo.Context) error {
	code := c.Param("code")

	err := h.authService.RevokeInvitation(code)
	if err != nil {
		return h.handleError(c, err)
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Invitation revoked successfully"})
}

// handleError 处理业务错误并转换为HTTP响应
func (h *AuthHandler) handleError(c echo.Context, err error) error {
	if authErr, ok := err.(*AuthError); ok {
		switch authErr.Code {
		case ErrCodeInvalidCredentials, ErrCodeInvalidToken:
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": authErr.Message})
		case ErrCodeInvalidInvite:
			return c.JSON(http.StatusForbidden, map[string]string{"error": authErr.Message})
		case ErrCodeEmailExists:
			return c.JSON(http.StatusConflict, map[string]string{"error": authErr.Message})
		case ErrCodeNotFound, ErrCodeUserNotFound:
			return c.JSON(http.StatusNotFound, map[string]string{"error": authErr.Message})
		default:
			h.logger.Error("Internal server error", zap.Error(authErr))
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
		}
	}

	// 处理其他类型的错误
	h.logger.Error("Unexpected error", zap.Error(err))
	return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
}