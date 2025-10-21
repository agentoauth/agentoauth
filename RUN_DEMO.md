# 🎬 Running the Agent-to-Merchant Demo

## What This Demo Shows

A complete end-to-end flow where:
1. **User (Alice)** authorizes a payment bot for up to $1000
2. **Agent (payment-bot)** creates a cryptographically signed authorization token
3. **Agent** sends payment request ($150) with the token to a merchant
4. **Merchant** verifies the token and checks authorization limits
5. **Merchant** processes the payment and returns confirmation

## Quick Start

### One-Command Demo (Automated)

```bash
cd /Users/prithvi/projects/agentoauth/packages/demo-agent-to-merchant
bash demo.sh
```

This runs 3 scenarios automatically:
- ✅ Successful $150 payment (within $1000 limit)
- ❌ Failed $2000 payment (exceeds $1000 limit)  
- ✅ Successful $100 payment from different user

**Total time:** ~10 seconds

### Manual Demo (Interactive)

**Terminal 1: Start Merchant Server**
```bash
cd packages/demo-agent-to-merchant
node merchant.js
```

You'll see:
```
💰 AgentOAuth Merchant Server

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Service: Merchant Payment Processor
Port: 4000
Audience: merchant-demo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Merchant server listening on http://localhost:4000
   Payment endpoint: POST /api/payment
   Transactions: GET /api/transactions
   Health: GET /health

⏳ Waiting for payment requests...
```

**Terminal 2: Make Payments**
```bash
cd packages/demo-agent-to-merchant

# Successful payment
node agent.js --amount 150

# Payment exceeding limit
node agent.js --amount 2000 --limit 1000

# Different user
node agent.js --user did:example:bob --amount 100
```

## What You'll See

### Agent Output (Terminal 2)

```
🤖 AgentOAuth Payment Agent

📝 Payment Request:
   User: did:example:alice
   Agent: payment-bot@demo
   Amount: $150.00 USD
   Limit: $1000.00 USD
   Merchant: http://localhost:4000
   Scope: pay:merchant

🔑 Generating new Ed25519 keypair...
✅ Keypair generated and saved
   Private: /path/to/keys/agent-private.json
   Public: /path/to/keys/agent-public.json
   Key ID: agent-key-1729512345

🎫 Creating authorization token...
✅ Token created
   Preview: eyJhbGciOiJFZERTQSIsImtpZCI6ImFnZW50LWtleS0x...

💸 Sending payment to merchant...
   POST http://localhost:4000/api/payment

✅ Payment Successful!

   Transaction ID: tx_1729512345_a1b2c3d4
   Authorized by: did:example:alice
   Agent: payment-bot@demo
   Amount: $150.00 USD
   Timestamp: 2025-10-21T12:34:56.789Z
   Remaining limit: $850.00
```

### Merchant Output (Terminal 1)

```
📥 [a1b2c3d4] Payment request received
   Amount: $150.00 USD
   Description: Payment via AgentOAuth demo

🔐 [a1b2c3d4] Verifying authorization token...
   Token hash: 3a5d8f2e9c1b4e7a

✅ [a1b2c3d4] Token verified
   User: did:example:alice
   Agent: payment-bot@demo
   Scope: pay:merchant

✅ [a1b2c3d4] Payment processed successfully
   Transaction ID: tx_1729512345_a1b2c3d4
```

## Demo Scenarios

### 1. Successful Payment ✅

```bash
node agent.js --amount 150 --limit 1000
```

- Creates token with $1000 limit
- Requests $150 payment
- Merchant verifies and approves
- **Result:** Payment successful!

### 2. Limit Exceeded ❌

```bash
node agent.js --amount 2000 --limit 1000
```

- Creates token with $1000 limit
- Requests $2000 payment (exceeds limit!)
- Merchant verifies but rejects
- **Result:** Payment rejected - limit exceeded

### 3. Multiple Users

```bash
# Alice pays $150
node agent.js --user did:example:alice --amount 150

# Bob pays $100  
node agent.js --user did:example:bob --amount 100

# Carol pays $50
node agent.js --user did:example:carol --amount 50
```

Each user gets their own keypair and authorization tokens!

## View All Transactions

```bash
curl http://localhost:4000/api/transactions | jq
```

Or visit in browser: http://localhost:4000/api/transactions

## Stopping the Demo

If running manually, press `Ctrl+C` in the merchant terminal.

The automated demo (`demo.sh`) cleans up automatically.

## What This Proves

✅ **Cryptographic Authorization**: Agent proves user Alice authorized the payment
✅ **Limit Enforcement**: Merchant enforces the $1000 spending limit
✅ **Tamper-Proof**: Any modification to amount/user would invalidate signature
✅ **Expiration**: Tokens expire after 1 hour (not shown in demo but enforced)
✅ **Scope Enforcement**: Only payment actions allowed (not data access, etc.)
✅ **Audit Trail**: Complete log of who authorized what payment

## Troubleshooting

### "Cannot find module '@agentoauth/sdk'"

Build the SDK first:
```bash
cd /Users/prithvi/projects/agentoauth
pnpm build
```

### "ECONNREFUSED" when agent runs

Merchant server not running. Start it:
```bash
node merchant.js
```

### Port 4000 already in use

```bash
PORT=4001 node merchant.js

# Then use:
node agent.js --merchant http://localhost:4001
```

## Next Steps

1. **Run the demo**: `bash demo.sh`
2. **Try different amounts**: Test the limit enforcement
3. **Check transactions**: `curl http://localhost:4000/api/transactions`
4. **Read the code**: See how tokens are created and verified
5. **Extend it**: Add nonce tracking, real verification, database storage

See `SCENARIO.md` for detailed scenario walkthroughs!

