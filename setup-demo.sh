#!/bin/bash

# AgentOAuth Demo Setup Script (using npm)
# This script sets up everything needed to run the agent-to-merchant demo

set -e

echo "🚀 Setting up AgentOAuth Demo..."
echo ""

# Go to project root
cd "$(dirname "$0")"

echo "📦 Installing dependencies with npm..."
npm install

echo ""
echo "🔨 Building SDK..."
cd packages/sdk-js
npm run build

echo ""
echo "🔨 Building Verifier API..."
cd ../verifier-api  
npm run build

echo ""
echo "✅ Setup complete!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "To run the agent-to-merchant demo:"
echo ""
echo "  cd packages/demo-agent-to-merchant"
echo "  bash demo.sh"
echo ""
echo "Or run manually:"
echo ""
echo "  Terminal 1: node merchant.js"
echo "  Terminal 2: node agent.js --amount 150"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

