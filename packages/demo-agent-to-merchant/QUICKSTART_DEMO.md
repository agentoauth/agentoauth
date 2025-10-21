# Agent-to-Merchant Demo - 30 Second Quickstart

## Prerequisites

```bash
cd /Users/prithvi/projects/agentoauth
pnpm install && pnpm build
```

## Run the Demo (10 seconds)

```bash
cd packages/demo-agent-to-merchant
bash demo.sh
```

## What You'll See

```
🎬 AgentOAuth Demo: Agent-to-Merchant Payment

1️⃣ Starting merchant server...
✅ Merchant server listening on http://localhost:4000

2️⃣ Scenario 1: Successful Payment
✅ Payment Successful!
   Transaction ID: tx_1729512345_a1b2c3d4
   Amount: $150.00 USD
   Remaining limit: $850.00

3️⃣ Scenario 2: Amount Exceeds Limit
❌ Payment Failed!
   Error: Amount exceeds authorized limit
   Code: LIMIT_EXCEEDED

4️⃣ Scenario 3: Different User, Smaller Payment
✅ Payment Successful!
   Transaction ID: tx_1729512346_e5f6g7h8
   Amount: $100.00 USD

5️⃣ Transaction Summary
{
  "count": 2,
  "transactions": [...]
}

✅ Demo complete!
```

## What Just Happened?

1. ✅ Agent created cryptographically signed authorization tokens
2. ✅ Merchant verified signatures and authorization limits
3. ✅ Successful payments were processed
4. ❌ Payments exceeding limits were rejected
5. ✅ Full audit trail was logged

## Try It Manually

**Terminal 1:**
```bash
node merchant.js
```

**Terminal 2:**
```bash
# Success
node agent.js --amount 150

# Failure (exceeds limit)
node agent.js --amount 2000 --limit 1000

# Custom user
node agent.js --user did:example:bob --amount 100
```

## View Transactions

```bash
curl http://localhost:4000/api/transactions
```

That's it! See `README.md` for full documentation.

