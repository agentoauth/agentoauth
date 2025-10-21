#!/bin/bash

# Quick script to rebuild and start the verifier API with logging

echo "🔨 Rebuilding verifier API with new logging..."
cd /Users/prithvi/projects/agentoauth/packages/verifier-api
pnpm build

echo ""
echo "🚀 Starting verifier API on port 3000..."
echo "   Press Ctrl+C to stop"
echo ""

pnpm dev

