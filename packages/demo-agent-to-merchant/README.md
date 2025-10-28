# Agent-to-Merchant Payment Demo

This demo shows a complete end-to-end flow of an AI agent making authorized payments to a merchant using AgentOAuth tokens.

## Scenario

**Situation:** Alice wants her payment bot to pay a merchant for freelance work.

**Flow:**
1. Alice authorizes her payment bot for up to $1000
2. Payment bot creates an AgentOAuth token proving this authorization
3. Payment bot sends a payment request ($150) to the merchant with the token
4. Merchant verifies the token and checks authorization
5. Merchant processes the payment and returns confirmation

## Quick Start

### Install Dependencies

```bash
cd /Users/prithvi/projects/agentoauth
pnpm install
pnpm build

cd packages/demo-agent-to-merchant
```

### Run the Demo

**Option 1: Automated Demo (Recommended)**

```bash
bash demo.sh
```

This runs multiple scenarios automatically:
- ✅ Successful payment within limit
- ❌ Payment exceeding limit
- ✅ Different user and amount

**Option 2: Manual Testing**

Terminal 1 - Start merchant server:
```bash
node merchant.js
```

Terminal 2 - Make payments:
```bash
# Successful payment
node agent.js --amount 150

# Payment exceeding limit
node agent.js --amount 2000 --limit 1000

# Custom user
node agent.js --user did:example:bob --amount 100
```

## Components

### agent.js - Payment Agent

Simulates an AI agent that:
- Generates Ed25519 keypair (saved to `keys/` directory)
- Creates AgentOAuth authorization tokens
- Sends payment requests to merchant
- Displays results with color-coded output

