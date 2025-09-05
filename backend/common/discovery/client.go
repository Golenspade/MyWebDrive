package discovery

import (
    "context"
    "fmt"
    "net/http"
    "time"

    "go.uber.org/zap"
)

// ServiceClient 服务客户端
type ServiceClient struct {
    registry     ServiceRegistry
    loadBalancer LoadBalancer
    httpClient   *http.Client
    logger       *zap.Logger
}

// NewServiceClient 创建服务客户端
func NewServiceClient(registry ServiceRegistry, loadBalancer LoadBalancer, logger *zap.Logger) *ServiceClient {
    return &ServiceClient{
        registry:     registry,
        loadBalancer: loadBalancer,
        httpClient: &http.Client{
            Timeout: 30 * time.Second,
        },
        logger: logger,
    }
}

// GetServiceURL 获取服务URL
func (sc *ServiceClient) GetServiceURL(serviceName string) (string, error) {
    instances, err := sc.registry.Discover(serviceName)
    if err != nil {
        return "", fmt.Errorf("failed to discover service %s: %w", serviceName, err)
    }
    
    if len(instances) == 0 {
        return "", fmt.Errorf("no available instances for service %s", serviceName)
    }
    
    instance, err := sc.loadBalancer.Select(instances)
    if err != nil {
        return "", fmt.Errorf("failed to select instance for service %s: %w", serviceName, err)
    }
    
    return fmt.Sprintf("http://%s:%d", instance.Address, instance.Port), nil
}

// CallService 调用服务
func (sc *ServiceClient) CallService(ctx context.Context, serviceName, path string, method string, body interface{}) (*http.Response, error) {
    serviceURL, err := sc.GetServiceURL(serviceName)
    if err != nil {
        return nil, err
    }
    
    url := serviceURL + path
    
    var req *http.Request
    if body != nil {
        // 这里简化处理，实际应该根据content-type处理
        req, err = http.NewRequestWithContext(ctx, method, url, nil)
    } else {
        req, err = http.NewRequestWithContext(ctx, method, url, nil)
    }
    
    if err != nil {
        return nil, fmt.Errorf("failed to create request: %w", err)
    }
    
    // 添加请求头
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("User-Agent", "MyWebDrive-ServiceClient/1.0")
    
    sc.logger.Debug("Calling service",
        zap.String("service", serviceName),
        zap.String("method", method),
        zap.String("url", url))
    
    resp, err := sc.httpClient.Do(req)
    if err != nil {
        sc.logger.Error("Service call failed",
            zap.String("service", serviceName),
            zap.String("url", url),
            zap.Error(err))
        return nil, fmt.Errorf("service call failed: %w", err)
    }
    
    sc.logger.Debug("Service call completed",
        zap.String("service", serviceName),
        zap.String("url", url),
        zap.Int("statusCode", resp.StatusCode))
    
    return resp, nil
}

// HealthChecker 健康检查器
type HealthChecker struct {
    registry   ServiceRegistry
    httpClient *http.Client
    logger     *zap.Logger
    interval   time.Duration
}

// NewHealthChecker 创建健康检查器
func NewHealthChecker(registry ServiceRegistry, logger *zap.Logger, interval time.Duration) *HealthChecker {
    return &HealthChecker{
        registry: registry,
        httpClient: &http.Client{
            Timeout: 10 * time.Second,
        },
        logger:   logger,
        interval: interval,
    }
}

// Start 启动健康检查
func (hc *HealthChecker) Start(ctx context.Context) {
    ticker := time.NewTicker(hc.interval)
    defer ticker.Stop()
    
    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            hc.performHealthCheck()
        }
    }
}

// performHealthCheck 执行健康检查
func (hc *HealthChecker) performHealthCheck() {
    // 这里简化处理，实际应该获取所有注册的服务进行检查
    // 由于MemoryRegistry已经有内置的健康检查，这里主要是示例
    hc.logger.Debug("Performing health check")
}
