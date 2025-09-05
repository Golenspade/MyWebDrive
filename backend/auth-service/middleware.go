package main

import (
	"net/http"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"mywebdrive.local/pkg/config"
)

// JWTMiddleware JWT中间件
func JWTMiddleware(cfg *config.Config) echo.MiddlewareFunc {
	return middleware.JWTWithConfig(middleware.JWTConfig{
		SigningKey:  []byte(cfg.Security.JWTSecret),
		TokenLookup: "header:Authorization",
		AuthScheme:  "Bearer",
		ErrorHandler: func(err error) error {
			// 这里可以注入logger，但为了简化先用基本错误处理
			return echo.NewHTTPError(http.StatusUnauthorized, "Invalid or expired token")
		},
	})
}

// RequireAdmin 管理员权限中间件
func RequireAdmin(next echo.HandlerFunc) echo.HandlerFunc {
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
		if !ok || role != "admin" {
			return echo.NewHTTPError(http.StatusForbidden, "Admin access required")
		}

		return next(c)
	}
}