**Arguments:**
- `--user` - User identifier (default: did:example:alice)
- `--agent` - Agent identifier (default: payment-bot@demo)
- `--amount` - Payment amount (default: 150)
- `--currency` - Currency code (default: USD)
- `--limit` - Authorization limit (default: 1000)
- `--merchant` - Merchant URL (default: http://localhost:4000)
- `--scope` - Authorization scope (default: pay:merchant)
- `--description` - Payment description

### merchant.js - Merchant Server

Simulates a merchant that:
- Accepts payment requests on port 4000
- Verifies AgentOAuth tokens
- Checks authorization (scope, limit, currency)
- Processes payments
- Logs all transactions
- Returns detailed responses

**Endpoints:**
- `POST /api/payment` - Process payment with authorization
- `GET /api/transactions` - List all transactions
- `GET /health` - Health check

## Demo Scenarios

### Scenario 1: Successful Payment ✅

```bash
node agent.js --amount 150 --limit 1000
```

**What happens:**
1. Agent creates token with $1000 USD limit
2. Agent requests $150 payment
3. Merchant verifies: ✅ Signature valid, ✅ Amount within limit
4. Payment processed successfully

**Output:**
```
✅ Payment Successful!
   Transaction ID: tx_1729512345_a1b2c3d4
   Authorized by: did:example:alice
   Agent: payment-bot@demo
   Amount: $150.00 USD
   Remaining limit: $850.00
```

### Scenario 2: Limit Exceeded ❌

```bash
node agent.js --amount 2000 --limit 1000
```

**What happens:**
1. Agent creates token with $1000 USD limit
2. Agent requests $2000 payment
3. Merchant verifies: ✅ Signature valid, ❌ Amount exceeds limit
4. Payment REJECTED

**Output:**
```
❌ Payment Failed!
   Error: Amount exceeds authorized limit
   Code: LIMIT_EXCEEDED
   Details: {"requested": 2000, "authorized": 1000}
```

### Scenario 3: Expired Token ❌

To test this, you'd need to modify the agent to create an expired token:

```javascript
// In agent.js, change:
exp: Math.floor(Date.now() / 1000) - 3600  // 1 hour ago
```

**Output:**
```
❌ Payment Failed!
   Error: Token verification failed: Token expired
   Code: EXPIRED
```

### Scenario 4: Wrong Scope ❌

```bash
node agent.js --scope read:data --amount 100
```

**Output:**
```
❌ Payment Failed!
   Error: Invalid scope: expected 'pay:merchant', got 'read:data'
   Code: INVALID_SCOPE
```

## Architecture

```
┌─────────┐              ┌──────────────┐              ┌──────────┐
│  User   │              │  agent.js    │              │merchant.js│
│ (Alice) │              │ Payment Bot  │              │ Server   │
└────┬────┘              └──────┬───────┘              └─────┬────┘
     │                          │                            │
     │  1. Authorize payment    │                            │
     │  (up to $1000)           │                            │
     ├─────────────────────────>│                            │
     │                          │                            │
     │                          │  2. Create token           │
     │                          │  (sign with private key)   │
     │                          │                            │
     │                          │  3. POST /api/payment      │
     │                          │  { authToken, amount }     │
     │                          ├───────────────────────────>│
     │                          │                            │
     │                          │                            │  4. Verify token
     │                          │                            │  (check signature)
     │                          │                            │
     │                          │                            │  5. Check authorization
     │                          │                            │  (scope, limit, exp)
     │                          │                            │
     │                          │  6. Payment result         │
     │                          │<───────────────────────────┤
     │                          │  { success, transactionId }│
     │                          │                            │
     │  7. Show result          │                            │
     │<─────────────────────────┤                            │
     │                          │                            │
```

## What This Demonstrates

### AgentOAuth Protocol Features

✅ **Authorization Proof**: Cryptographic proof that user authorized the action
✅ **Limit Enforcement**: Merchants can enforce spending limits
✅ **Scope Validation**: Actions are restricted to authorized scopes
✅ **Expiration**: Authorizations expire automatically
✅ **Audience Targeting**: Tokens can be restricted to specific merchants
✅ **Audit Trail**: Complete log of who authorized what

### Security Benefits

✅ **Non-repudiation**: Signature proves user authorized the payment
✅ **Tamper-proof**: Any modification invalidates the signature
✅ **Time-limited**: Authorizations expire (1 hour in this demo)
✅ **Amount-limited**: Can't exceed the authorized limit
✅ **Scope-limited**: Token only valid for payment, not other actions

## Extending the Demo

### Add Real Signature Verification

Currently uses `decode()` for simplicity. For production, use `verify()`:

```javascript
// In merchant.js, replace verifyTokenLocal with:
import { verify } from '@agentoauth/sdk';

const result = await verify(
  authToken,
  'http://localhost:3000/.well-known/jwks.json',
  { audience: 'merchant-demo' }
);
```

### Add Nonce Tracking

Prevent replay attacks:

```javascript
const usedNonces = new Set();

if (usedNonces.has(payload.nonce)) {
  return { error: 'Token already used (replay attack detected)' };
}
usedNonces.add(payload.nonce);
```

### Add Database Storage

Replace in-memory transactions with a database:

```javascript
// Using SQLite, PostgreSQL, etc.
await db.transactions.create({
  transactionId,
  authorizedBy: payload.user,
  amount,
  ...
});
```

### Add Web UI

Create a simple UI showing:
- Payment form
- Transaction history
- Authorization status

## Troubleshooting

### "ECONNREFUSED" error

Merchant server isn't running. Start it first:
```bash
node merchant.js
```

### "pnpm: command not found"

Install pnpm:
```bash
npm install -g pnpm
```

Or use npm:
```bash
npm install
npm run demo
```

### Keys not found

Keys are auto-generated on first run. They're saved in `keys/` directory.

To regenerate:
```bash
rm -rf keys/
node agent.js  # Will create new keys
```

## Files

- `agent.js` - Payment agent script (~160 lines)
- `merchant.js` - Merchant server (~200 lines)
- `demo.sh` - Automated demo runner (~60 lines)
- `package.json` - Dependencies and scripts
- `README.md` - This file
- `SCENARIO.md` - Detailed scenarios
- `keys/` - Generated keypairs (gitignored)

## 🌐 Hosted Verifier Integration

### Web Dashboard at http://localhost:4000

The merchant now includes a **beautiful web dashboard** that shows:

- ✅ **Verifier Mode**: Visual indicator of local vs hosted verification
- 📊 **Real-time Stats**: Transaction count and total volume  
- 🔑 **API Key Status**: Displays configured API key (masked)
- 💳 **Live Transactions**: Recent payments with auto-refresh
- 🌐 **Verification Details**: Service endpoint and audience info

### Test with Hosted Verifier

1. **Set up environment:**
```bash
export USE_HOSTED_VERIFIER=true
export AGENTOAUTH_API_KEY="ak_your_generated_api_key"
```

2. **Test setup:**
```bash
pnpm test-hosted
```

3. **Start merchant:**
```bash
pnpm merchant
```

4. **Open dashboard:** `http://localhost:4000`

5. **Generate payments:** `pnpm agent`

The dashboard **auto-refreshes every 5 seconds** to show real-time verification results!

## License

MIT AND Apache-2.0

