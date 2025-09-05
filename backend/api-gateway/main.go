package main

import (
    "context"
    "database/sql"
    "net/http"
    "net/http/httputil"
    "net/url"
    "os"
    "os/signal"
    "time"

    "github.com/golang-jwt/jwt/v5"
    "github.com/labstack/echo/v4"
    "github.com/labstack/echo/v4/middleware"
    _ "github.com/mattn/go-sqlite3"
    "go.uber.org/zap"

    "mywebdrive.local/pkg/config"
    "mywebdrive.local/pkg/database"
    "mywebdrive.local/pkg/metrics"
    "mywebdrive/common/errors"
    "mywebdrive/common/response"
)

// ServiceConfig 服务配置
type ServiceConfig struct {
    Name string
    URL  string
}

// Gateway API网关
type Gateway struct {
    logger          *zap.Logger
    config          *config.Config
    services        map[string]*ServiceConfig
    db              *sql.DB
    metricsCollector *metrics.MetricsCollector
}

func main() {
    // 初始化日志
    logger, _ := zap.NewProduction()
    defer logger.Sync()

    // 加载配置
    cfg, err := config.Load()
    if err != nil {
        logger.Fatal("Failed to load config", zap.Error(err))
    }

    // 确保数据目录存在
    if err := database.EnsureDataDir(cfg.Database.Path); err != nil {
        logger.Fatal("Failed to ensure data directory", zap.Error(err))
    }

    // 连接数据库
    db, err := sql.Open("sqlite3", cfg.Database.Path)
    if err != nil {
        logger.Fatal("Failed to connect to database", zap.Error(err))
    }
    defer db.Close()

    // 初始化数据库schema
    if err := database.InitSchema(db); err != nil {
        logger.Fatal("Failed to initialize database schema", zap.Error(err))
    }

    // 创建metrics收集器
    metricsCollector := metrics.NewMetricsCollector(db)

    // 创建网关实例
    gateway := &Gateway{
        logger:          logger,
        config:          cfg,
        db:              db,
        metricsCollector: metricsCollector,
        services: map[string]*ServiceConfig{
            "auth":     {Name: "auth-service", URL: getEnvOrDefault("AUTH_SERVICE_URL", "http://localhost:8081")},
            "user":     {Name: "user-service", URL: getEnvOrDefault("USER_SERVICE_URL", "http://localhost:8082")},
            "metadata": {Name: "metadata-service", URL: getEnvOrDefault("METADATA_SERVICE_URL", "http://localhost:8083")},
            "storage":  {Name: "storage-service", URL: getEnvOrDefault("STORAGE_SERVICE_URL", "http://localhost:8084")},
            "sharing":  {Name: "sharing-service", URL: getEnvOrDefault("SHARING_SERVICE_URL", "http://localhost:8085")},
        },
    }

    // 创建Echo实例
    e := echo.New()

    // 中间件配置
    e.Use(middleware.Logger())
    e.Use(middleware.Recover())
    e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
        AllowOrigins: cfg.CORS.AllowedOrigins,
        AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPatch, http.MethodDelete, http.MethodOptions},
        AllowHeaders: []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAuthorization},
    }))
    e.Use(middleware.RequestID())

    // Metrics 采集中间件
    e.Use(gateway.MetricsMiddleware())

    // 速率限制
    e.Use(middleware.RateLimiter(middleware.NewRateLimiterMemoryStore(20)))

    // 健康检查端点
    e.GET("/health", func(c echo.Context) error {
        return c.JSON(http.StatusOK, map[string]string{
            "status": "healthy",
            "service": "api-gateway",
        })
    })

    // API路由组
    api := e.Group("/api/v1")

    // 认证服务路由
    auth := api.Group("/auth")
    gateway.setupAuthRoutes(auth)

    // 用户服务路由
    users := api.Group("/users")
    gateway.setupUserRoutes(users)

    // 文件服务路由
    files := api.Group("/files")
    gateway.setupFileRoutes(files)

    // 文件夹服务路由
    folders := api.Group("/folders")
    gateway.setupFolderRoutes(folders)

    // 存储服务路由
    storage := api.Group("/storage")
    gateway.setupStorageRoutes(storage)

    // 分享服务路由
    shares := api.Group("/shares")
    gateway.setupShareRoutes(shares)

    // 公开分享路由（不需要认证）
    e.GET("/api/v1/shares/:shareToken", gateway.createProxy("sharing"))
    e.POST("/api/v1/shares/:shareToken/access", gateway.createProxy("sharing"))
    e.GET("/api/v1/shares/:shareToken/download", gateway.createProxy("sharing"))

    // Admin路由（需要管理员权限）
    adminGroup := e.Group("/api/v1/admin")
    adminGroup.Use(gateway.JWTMiddleware())
    adminGroup.Use(gateway.RequireAdmin)
    adminGroup.GET("/health", gateway.AdminHealthCheck)
    adminGroup.GET("/overview", gateway.AdminOverview)

    // 启动服务器（端口可通过 GATEWAY_PORT 或 PORT 覆盖，默认 8080）
    port := os.Getenv("GATEWAY_PORT")
    if port == "" {
        port = os.Getenv("PORT")
    }
    if port == "" {
        port = "8080"
    }

    go func() {
        if err := e.Start(":" + port); err != nil && err != http.ErrServerClosed {
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

// 设置认证服务路由
func (gw *Gateway) setupAuthRoutes(g *echo.Group) {
    // 这些路由将代理到认证服务
    g.POST("/register", gw.createProxy("auth"))
    g.POST("/login", gw.createProxy("auth"))
    g.POST("/refresh", gw.createProxy("auth"))
    g.POST("/logout", gw.createProxy("auth"))

    // 邀请码管理路由（需要管理员权限）
    g.POST("/invitations", gw.createProxy("auth"))
    g.GET("/invitations", gw.createProxy("auth"))
    g.GET("/invitations/:id", gw.createProxy("auth"))
    g.DELETE("/invitations/:id", gw.createProxy("auth"))
}

// 设置用户服务路由
func (gw *Gateway) setupUserRoutes(g *echo.Group) {
    // 需要JWT认证的中间件
    g.Use(gw.JWTMiddleware())
    g.GET("/me", gw.createProxy("user"))
    g.PATCH("/me", gw.createProxy("user"))
    g.GET("/me/storage", gw.createProxy("user"))
}

// 设置文件服务路由
func (gw *Gateway) setupFileRoutes(g *echo.Group) {
    g.Use(gw.JWTMiddleware())
    g.GET("/:fileId", gw.createProxy("metadata"))
    g.PATCH("/:fileId", gw.createProxy("metadata"))
    g.DELETE("/:fileId", gw.createProxy("metadata"))
    g.POST("/:fileId/move", gw.createProxy("metadata"))
    g.GET("/:fileId/versions", gw.createProxy("metadata"))
    g.POST("/:fileId/versions/:versionId/restore", gw.createProxy("metadata"))
    g.POST("/:fileId/shares", gw.createProxy("sharing"))
    g.GET("/:fileId/shares", gw.createProxy("sharing"))
}

// 设置文件夹服务路由
func (gw *Gateway) setupFolderRoutes(g *echo.Group) {
    g.Use(gw.JWTMiddleware())
    g.POST("", gw.createProxy("metadata"))
    g.GET("/:folderId/children", gw.createProxy("metadata"))
    g.PATCH("/:folderId", gw.createProxy("metadata"))
    g.DELETE("/:folderId", gw.createProxy("metadata"))
    g.POST("/:folderId/move", gw.createProxy("metadata"))
}

// 设置存储服务路由
func (gw *Gateway) setupStorageRoutes(g *echo.Group) {
    g.Use(gw.JWTMiddleware())
    g.POST("/uploads", gw.createProxy("storage"))
    g.PATCH("/uploads/:uploadId", gw.createProxy("storage"))
    g.HEAD("/uploads/:uploadId", gw.createProxy("storage"))
    g.POST("/uploads/:uploadId/finalize", gw.createProxy("storage"))
    g.DELETE("/uploads/:uploadId", gw.createProxy("storage"))
    g.GET("/files/:fileId", gw.createProxy("storage"))
}

// 设置分享服务路由
func (gw *Gateway) setupShareRoutes(g *echo.Group) {
    g.Use(gw.JWTMiddleware())
    g.PATCH("/:shareId", gw.createProxy("sharing"))
    g.DELETE("/:shareId", gw.createProxy("sharing"))
    g.GET("", gw.createProxy("sharing"))
}

// createProxy 创建代理处理函数
func (gw *Gateway) createProxy(serviceName string) echo.HandlerFunc {
    service, exists := gw.services[serviceName]
    if !exists {
        return func(c echo.Context) error {
            err := errors.Internal("Service unavailable").WithDetail("service", serviceName)
            return response.ErrorWithLogger(c, err, gw.logger)
        }
    }

    targetURL, err := url.Parse(service.URL)
    if err != nil {
        gw.logger.Error("Invalid service URL", zap.String("service", serviceName), zap.String("url", service.URL))
        return func(c echo.Context) error {
            appErr := errors.Internal("Service configuration error").
                WithDetail("service", serviceName).
                WithDetail("url", service.URL).
                WithCause(err)
            return response.ErrorWithLogger(c, appErr, gw.logger)
        }
    }

    proxy := httputil.NewSingleHostReverseProxy(targetURL)
    
    // 自定义错误处理
    proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
        gw.logger.Error("Proxy error", 
            zap.String("service", serviceName),
            zap.String("path", r.URL.Path),
            zap.Error(err))
        
        w.Header().Set("Content-Type", "application/json")
        w.WriteHeader(http.StatusBadGateway)
        w.Write([]byte(`{"error": "Service temporarily unavailable"}`))
    }

    // 自定义请求修改
    originalDirector := proxy.Director
    proxy.Director = func(req *http.Request) {
        originalDirector(req)
        
        // 设置目标主机
        req.Host = targetURL.Host
        req.Header.Set("X-Forwarded-Host", req.Header.Get("Host"))
        req.Header.Set("X-Forwarded-Proto", "http")
        
        // 添加服务标识
        req.Header.Set("X-Gateway-Service", serviceName)
        
        gw.logger.Debug("Proxying request",
            zap.String("service", serviceName),
            zap.String("method", req.Method),
            zap.String("path", req.URL.Path),
            zap.String("target", targetURL.String()))
    }

    return func(c echo.Context) error {
        proxy.ServeHTTP(c.Response(), c.Request())
        return nil
    }
}

// JWT中间件实现
func (gw *Gateway) JWTMiddleware() echo.MiddlewareFunc {
    return middleware.JWTWithConfig(middleware.JWTConfig{
        SigningKey:  []byte(gw.config.Security.JWTSecret),
        TokenLookup: "header:Authorization",
        AuthScheme:  "Bearer",
        ErrorHandler: func(err error) error {
            gw.logger.Warn("JWT validation failed", zap.Error(err))
            return echo.NewHTTPError(http.StatusUnauthorized, "Invalid or expired token")
        },
    })
}

// MetricsMiddleware Metrics采集中间件
func (gw *Gateway) MetricsMiddleware() echo.MiddlewareFunc {
    return func(next echo.HandlerFunc) echo.HandlerFunc {
        return func(c echo.Context) error {
            start := time.Now()
            
            // 执行请求
            err := next(c)
            
            // 获取响应状态码
            statusCode := c.Response().Status
            
            // 获取用户ID（如果有JWT token）
            var userID string
            if token, ok := c.Get("user").(*jwt.Token); ok {
                if claims, ok := token.Claims.(jwt.MapClaims); ok {
                    if uid, ok := claims["user_id"].(string); ok {
                        userID = uid
                    }
                }
            }
            
            // 记录请求事件
            evt := &metrics.Event{
                Service: "gateway",
                Type:    "request",
                UserID:  userID,
                IP:      c.RealIP(),
                Attrs: map[string]interface{}{
                    "method":      c.Request().Method,
                    "path":        c.Request().URL.Path,
                    "status_code": statusCode,
                    "duration_ms": time.Since(start).Milliseconds(),
                },
            }
            
            // 如果是错误响应，记录错误事件
            if statusCode >= 500 {
                errorEvt := &metrics.Event{
                    Service: "gateway",
                    Type:    "error",
                    UserID:  userID,
                    IP:      c.RealIP(),
                    Attrs: map[string]interface{}{
                        "method":      c.Request().Method,
                        "path":        c.Request().URL.Path,
                        "status_code": statusCode,
                    },
                }
                gw.metricsCollector.RecordEvent(errorEvt)
            }
            
            gw.metricsCollector.RecordEvent(evt)
            
            return err
        }
    }
}

// RequireAdmin 管理员权限中间件
func (gw *Gateway) RequireAdmin(next echo.HandlerFunc) echo.HandlerFunc {
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

// AdminHealthCheck 管理员健康检查
func (gw *Gateway) AdminHealthCheck(c echo.Context) error {
    type ServiceHealth struct {
        Name   string `json:"name"`
        Status string `json:"status"`
        URL    string `json:"url"`
    }
    
    type HealthResponse struct {
        Services []ServiceHealth `json:"services"`
        Time     string          `json:"time"`
    }
    
    var services []ServiceHealth
    client := &http.Client{Timeout: 5 * time.Second}
    
    for _, service := range gw.services {
        healthURL := service.URL + "/health"
        status := "healthy"
        
        resp, err := client.Get(healthURL)
        if err != nil || resp.StatusCode != http.StatusOK {
            status = "error"
        }
        if resp != nil {
            resp.Body.Close()
        }
        
        services = append(services, ServiceHealth{
            Name:   service.Name,
            Status: status,
            URL:    healthURL,
        })
    }
    
    return c.JSON(http.StatusOK, HealthResponse{
        Services: services,
        Time:     time.Now().UTC().Format(time.RFC3339),
    })
}

// AdminOverview 管理员概览
func (gw *Gateway) AdminOverview(c echo.Context) error {
    type OverviewResponse struct {
        Totals  map[string]int64              `json:"totals"`
        Today   map[string]int64              `json:"today"`
        Last7d  map[string][]metrics.DailyStat `json:"last7d"`
    }
    
    // 获取总量数据
    totalMetrics := []string{"total_users", "total_files", "total_storage_bytes"}
    totals, err := gw.metricsCollector.GetTotals(totalMetrics)
    if err != nil {
        appErr := errors.Internal("Failed to get totals").WithCause(err)
        return response.ErrorWithLogger(c, appErr, gw.logger)
    }
    
    // 获取今日数据
    todayMetrics := []string{
        "uploads_bytes", "downloads_bytes", "uploads_count", "downloads_count",
        "active_users", "visits_uv", "requests_count", "errors_count",
    }
    today, err := gw.metricsCollector.GetTodayStats(todayMetrics)
    if err != nil {
        appErr := errors.Internal("Failed to get today stats").WithCause(err)
        return response.ErrorWithLogger(c, appErr, gw.logger)
    }
    
    // 获取近7天数据
    now := time.Now().UTC()
    fromDate := now.AddDate(0, 0, -7).Format("2006-01-02")
    toDate := now.Format("2006-01-02")
    
    last7d := make(map[string][]metrics.DailyStat)
    trendMetrics := []string{"uploads_bytes", "downloads_bytes", "visits_uv"}
    
    for _, metric := range trendMetrics {
        stats, err := gw.metricsCollector.GetDailyStats(fromDate, toDate, metric)
        if err != nil {
            gw.logger.Error("Failed to get daily stats", zap.String("metric", metric), zap.Error(err))
            continue
        }
        last7d[metric] = stats
    }
    
    return c.JSON(http.StatusOK, OverviewResponse{
        Totals: totals,
        Today:  today,
        Last7d: last7d,
    })
}

// getEnvOrDefault 获取环境变量或返回默认值
func getEnvOrDefault(key, defaultValue string) string {
    if value := os.Getenv(key); value != "" {
        return value
    }
    return defaultValue
}
