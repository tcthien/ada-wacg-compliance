#!/bin/bash
# Restart ADAShield API, Web, and Worker services

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔄 Restarting ADAShield services..."
echo ""

# Stop all services
"$SCRIPT_DIR/app-stop.sh"

echo ""
echo "⏳ Waiting 2 seconds before restart..."
sleep 2
echo ""

# Start all services
"$SCRIPT_DIR/app-start.sh"
