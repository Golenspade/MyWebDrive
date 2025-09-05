package discovery

import (
    "context"
    "fmt"
    "sync"
    "time"

    "go.uber.org/zap"
)

// ServiceInstance 服务实例
type ServiceInstance struct {
    ID       string            `json:"id"`
    Name     string            `json:"name"`
    Address  string            `json:"address"`
    Port     int               `json:"port"`
    Metadata map[string]string `json:"metadata"`
    Health   HealthStatus      `json:"health"`
    LastSeen time.Time         `json:"lastSeen"`
}

// HealthStatus 健康状态
type HealthStatus string

const (
    HealthStatusHealthy   HealthStatus = "healthy"
    HealthStatusUnhealthy HealthStatus = "unhealthy"
    HealthStatusUnknown   HealthStatus = "unknown"
)

// ServiceRegistry 服务注册中心接口
type ServiceRegistry interface {
    Register(instance *ServiceInstance) error
    Deregister(serviceID string) error
    Discover(serviceName string) ([]*ServiceInstance, error)
    HealthCheck(serviceID string) error
    Close() error
}

// MemoryRegistry 内存服务注册中心（用于开发和测试）
type MemoryRegistry struct {
    services map[string]*ServiceInstance
    mu       sync.RWMutex
    logger   *zap.Logger
    ctx      context.Context
    cancel   context.CancelFunc
}

// NewMemoryRegistry 创建内存服务注册中心
func NewMemoryRegistry(logger *zap.Logger) *MemoryRegistry {
    ctx, cancel := context.WithCancel(context.Background())
    
    registry := &MemoryRegistry{
        services: make(map[string]*ServiceInstance),
        logger:   logger,
        ctx:      ctx,
        cancel:   cancel,
    }
    
    // 启动健康检查
    go registry.startHealthCheck()
    
    return registry
}

// Register 注册服务实例
func (r *MemoryRegistry) Register(instance *ServiceInstance) error {
    r.mu.Lock()
    defer r.mu.Unlock()
    
    instance.LastSeen = time.Now()
    instance.Health = HealthStatusHealthy
    
    r.services[instance.ID] = instance
    
    r.logger.Info("Service registered",
        zap.String("serviceId", instance.ID),
        zap.String("serviceName", instance.Name),
        zap.String("address", fmt.Sprintf("%s:%d", instance.Address, instance.Port)))
    
    return nil
}

// Deregister 注销服务实例
func (r *MemoryRegistry) Deregister(serviceID string) error {
    r.mu.Lock()
    defer r.mu.Unlock()
    
    if instance, exists := r.services[serviceID]; exists {
        delete(r.services, serviceID)
        r.logger.Info("Service deregistered",
            zap.String("serviceId", serviceID),
            zap.String("serviceName", instance.Name))
    }
    
    return nil
}

// Discover 发现服务实例
func (r *MemoryRegistry) Discover(serviceName string) ([]*ServiceInstance, error) {
    r.mu.RLock()
    defer r.mu.RUnlock()
    
    var instances []*ServiceInstance
    
    for _, instance := range r.services {
        if instance.Name == serviceName && instance.Health == HealthStatusHealthy {
            instances = append(instances, instance)
        }
    }
    
    return instances, nil
}

// HealthCheck 健康检查
func (r *MemoryRegistry) HealthCheck(serviceID string) error {
    r.mu.Lock()
    defer r.mu.Unlock()
    
    if instance, exists := r.services[serviceID]; exists {
        instance.LastSeen = time.Now()
        instance.Health = HealthStatusHealthy
    }
    
    return nil
}

// Close 关闭注册中心
func (r *MemoryRegistry) Close() error {
    r.cancel()
    return nil
}

// startHealthCheck 启动健康检查
func (r *MemoryRegistry) startHealthCheck() {
    ticker := time.NewTicker(30 * time.Second)
    defer ticker.Stop()
    
    for {
        select {
        case <-r.ctx.Done():
            return
        case <-ticker.C:
            r.performHealthCheck()
        }
    }
}

// performHealthCheck 执行健康检查
func (r *MemoryRegistry) performHealthCheck() {
    r.mu.Lock()
    defer r.mu.Unlock()
    
    now := time.Now()
    unhealthyThreshold := 2 * time.Minute
    
    for id, instance := range r.services {
        if now.Sub(instance.LastSeen) > unhealthyThreshold {
            if instance.Health == HealthStatusHealthy {
                instance.Health = HealthStatusUnhealthy
                r.logger.Warn("Service marked as unhealthy",
                    zap.String("serviceId", id),
                    zap.String("serviceName", instance.Name),
                    zap.Duration("lastSeen", now.Sub(instance.LastSeen)))
            }
            
            // 如果服务长时间未响应，则自动注销
            if now.Sub(instance.LastSeen) > 5*time.Minute {
                delete(r.services, id)
                r.logger.Info("Service auto-deregistered due to inactivity",
                    zap.String("serviceId", id),
                    zap.String("serviceName", instance.Name))
            }
        }
    }
}
