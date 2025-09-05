#!/bin/bash

# SQLite数据库初始化脚本
# 用于在部署时初始化SQLite数据库

set -e

DB_DIR=${DATABASE_PATH:-"./data"}
echo "📁 创建数据库目录: $DB_DIR"
mkdir -p "$DB_DIR"

# 检查goose是否安装
if ! command -v goose &> /dev/null; then
    echo "❌ goose未安装，请先安装: go install github.com/pressly/goose/v3/cmd/goose@latest"
    exit 1
fi

echo "🔄 初始化SQLite数据库..."

# 认证服务数据库
echo "📊 初始化认证服务数据库..."
cd backend/auth-service
goose sqlite3 "$DB_DIR/auth.db" up
cd ../..

# 用户服务数据库
echo "👤 初始化用户服务数据库..."
cd backend/user-service
goose sqlite3 "$DB_DIR/user.db" up
cd ../..

# 元数据服务数据库
echo "📁 初始化元数据服务数据库..."
cd backend/metadata-service
goose sqlite3 "$DB_DIR/metadata.db" up
cd ../..

# 分享服务数据库
echo "🔗 初始化分享服务数据库..."
cd backend/sharing-service
goose sqlite3 "$DB_DIR/sharing.db" up
cd ../..

# 设置数据库文件权限
echo "🔐 设置数据库文件权限..."
chmod 664 "$DB_DIR"/*.db
chown -R $(whoami):$(whoami) "$DB_DIR"

echo "✅ SQLite数据库初始化完成!"
echo "📋 数据库文件位置:"
echo "  - 认证服务: $DB_DIR/auth.db"
echo "  - 用户服务: $DB_DIR/user.db"
echo "  - 元数据服务: $DB_DIR/metadata.db"
echo "  - 分享服务: $DB_DIR/sharing.db"
