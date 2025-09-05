#!/bin/bash
# scripts/rollback-to-go.sh

set -e

echo "Rolling back to Go services..."

# 停止Node服务（简单场景：杀掉记录的 PID，若存在）
if [ -f .node-services.pid ]; then
  kill $(cat .node-services.pid) || true
  rm -f .node-services.pid
fi

# 恢复Go服务目录（如果已归档）
if [ -d archive/go-services ]; then
  cp -r archive/go-services/backend ./ || true
  cp -r archive/go-services/bin ./ || true
fi

# 启动Go服务
./manage-services.sh start

echo "Rollback completed!"

