#!/bin/bash
# Start ADAShield API, Web, and Worker services locally

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# PID file locations
API_PID_FILE="$SCRIPT_DIR/.api.pid"
WEB_PID_FILE="$SCRIPT_DIR/.web.pid"
WORKER_PID_FILE="$SCRIPT_DIR/.worker.pid"
LOG_DIR="$SCRIPT_DIR/.logs"

# Create log directory
mkdir -p "$LOG_DIR"

# Check if services are already running
if [ -f "$API_PID_FILE" ] && kill -0 "$(cat "$API_PID_FILE")" 2>/dev/null; then
    echo "⚠️  API is already running (PID: $(cat "$API_PID_FILE"))"
    echo "   Run ./app-stop.sh first to restart"
    exit 1
fi

if [ -f "$WEB_PID_FILE" ] && kill -0 "$(cat "$WEB_PID_FILE")" 2>/dev/null; then
    echo "⚠️  Web is already running (PID: $(cat "$WEB_PID_FILE"))"
    echo "   Run ./app-stop.sh first to restart"
    exit 1
fi

if [ -f "$WORKER_PID_FILE" ] && kill -0 "$(cat "$WORKER_PID_FILE")" 2>/dev/null; then
    echo "⚠️  Worker is already running (PID: $(cat "$WORKER_PID_FILE"))"
    echo "   Run ./app-stop.sh first to restart"
    exit 1
fi

# Detect Docker ports dynamically
echo "🔍 Detecting Docker service ports..."

POSTGRES_PORT=$(docker-compose -f docker-compose.dev.yml port postgres 5432 2>/dev/null | cut -d: -f2)
REDIS_PORT=$(docker-compose -f docker-compose.dev.yml port redis 6379 2>/dev/null | cut -d: -f2)
MINIO_PORT=$(docker-compose -f docker-compose.dev.yml port minio 9000 2>/dev/null | cut -d: -f2)

if [ -z "$POSTGRES_PORT" ] || [ -z "$REDIS_PORT" ]; then
    echo "❌ Error: Infrastructure not running. Start it first:"
    echo "   ./infra-start.sh"
    exit 1
fi

echo "   PostgreSQL: localhost:$POSTGRES_PORT"
echo "   Redis: localhost:$REDIS_PORT"
echo "   MinIO: localhost:$MINIO_PORT"
echo ""

# Export environment variables
export DATABASE_URL="postgresql://postgres:postgres@localhost:$POSTGRES_PORT/adashield?schema=public"
export REDIS_URL="redis://localhost:$REDIS_PORT/0"
export JWT_SECRET="dev-jwt-secret-change-in-production"
export COOKIE_SECRET="dev-cookie-secret-change-in-production"
export CORS_ORIGIN="http://localhost:3000"
export PORT="3080"
export NEXT_PUBLIC_API_URL="http://localhost:3080"

# S3 Configuration (loaded from root .env or defaults to MinIO)
# To use AWS S3: Update root .env with S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY (leave S3_ENDPOINT commented/empty)
USE_AWS_S3=false
if [ -f "$SCRIPT_DIR/.env" ]; then
    # Check if using AWS S3 (S3_ACCESS_KEY starts with AKIA = AWS credentials)
    S3_ACCESS_KEY_ENV=$(grep -E "^S3_ACCESS_KEY=" "$SCRIPT_DIR/.env" 2>/dev/null | cut -d= -f2 | tr -d '"' | tr -d "'")
    if [[ "$S3_ACCESS_KEY_ENV" == AKIA* ]]; then
        USE_AWS_S3=true
        S3_BUCKET_ENV=$(grep -E "^S3_BUCKET=" "$SCRIPT_DIR/.env" 2>/dev/null | cut -d= -f2 | tr -d '"' | tr -d "'")
        S3_SECRET_KEY_ENV=$(grep -E "^S3_SECRET_KEY=" "$SCRIPT_DIR/.env" 2>/dev/null | cut -d= -f2 | tr -d '"' | tr -d "'")
        S3_PUBLIC_URL_ENV=$(grep -E "^S3_PUBLIC_URL=" "$SCRIPT_DIR/.env" 2>/dev/null | cut -d= -f2 | tr -d '"' | tr -d "'")
    fi
