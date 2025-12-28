#!/bin/bash
# Start ADAShield infrastructure services (PostgreSQL, Redis, MinIO)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting ADAShield infrastructure..."

docker-compose -f docker-compose.dev.yml up -d

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 5

# Check service status
docker-compose -f docker-compose.dev.yml ps

echo ""
echo "✅ Infrastructure started!"
echo ""
echo "📊 Service URLs:"
docker-compose -f docker-compose.dev.yml ps --format "table {{.Name}}\t{{.Ports}}" | grep -v "^NAME"
echo ""
echo "🔗 MinIO Console: http://localhost:$(docker-compose -f docker-compose.dev.yml port minio 9001 | cut -d: -f2) (minioadmin/minioadmin)"
