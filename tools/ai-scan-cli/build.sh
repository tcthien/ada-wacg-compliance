#!/bin/bash
# Build script for AI Scan CLI

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== AI Scan CLI Build ==="
echo "Directory: $SCRIPT_DIR"
echo ""

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "Error: pnpm is not installed"
    echo "Install with: npm install -g pnpm"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    pnpm install
    echo ""
fi

# Build
echo "Building TypeScript..."
pnpm build

echo ""
echo "Build complete! Output in dist/"
echo ""
echo "Run with: ./run.sh -i <input.csv> -o <output-dir>"