fi

if [ "$USE_AWS_S3" = true ]; then
    # AWS S3 configuration (no endpoint = use AWS default)
    export S3_ENDPOINT=""
    export S3_REGION="us-east-1"
    export S3_ACCESS_KEY="$S3_ACCESS_KEY_ENV"
    export S3_SECRET_KEY="$S3_SECRET_KEY_ENV"
    export S3_BUCKET="$S3_BUCKET_ENV"
    export S3_FORCE_PATH_STYLE="false"
    export S3_PUBLIC_URL="$S3_PUBLIC_URL_ENV"
    echo "   S3: AWS S3 via Cloudflare CDN (bucket: $S3_BUCKET)"
else
    # MinIO configuration (local development)
    export S3_ENDPOINT="http://localhost:$MINIO_PORT"
    export S3_REGION="us-east-1"
    export S3_ACCESS_KEY="minioadmin"
    export S3_SECRET_KEY="minioadmin"
    export S3_BUCKET="adashield"
    export S3_FORCE_PATH_STYLE="true"
    export S3_PUBLIC_URL=""
    echo "   S3: MinIO (bucket: $S3_BUCKET)"
fi

# Start API
echo "🚀 Starting API server..."
cd "$SCRIPT_DIR/apps/api"
nohup pnpm dev > "$LOG_DIR/api.log" 2>&1 &
API_PID=$!
echo $API_PID > "$API_PID_FILE"
echo "   API PID: $API_PID"

# Wait for API to be ready
echo "   Waiting for API to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:3080/api/v1/health > /dev/null 2>&1; then
        echo "   ✅ API is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "   ⚠️  API taking longer than expected. Check logs: $LOG_DIR/api.log"
    fi
    sleep 1
done

# Start Web
echo ""
echo "🚀 Starting Web frontend..."
cd "$SCRIPT_DIR/apps/web"
nohup pnpm dev > "$LOG_DIR/web.log" 2>&1 &
WEB_PID=$!
echo $WEB_PID > "$WEB_PID_FILE"
echo "   Web PID: $WEB_PID"

# Wait for Web to be ready
echo "   Waiting for Web to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo "   ✅ Web is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "   ⚠️  Web taking longer than expected. Check logs: $LOG_DIR/web.log"
    fi
    sleep 1
done

# Start Worker
echo ""
echo "🚀 Starting Worker (background job processor)..."
cd "$SCRIPT_DIR/apps/worker"
nohup pnpm dev > "$LOG_DIR/worker.log" 2>&1 &
WORKER_PID=$!
echo $WORKER_PID > "$WORKER_PID_FILE"
echo "   Worker PID: $WORKER_PID"

# Wait for Worker to be ready (check if process is still running after a few seconds)
echo "   Waiting for Worker to initialize..."
sleep 3
if kill -0 "$WORKER_PID" 2>/dev/null; then
    echo "   ✅ Worker is running!"
else
    echo "   ⚠️  Worker may have failed to start. Check logs: $LOG_DIR/worker.log"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ ADAShield is running!"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "🌐 URLs:"
echo "   Web App:     http://localhost:3000"
echo "   Admin Panel: http://localhost:3000/admin"
echo "   API Health:  http://localhost:3080/api/v1/health"
echo ""
echo "🔑 Admin Credentials:"
echo "   Super Admin: superadmin@adashield.dev / superadmin123"
echo "   Admin:       admin@adashield.dev / admin123"
echo ""
echo "📋 Logs:"
echo "   API:    $LOG_DIR/api.log"
echo "   Web:    $LOG_DIR/web.log"
echo "   Worker: $LOG_DIR/worker.log"
echo ""
echo "💡 To stop: ./app-stop.sh"
echo "════════════════════════════════════════════════════════════"
