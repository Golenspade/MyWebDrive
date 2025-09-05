package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

// Config 应用配置
type Config struct {
	Database     DatabaseConfig     `yaml:"database"`
	User         UserConfig         `yaml:"user"`
	Registration RegistrationConfig `yaml:"registration"`
	Security     SecurityConfig     `yaml:"security"`
	CORS         CORSConfig         `yaml:"cors"`
	Storage      StorageConfig      `yaml:"storage"`
}

// DatabaseConfig 数据库配置
type DatabaseConfig struct {
	Path string `yaml:"path"`
}

// UserConfig 用户配置
type UserConfig struct {
	DefaultQuotaGB int `yaml:"default_quota_gb"`
}

// RegistrationConfig 注册配置
type RegistrationConfig struct {
	RequireInvite          bool          `yaml:"require_invite"`
	InviteCodeLength       int           `yaml:"invite_code_length"`
	InviteDefaultUsageLimit int          `yaml:"invite_default_usage_limit"`
	InviteDefaultTTL       time.Duration `yaml:"-"`
	InviteDefaultTTLStr    string        `yaml:"invite_default_ttl"`
}

// SecurityConfig 安全配置
type SecurityConfig struct {
	JWTSecret            string        `yaml:"-"` // 不从YAML读取，只从环境变量
	BcryptCost           int           `yaml:"bcrypt_cost"`
	AccessTokenDuration  time.Duration `yaml:"-"` // 解析后存储
	RefreshTokenDuration time.Duration `yaml:"-"` // 解析后存储
	AccessTokenStr       string        `yaml:"access_token_duration"`
	RefreshTokenStr      string        `yaml:"refresh_token_duration"`
}

// CORSConfig CORS配置
type CORSConfig struct {
	AllowedOrigins []string `yaml:"allowed_origins"`
}

// StorageConfig 存储配置
type StorageConfig struct {
	MaxFileSizeMB     int      `yaml:"max_file_size_mb"`
	AllowedExtensions []string `yaml:"allowed_extensions"`
}

// Load 加载配置
func Load() (*Config, error) {
	// 设置默认值
	cfg := &Config{
		Database: DatabaseConfig{
			Path: "./data/mywebdrive.db",
		},
		User: UserConfig{
			DefaultQuotaGB: 5,
		},
		Registration: RegistrationConfig{
			RequireInvite:           true,
			InviteCodeLength:        16,
			InviteDefaultUsageLimit: 1,
			InviteDefaultTTLStr:     "168h",
		},
		Security: SecurityConfig{
			BcryptCost:      10,
			AccessTokenStr:  "2h",
			RefreshTokenStr: "720h",
		},
		CORS: CORSConfig{
			AllowedOrigins: []string{"*"},
		},
		Storage: StorageConfig{
			MaxFileSizeMB:     500,
			AllowedExtensions: []string{".jpg", ".png", ".pdf", ".md", ".zip", ".mp4"},
		},
	}

	// 尝试读取 config.yaml from multiple locations
	configPaths := []string{
		"config/config.yaml",
		"../config/config.yaml",
		"../../backend/config/config.yaml",
		os.Getenv("CONFIG_PATH"),
	}
	
	var configLoaded bool
	for _, configPath := range configPaths {
		if configPath == "" {
			continue
		}
		
		if data, err := os.ReadFile(configPath); err == nil {
			if err := yaml.Unmarshal(data, cfg); err != nil {
				return nil, fmt.Errorf("failed to parse config.yaml from %s: %w", configPath, err)
			}
			configLoaded = true
			break
		}
	}
	
	if !configLoaded {
		// Use defaults if no config file is found
		fmt.Println("Warning: No config.yaml found, using default values")
	}

	// 环境变量覆盖
	if path := os.Getenv("DATABASE_PATH"); path != "" {
		cfg.Database.Path = path
	}

	if quotaStr := os.Getenv("USER_DEFAULT_QUOTA_GB"); quotaStr != "" {
		if quota, err := strconv.Atoi(quotaStr); err == nil {
			cfg.User.DefaultQuotaGB = quota
		}
	}

	// Registration 环境变量覆盖
	if requireInvite := os.Getenv("REGISTRATION_REQUIRE_INVITE"); requireInvite != "" {
		cfg.Registration.RequireInvite = requireInvite == "true"
	}
	
	if codeLength := os.Getenv("INVITE_CODE_LENGTH"); codeLength != "" {
		if length, err := strconv.Atoi(codeLength); err == nil {
			cfg.Registration.InviteCodeLength = length
		}
	}
	
	if usageLimit := os.Getenv("INVITE_DEFAULT_USAGE_LIMIT"); usageLimit != "" {
		if limit, err := strconv.Atoi(usageLimit); err == nil {
			cfg.Registration.InviteDefaultUsageLimit = limit
		}
	}
	
	if ttl := os.Getenv("INVITE_DEFAULT_TTL"); ttl != "" {
		cfg.Registration.InviteDefaultTTLStr = ttl
	}

	if costStr := os.Getenv("BCRYPT_COST"); costStr != "" {
		if cost, err := strconv.Atoi(costStr); err == nil {
			cfg.Security.BcryptCost = cost
		}
	}

	if duration := os.Getenv("ACCESS_TOKEN_DURATION"); duration != "" {
		cfg.Security.AccessTokenStr = duration
	}

	if duration := os.Getenv("REFRESH_TOKEN_DURATION"); duration != "" {
		cfg.Security.RefreshTokenStr = duration
	}

	if origins := os.Getenv("CORS_ALLOWED_ORIGINS"); origins != "" {
		cfg.CORS.AllowedOrigins = strings.Split(origins, ",")
		// 清理空格
		for i, origin := range cfg.CORS.AllowedOrigins {
			cfg.CORS.AllowedOrigins[i] = strings.TrimSpace(origin)
		}
	}

	// 解析时间字符串
	var err error
	cfg.Security.AccessTokenDuration, err = time.ParseDuration(cfg.Security.AccessTokenStr)
	if err != nil {
		return nil, fmt.Errorf("invalid access token duration: %w", err)
	}

	cfg.Security.RefreshTokenDuration, err = time.ParseDuration(cfg.Security.RefreshTokenStr)
	if err != nil {
		return nil, fmt.Errorf("invalid refresh token duration: %w", err)
	}

	// 解析邀请码默认TTL
	cfg.Registration.InviteDefaultTTL, err = time.ParseDuration(cfg.Registration.InviteDefaultTTLStr)
	if err != nil {
		return nil, fmt.Errorf("invalid invite default TTL: %w", err)
	}

	// JWT Secret 必须从环境变量获取
	cfg.Security.JWTSecret = os.Getenv("JWT_SECRET")
	if cfg.Security.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET environment variable is required")
	}

	return cfg, nil
}

// GetDefaultQuotaBytes 获取默认配额（字节）
func (c *Config) GetDefaultQuotaBytes() int64 {
	return int64(c.User.DefaultQuotaGB) * 1024 * 1024 * 1024
}
