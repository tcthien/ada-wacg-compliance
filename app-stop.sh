#!/bin/bash
# Stop ADAShield API, Web, and Worker services

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

API_PID_FILE="$SCRIPT_DIR/.api.pid"
WEB_PID_FILE="$SCRIPT_DIR/.web.pid"
WORKER_PID_FILE="$SCRIPT_DIR/.worker.pid"

echo "🛑 Stopping ADAShield services..."

# Stop API
if [ -f "$API_PID_FILE" ]; then
    API_PID=$(cat "$API_PID_FILE")
    if kill -0 "$API_PID" 2>/dev/null; then
        echo "   Stopping API (PID: $API_PID)..."
        kill "$API_PID" 2>/dev/null
        # Wait for graceful shutdown
        for i in {1..10}; do
            if ! kill -0 "$API_PID" 2>/dev/null; then
                break
            fi
            sleep 1
        done
        # Force kill if still running
        if kill -0 "$API_PID" 2>/dev/null; then
            kill -9 "$API_PID" 2>/dev/null
        fi
        echo "   ✅ API stopped"
    else
        echo "   ℹ️  API was not running"
    fi
    rm -f "$API_PID_FILE"
else
    echo "   ℹ️  No API PID file found"
fi

# Stop Web
if [ -f "$WEB_PID_FILE" ]; then
    WEB_PID=$(cat "$WEB_PID_FILE")
    if kill -0 "$WEB_PID" 2>/dev/null; then
        echo "   Stopping Web (PID: $WEB_PID)..."
        kill "$WEB_PID" 2>/dev/null
        # Wait for graceful shutdown
        for i in {1..10}; do
            if ! kill -0 "$WEB_PID" 2>/dev/null; then
                break
            fi
            sleep 1
        done
        # Force kill if still running
        if kill -0 "$WEB_PID" 2>/dev/null; then
            kill -9 "$WEB_PID" 2>/dev/null
        fi
        echo "   ✅ Web stopped"
    else
        echo "   ℹ️  Web was not running"
    fi
    rm -f "$WEB_PID_FILE"
else
    echo "   ℹ️  No Web PID file found"
fi

# Stop Worker
if [ -f "$WORKER_PID_FILE" ]; then
    WORKER_PID=$(cat "$WORKER_PID_FILE")
    if kill -0 "$WORKER_PID" 2>/dev/null; then
        echo "   Stopping Worker (PID: $WORKER_PID)..."
        kill "$WORKER_PID" 2>/dev/null
        # Wait for graceful shutdown
        for i in {1..10}; do
            if ! kill -0 "$WORKER_PID" 2>/dev/null; then
                break
            fi
            sleep 1
        done
        # Force kill if still running
        if kill -0 "$WORKER_PID" 2>/dev/null; then
            kill -9 "$WORKER_PID" 2>/dev/null
        fi
        echo "   ✅ Worker stopped"
    else
        echo "   ℹ️  Worker was not running"
    fi
    rm -f "$WORKER_PID_FILE"
else
    echo "   ℹ️  No Worker PID file found"
fi

# Also kill any orphaned pnpm dev processes for this project
echo ""
echo "🧹 Cleaning up any orphaned processes..."
pkill -f "pnpm dev.*ada-wacg-compliance/apps/api" 2>/dev/null || true
pkill -f "pnpm dev.*ada-wacg-compliance/apps/web" 2>/dev/null || true
pkill -f "pnpm dev.*ada-wacg-compliance/apps/worker" 2>/dev/null || true
pkill -f "next dev --port 3000" 2>/dev/null || true
pkill -f "tsx.*worker" 2>/dev/null || true

echo ""
echo "✅ All services stopped!"
echo ""
echo "💡 Infrastructure (Docker) is still running."
echo "   To stop infrastructure: ./infra-stop.sh"
