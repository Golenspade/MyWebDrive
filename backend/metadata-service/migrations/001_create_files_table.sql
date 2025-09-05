-- +goose Up
CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('file', 'folder')),
    size INTEGER,
    mime_type TEXT,
    parent_id TEXT,
    owner_id TEXT NOT NULL,
    path TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    FOREIGN KEY (parent_id) REFERENCES files(id) ON DELETE CASCADE
);

-- 创建唯一约束索引，SQLite中需要单独创建
CREATE UNIQUE INDEX idx_files_unique_name ON files(name, parent_id, owner_id, deleted_at);

-- 索引优化查询性能
CREATE INDEX idx_files_parent_id ON files(parent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_files_owner_id ON files(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_files_type ON files(type) WHERE deleted_at IS NULL;
CREATE INDEX idx_files_path ON files(path) WHERE deleted_at IS NULL;
CREATE INDEX idx_files_deleted_at ON files(deleted_at);

-- 文件版本表
CREATE TABLE IF NOT EXISTS file_versions (
    id TEXT PRIMARY KEY,
    file_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    size INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    md5_hash TEXT NOT NULL,
    comment TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- SQLite中需要单独创建唯一约束
CREATE UNIQUE INDEX idx_file_versions_unique ON file_versions(file_id, version);
CREATE INDEX idx_file_versions_file_id ON file_versions(file_id);

-- 文件标签表（用于分类和搜索）
CREATE TABLE IF NOT EXISTS file_tags (
    id TEXT PRIMARY KEY,
    file_id TEXT NOT NULL,
    tag_name TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- 创建文件标签索引
CREATE INDEX IF NOT EXISTS idx_file_tags_file_id ON file_tags(file_id);
CREATE INDEX IF NOT EXISTS idx_file_tags_name ON file_tags(tag_name);

-- 文件访问日志表
CREATE TABLE IF NOT EXISTS file_access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('view', 'download', 'edit', 'delete')),
    ip_address TEXT,
    user_agent TEXT,
    accessed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- 创建访问日志索引
CREATE INDEX IF NOT EXISTS idx_access_logs_file_id ON file_access_logs(file_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_user_id ON file_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_accessed_at ON file_access_logs(accessed_at);

-- +goose Down
DROP TABLE IF EXISTS file_versions;
DROP TABLE IF EXISTS files;