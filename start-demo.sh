#!/bin/bash

# AgentOAuth Demo Startup Script
# This script ensures everything is built and started in the correct order

set -e  # Exit on error

echo "🚀 Starting AgentOAuth Demo..."
echo ""

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed!"
    echo "   Install it with: npm install -g pnpm"
    exit 1
fi

echo "✅ pnpm found ($(pnpm --version))"
echo ""

# Check if we're in the right directory
if [ ! -f "pnpm-workspace.yaml" ]; then
    echo "❌ Not in project root! Please run from /Users/prithvi/projects/agentoauth"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install --silent
echo "✅ Dependencies installed"
echo ""

# Build SDK (required for verifier-api)
echo "🔨 Building SDK..."
cd packages/sdk-js
pnpm build
cd ../..
echo "✅ SDK built"
echo ""

# Build verifier API
echo "🔨 Building verifier API..."
cd packages/verifier-api
pnpm build
cd ../..
echo "✅ Verifier API built"
echo ""

echo "✅ All packages built successfully!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "To start the demo, run in separate terminals:"
echo ""
echo "  Terminal 1 (Verifier API):"
echo "  cd packages/verifier-api && pnpm dev"
echo ""
echo "  Terminal 2 (Playground):"
echo "  cd packages/playground && pnpm dev"
echo ""
echo "Then open: http://localhost:8080"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

