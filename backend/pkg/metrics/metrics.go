package metrics

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Event 代表一个系统事件
type Event struct {
	ID        string                 `json:"id"`
	Timestamp time.Time              `json:"ts"`
	Service   string                 `json:"service"`
	Type      string                 `json:"type"`
	UserID    string                 `json:"user_id,omitempty"`
	IP        string                 `json:"ip,omitempty"`
	SizeBytes int64                  `json:"size_bytes,omitempty"`
	Attrs     map[string]interface{} `json:"attrs,omitempty"`
}

// MetricsCollector 指标收集器
type MetricsCollector struct {
	db           *sql.DB
	mu           sync.RWMutex
	dailyUVSets  map[string]map[string]bool // date -> ip -> bool
	dailyUserSets map[string]map[string]bool // date -> user_id -> bool
}

// NewMetricsCollector 创建新的指标收集器
func NewMetricsCollector(db *sql.DB) *MetricsCollector {
	collector := &MetricsCollector{
		db:            db,
		dailyUVSets:   make(map[string]map[string]bool),
		dailyUserSets: make(map[string]map[string]bool),
	}
	
	// 启动清理任务
	go collector.cleanupDailyMaps()
	
	return collector
}

// RecordEvent 记录事件并同步更新聚合数据
func (mc *MetricsCollector) RecordEvent(evt *Event) error {
	if evt.ID == "" {
		evt.ID = uuid.New().String()
	}
	if evt.Timestamp.IsZero() {
		evt.Timestamp = time.Now().UTC()
	}

	// 序列化属性
	var attrsJSON string
	if evt.Attrs != nil {
		if attrsBytes, err := json.Marshal(evt.Attrs); err == nil {
			attrsJSON = string(attrsBytes)
		}
	}

	// 写入events表
	_, err := mc.db.Exec(`
		INSERT INTO events (id, ts, service, type, user_id, ip, size_bytes, attrs)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		evt.ID, evt.Timestamp, evt.Service, evt.Type, evt.UserID, evt.IP, evt.SizeBytes, attrsJSON)
	
	if err != nil {
		return fmt.Errorf("failed to insert event: %w", err)
	}

	// 同步更新聚合数据
	return mc.updateAggregates(evt)
}

// updateAggregates 更新聚合数据
func (mc *MetricsCollector) updateAggregates(evt *Event) error {
	date := evt.Timestamp.UTC().Format("2006-01-02")

	// 根据事件类型更新不同的指标
	switch evt.Type {
	case "request":
		// 请求总数
		if err := mc.UpsertDailyStat(date, "requests_count", 1); err != nil {
			return err
		}

		// UV统计（基于IP去重）
		if evt.IP != "" {
			mc.mu.Lock()
			if mc.dailyUVSets[date] == nil {
				mc.dailyUVSets[date] = make(map[string]bool)
			}
			if !mc.dailyUVSets[date][evt.IP] {
				mc.dailyUVSets[date][evt.IP] = true
				mc.mu.Unlock()
				if err := mc.UpsertDailyStat(date, "visits_uv", 1); err != nil {
					return err
				}
			} else {
				mc.mu.Unlock()
			}
		}

		// 活跃用户统计（基于user_id去重）
		if evt.UserID != "" {
			mc.mu.Lock()
			if mc.dailyUserSets[date] == nil {
				mc.dailyUserSets[date] = make(map[string]bool)
			}
			if !mc.dailyUserSets[date][evt.UserID] {
				mc.dailyUserSets[date][evt.UserID] = true
				mc.mu.Unlock()
				if err := mc.UpsertDailyStat(date, "active_users", 1); err != nil {
					return err
				}
			} else {
				mc.mu.Unlock()
			}
		}

	case "error":
		if err := mc.UpsertDailyStat(date, "errors_count", 1); err != nil {
			return err
		}

	case "login":
		if err := mc.UpsertDailyStat(date, "logins_count", 1); err != nil {
			return err
		}

	case "register":
		if err := mc.UpsertDailyStat(date, "registers_count", 1); err != nil {
			return err
		}
		if err := mc.IncrTotal("total_users", 1); err != nil {
			return err
		}

	case "upload":
		if err := mc.UpsertDailyStat(date, "uploads_count", 1); err != nil {
			return err
		}
		if evt.SizeBytes > 0 {
			if err := mc.UpsertDailyStat(date, "uploads_bytes", evt.SizeBytes); err != nil {
				return err
			}
		}

	case "download":
		if err := mc.UpsertDailyStat(date, "downloads_count", 1); err != nil {
			return err
		}
		if evt.SizeBytes > 0 {
			if err := mc.UpsertDailyStat(date, "downloads_bytes", evt.SizeBytes); err != nil {
				return err
			}
		}
	}

	return nil
}

// UpsertDailyStat 更新日统计
func (mc *MetricsCollector) UpsertDailyStat(date, metric string, delta int64) error {
	_, err := mc.db.Exec(`
		INSERT INTO daily_stats (date, metric, value) 
		VALUES (?, ?, ?)
		ON CONFLICT(date, metric) 
		DO UPDATE SET value = value + ?`,
		date, metric, delta, delta)
	
	return err
}

// IncrTotal 增加总量
func (mc *MetricsCollector) IncrTotal(metric string, delta int64) error {
	_, err := mc.db.Exec(`
		INSERT INTO totals (metric, value) 
		VALUES (?, ?)
		ON CONFLICT(metric) 
		DO UPDATE SET value = value + ?`,
		metric, delta, delta)
	
	return err
}

// GetDailyStats 获取日统计数据
func (mc *MetricsCollector) GetDailyStats(fromDate, toDate, metric string) ([]DailyStat, error) {
	query := `
		SELECT date, metric, value 
		FROM daily_stats 
		WHERE date BETWEEN ? AND ? AND metric = ?
		ORDER BY date`
	
	rows, err := mc.db.Query(query, fromDate, toDate, metric)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats []DailyStat
	for rows.Next() {
		var stat DailyStat
		if err := rows.Scan(&stat.Date, &stat.Metric, &stat.Value); err != nil {
			return nil, err
		}
		stats = append(stats, stat)
	}

	return stats, nil
}

// GetTotals 获取总量数据
func (mc *MetricsCollector) GetTotals(metrics []string) (map[string]int64, error) {
	if len(metrics) == 0 {
		return map[string]int64{}, nil
	}

	// 构建IN查询
	placeholders := make([]string, len(metrics))
	args := make([]interface{}, len(metrics))
	for i, metric := range metrics {
		placeholders[i] = "?"
		args[i] = metric
	}

	query := fmt.Sprintf(`
		SELECT metric, value 
		FROM totals 
		WHERE metric IN (%s)`, 
		fmt.Sprintf("%s", placeholders[0]))
	
	for i := 1; i < len(placeholders); i++ {
		query = query[:len(query)-1] + fmt.Sprintf(",%s)", placeholders[i])
	}

	rows, err := mc.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	totals := make(map[string]int64)
	for rows.Next() {
		var metric string
		var value int64
		if err := rows.Scan(&metric, &value); err != nil {
			return nil, err
		}
		totals[metric] = value
	}

	// 确保所有请求的指标都有值（默认为0）
	for _, metric := range metrics {
		if _, exists := totals[metric]; !exists {
			totals[metric] = 0
		}
	}

	return totals, nil
}

// GetTodayStats 获取今日统计
func (mc *MetricsCollector) GetTodayStats(metrics []string) (map[string]int64, error) {
	today := time.Now().UTC().Format("2006-01-02")
	
	if len(metrics) == 0 {
		return map[string]int64{}, nil
	}

	// 构建IN查询
	placeholders := make([]string, len(metrics))
	args := make([]interface{}, len(metrics)+1)
	args[0] = today
	for i, metric := range metrics {
		placeholders[i] = "?"
		args[i+1] = metric
	}

	query := fmt.Sprintf(`
		SELECT metric, value 
		FROM daily_stats 
		WHERE date = ? AND metric IN (%s)`, 
		fmt.Sprintf("%s", placeholders[0]))
	
	for i := 1; i < len(placeholders); i++ {
		query = query[:len(query)-1] + fmt.Sprintf(",%s)", placeholders[i])
	}

	rows, err := mc.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stats := make(map[string]int64)
	for rows.Next() {
		var metric string
		var value int64
		if err := rows.Scan(&metric, &value); err != nil {
			return nil, err
		}
		stats[metric] = value
	}

	// 确保所有请求的指标都有值（默认为0）
	for _, metric := range metrics {
		if _, exists := stats[metric]; !exists {
			stats[metric] = 0
		}
	}

	return stats, nil
}

// DailyStat 日统计数据结构
type DailyStat struct {
	Date   string `json:"date"`
	Metric string `json:"metric"`
	Value  int64  `json:"value"`
}

// cleanupDailyMaps 清理过期的日期集合（保留最近7天）
func (mc *MetricsCollector) cleanupDailyMaps() {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for range ticker.C {
		mc.mu.Lock()
		now := time.Now().UTC()
		cutoff := now.AddDate(0, 0, -7).Format("2006-01-02")

		// 清理UV集合
		for date := range mc.dailyUVSets {
			if date < cutoff {
				delete(mc.dailyUVSets, date)
			}
		}

		// 清理活跃用户集合
		for date := range mc.dailyUserSets {
			if date < cutoff {
				delete(mc.dailyUserSets, date)
			}
		}
		mc.mu.Unlock()
	}
}