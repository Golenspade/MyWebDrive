#!/bin/bash
set -e

# MyWebDrive Production Deployment Script
# For v0.2.0-search-publish-catalog

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║   MyWebDrive Production Deployment                           ║"
echo "║   Version: v0.2.0-search-publish-catalog                     ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Check if running from repo root
cd "$REPO_ROOT"

# Step 1: Check prerequisites
echo "📋 Step 1: Checking prerequisites..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker first."
    exit 1
fi
echo "✅ Docker: $(docker --version)"

if ! command -v docker compose &> /dev/null; then
    echo "❌ Docker Compose not found. Please install Docker Compose first."
    exit 1
fi
echo "✅ Docker Compose: $(docker compose version)"

if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm not found. Please install pnpm first."
    exit 1
fi
echo "✅ pnpm: $(pnpm --version)"

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 20+ first."
    exit 1
fi
echo "✅ Node.js: $(node --version)"

echo ""

# Step 2: Check environment file
echo "📋 Step 2: Checking environment configuration..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

ENV_FILE="$SCRIPT_DIR/.env.production"
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Environment file not found: $ENV_FILE"
    echo "Please copy .env.production and configure it:"
    echo "  cp infrastructure/alicloud/.env.production infrastructure/alicloud/.env"
    echo "  vim infrastructure/alicloud/.env"
    exit 1
fi

# Check if JWT_SECRET has been changed
if grep -q "your-super-secure-jwt-secret-key-change-in-production" "$ENV_FILE"; then
    echo "⚠️  WARNING: JWT_SECRET still contains default value!"
    echo "Please update JWT_SECRET in $ENV_FILE"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "✅ Environment file found: $ENV_FILE"
echo ""

# Step 3: Build all services
echo "📋 Step 3: Building all services..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "Installing dependencies..."
pnpm -w install

echo "Building packages and services..."
pnpm run build:all

echo "✅ Build completed"
echo ""

# Step 4: Build frontend
echo "📋 Step 4: Building frontend..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$REPO_ROOT/frontend/cruip-landing"
pnpm build

echo "✅ Frontend build completed"
echo ""

# Step 5: Initialize database (optional)
echo "📋 Step 5: Database initialization..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

read -p "Do you want to seed the admin account? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd "$REPO_ROOT"
    export $(cat "$ENV_FILE" | grep -v '^#' | xargs)
    cd services/auth
    pnpm db:seed
    echo "✅ Admin account seeded"
else
    echo "⏭️  Skipping database seed"
fi
echo ""

# Step 6: Start Docker Compose
echo "📋 Step 6: Starting Docker Compose services..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$SCRIPT_DIR"

# Copy env file for docker compose
cp .env.production .env

echo "Starting services with docker-compose.production.yml..."
docker compose -f docker-compose.production.yml up -d

echo "✅ Services started"
echo ""

# Step 7: Wait for services to be healthy
echo "📋 Step 7: Waiting for services to be healthy..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

sleep 10

# Check health
SERVICES=(
    "postgres:5432"
    "redis:6379"
    "auth:7091"
    "user:7092"
    "metadata:7093"
    "storage:7094"
    "sharing:7095"
    "api-gateway:9090"
    "frontend:3100"
)

for service in "${SERVICES[@]}"; do
    IFS=':' read -r name port <<< "$service"
    if nc -z localhost "$port" 2>/dev/null; then
        echo "✅ $name ($port)"
    else
        echo "⚠️  $name ($port) - not responding"
    fi
done

echo ""

# Step 8: Display access information
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║   🎉 Deployment Complete!                                    ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Service URLs:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Frontend:     http://localhost:3100"
echo "API Gateway:  http://localhost:9090"
echo "Auth:         http://localhost:7091"
echo "User:         http://localhost:7092"
echo "Metadata:     http://localhost:7093"
echo "Storage:      http://localhost:7094"
echo "Sharing:      http://localhost:7095"
echo "PostgreSQL:   localhost:5432"
echo "Redis:        localhost:6379"
echo "MinIO:        http://localhost:9000 (console: http://localhost:9001)"
echo ""
echo "📝 Useful Commands:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "View logs:        docker compose -f infrastructure/alicloud/docker-compose.production.yml logs -f"
echo "Stop services:    docker compose -f infrastructure/alicloud/docker-compose.production.yml down"
echo "Restart services: docker compose -f infrastructure/alicloud/docker-compose.production.yml restart"
echo "Check status:     docker compose -f infrastructure/alicloud/docker-compose.production.yml ps"
echo ""
echo "🔐 Default Admin Account (if seeded):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Email:    <REDACTED_ADMIN_EMAIL>"
echo "Password: <REDACTED_ADMIN_PASSWORD>"
echo ""
echo "⚠️  IMPORTANT: Change the admin password after first login!"
echo ""

