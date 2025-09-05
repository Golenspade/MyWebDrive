package discovery

import (
    "errors"
    "math/rand"
    "sync/atomic"
    "time"
)

// LoadBalancer 负载均衡器接口
type LoadBalancer interface {
    Select(instances []*ServiceInstance) (*ServiceInstance, error)
}

// RoundRobinBalancer 轮询负载均衡器
type RoundRobinBalancer struct {
    counter uint64
}

// NewRoundRobinBalancer 创建轮询负载均衡器
func NewRoundRobinBalancer() *RoundRobinBalancer {
    return &RoundRobinBalancer{}
}

// Select 选择服务实例
func (rb *RoundRobinBalancer) Select(instances []*ServiceInstance) (*ServiceInstance, error) {
    if len(instances) == 0 {
        return nil, errors.New("no available service instances")
    }
    
    index := atomic.AddUint64(&rb.counter, 1) % uint64(len(instances))
    return instances[index], nil
}

// RandomBalancer 随机负载均衡器
type RandomBalancer struct {
    rand *rand.Rand
}

// NewRandomBalancer 创建随机负载均衡器
func NewRandomBalancer() *RandomBalancer {
    return &RandomBalancer{
        rand: rand.New(rand.NewSource(time.Now().UnixNano())),
    }
}

// Select 选择服务实例
func (rb *RandomBalancer) Select(instances []*ServiceInstance) (*ServiceInstance, error) {
    if len(instances) == 0 {
        return nil, errors.New("no available service instances")
    }
    
    index := rb.rand.Intn(len(instances))
    return instances[index], nil
}

// WeightedRoundRobinBalancer 加权轮询负载均衡器
type WeightedRoundRobinBalancer struct {
    weights map[string]int
    current map[string]int
}

// NewWeightedRoundRobinBalancer 创建加权轮询负载均衡器
func NewWeightedRoundRobinBalancer(weights map[string]int) *WeightedRoundRobinBalancer {
    return &WeightedRoundRobinBalancer{
        weights: weights,
        current: make(map[string]int),
    }
}

// Select 选择服务实例
func (wrb *WeightedRoundRobinBalancer) Select(instances []*ServiceInstance) (*ServiceInstance, error) {
    if len(instances) == 0 {
        return nil, errors.New("no available service instances")
    }
    
    var selected *ServiceInstance
    maxWeight := -1
    
    for _, instance := range instances {
        weight := wrb.weights[instance.ID]
        if weight == 0 {
            weight = 1 // 默认权重
        }
        
        wrb.current[instance.ID] += weight
        
        if wrb.current[instance.ID] > maxWeight {
            maxWeight = wrb.current[instance.ID]
            selected = instance
        }
    }
    
    if selected != nil {
        wrb.current[selected.ID] -= wrb.getTotalWeight(instances)
    }
    
    return selected, nil
}

// getTotalWeight 获取总权重
func (wrb *WeightedRoundRobinBalancer) getTotalWeight(instances []*ServiceInstance) int {
    total := 0
    for _, instance := range instances {
        weight := wrb.weights[instance.ID]
        if weight == 0 {
            weight = 1
        }
        total += weight
    }
    return total
}

// LeastConnectionsBalancer 最少连接数负载均衡器
type LeastConnectionsBalancer struct {
    connections map[string]int
}

// NewLeastConnectionsBalancer 创建最少连接数负载均衡器
func NewLeastConnectionsBalancer() *LeastConnectionsBalancer {
    return &LeastConnectionsBalancer{
        connections: make(map[string]int),
    }
}

// Select 选择服务实例
func (lcb *LeastConnectionsBalancer) Select(instances []*ServiceInstance) (*ServiceInstance, error) {
    if len(instances) == 0 {
        return nil, errors.New("no available service instances")
    }
    
    var selected *ServiceInstance
    minConnections := -1
    
    for _, instance := range instances {
        connections := lcb.connections[instance.ID]
        
        if minConnections == -1 || connections < minConnections {
            minConnections = connections
            selected = instance
        }
    }
    
    if selected != nil {
        lcb.connections[selected.ID]++
    }
    
    return selected, nil
}

// ReleaseConnection 释放连接
func (lcb *LeastConnectionsBalancer) ReleaseConnection(instanceID string) {
    if count := lcb.connections[instanceID]; count > 0 {
        lcb.connections[instanceID]--
    }
}
