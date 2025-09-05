-- 创建分享表
CREATE TABLE IF NOT EXISTS shares (
    id TEXT PRIMARY KEY,
    file_id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    share_token TEXT UNIQUE NOT NULL,
    share_type TEXT NOT NULL CHECK (share_type IN ('private', 'public')),
    permission TEXT NOT NULL CHECK (permission IN ('view', 'download', 'edit')),
    password TEXT,
    expires_at DATETIME,
    max_downloads INTEGER,
    download_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_shares_file_id ON shares(file_id);
CREATE INDEX IF NOT EXISTS idx_shares_owner_id ON shares(owner_id);
CREATE INDEX IF NOT EXISTS idx_shares_token ON shares(share_token);
CREATE INDEX IF NOT EXISTS idx_shares_active ON shares(is_active);
CREATE INDEX IF NOT EXISTS idx_shares_expires_at ON shares(expires_at);

-- 创建分享访问日志表（可选，用于统计和审计）
CREATE TABLE IF NOT EXISTS share_access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    share_id TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    access_type TEXT NOT NULL CHECK (access_type IN ('view', 'download')),
    accessed_at DATETIME NOT NULL,
    FOREIGN KEY (share_id) REFERENCES shares(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_access_logs_share_id ON share_access_logs(share_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_accessed_at ON share_access_logs(accessed_at);
