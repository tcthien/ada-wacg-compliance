#!/bin/bash
# Stop ADAShield infrastructure services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🛑 Stopping ADAShield infrastructure..."

docker-compose -f docker-compose.dev.yml down

echo ""
echo "✅ Infrastructure stopped!"
echo ""
echo "💡 To also remove volumes (database data), run:"
echo "   docker-compose -f docker-compose.dev.yml down -v"
