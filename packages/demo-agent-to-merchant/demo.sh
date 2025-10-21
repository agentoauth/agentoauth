#!/bin/bash

# AgentOAuth Demo - Agent to Merchant Payment Flow
# This script demonstrates the complete authorization flow

set -e

echo ""
echo "🎬 AgentOAuth Demo: Agent-to-Merchant Payment"
echo "=============================================="
echo ""
echo "This demo shows how an AI agent uses AgentOAuth to prove"
echo "authorization when making payments to a merchant."
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if in correct directory
if [ ! -f "merchant.js" ]; then
    echo "❌ Error: Run this script from packages/demo-agent-to-merchant/"
    exit 1
fi

# Start merchant server in background
echo -e "${BLUE}1️⃣ Starting merchant server...${NC}"
node merchant.js &
MERCHANT_PID=$!

# Wait for server to start
sleep 3

echo ""
echo -e "${BLUE}2️⃣ Scenario 1: Successful Payment${NC}"
echo "   User Alice authorizes payment bot for up to \$1000"
echo "   Agent requests \$150 payment"
echo ""

node agent.js --user "did:example:alice" \
              --agent "payment-bot@demo" \
              --amount 150 \
              --currency USD \
              --limit 1000 \
              --merchant http://localhost:4000

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${BLUE}3️⃣ Scenario 2: Amount Exceeds Limit${NC}"
echo "   Agent attempts \$2000 payment with \$1000 limit"
echo ""

node agent.js --user "did:example:alice" \
              --amount 2000 \
              --limit 1000 \
              --merchant http://localhost:4000 || true

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${BLUE}4️⃣ Scenario 3: Different User, Smaller Payment${NC}"
echo "   User Bob authorizes for \$500"
echo "   Agent requests \$100 payment"
echo ""

node agent.js --user "did:example:bob" \
              --agent "assistant-bot@demo" \
              --amount 100 \
              --limit 500 \
              --merchant http://localhost:4000

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get transaction summary
echo -e "${BLUE}5️⃣ Transaction Summary${NC}"
echo ""
curl -s http://localhost:4000/api/transactions | python3 -m json.tool || \
curl -s http://localhost:4000/api/transactions | jq || \
curl -s http://localhost:4000/api/transactions

echo ""
echo ""

# Cleanup
echo -e "${YELLOW}🧹 Cleaning up...${NC}"
kill $MERCHANT_PID 2>/dev/null || true

echo ""
echo -e "${GREEN}✅ Demo complete!${NC}"
echo ""
echo "Key takeaways:"
echo "  ✅ Agents create cryptographically signed authorization tokens"
echo "  ✅ Merchants verify signatures and check authorization limits"
echo "  ✅ Payments are rejected if they exceed authorized limits"
echo "  ✅ Full audit trail with user, agent, and transaction details"
echo ""

