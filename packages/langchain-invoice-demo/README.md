# LangChain × AgentOAuth Invoice Payer Demo

> **An autonomous AI agent that pays invoices safely under verifiable policy limits**

This demo shows a real-world LangChain agent making verified Stripe payments, with every transaction gated by AgentOAuth policy verification via [verifier.agentoauth.org](https://verifier.agentoauth.org).

## What This Demonstrates

- 🤖 **Autonomous payments** - LangChain agent processes invoices automatically
- 🔐 **Policy enforcement** - AgentOAuth verifier enforces spending limits
- 💳 **Real payment rails** - Stripe test API integration
- 📝 **Audit trail** - Every payment has a cryptographically signed receipt
- ⚠️ **Over-limit protection** - Agent is blocked from exceeding policy caps

## Two Ways to Run

### Option A: Visual UI Dashboard (Recommended) 🎨

Watch the agent work in real-time with a beautiful animated dashboard!

```bash
cd packages/langchain-invoice-demo/ui
cp .env.example .env
# Add your STRIPE_SECRET_KEY to .env
pnpm dev
```

Open [http://localhost:3001](http://localhost:3001) and click **"Start Processing"**

[See UI README for details →](./ui/README.md)

### Option B: Command Line 💻

Run the agent from your terminal:

## Quick Start (CLI)

### Prerequisites

- Node.js 20+
- [Stripe test API key](https://dashboard.stripe.com/test/apikeys)
- [OpenAI API key](https://platform.openai.com/api-keys)

### 1. Install Dependencies

```bash
# From monorepo root
cd /path/to/agentoauth
pnpm install
```

### 2. Configure Environment

```bash
cd packages/langchain-invoice-demo
cp env.template .env
# Edit .env and add your API keys:
# - STRIPE_SECRET_KEY=sk_test_...
# - OPENAI_API_KEY=sk-...
```

### 3. Run the Demo

```bash
# From packages/langchain-invoice-demo directory
pnpm start
```

### 4. Watch the Magic

The agent will:
1. Load 3 sample invoices
2. Generate an AgentOAuth consent token with policy limits
3. Process each invoice:
   - Verify authorization with `verifier.agentoauth.org`
   - Create Stripe payment if approved
   - Log receipt URL
4. Provide a summary of paid/denied transactions

### 5. Verify Results

**Check Stripe Dashboard:**
- Visit [dashboard.stripe.com/test/payments](https://dashboard.stripe.com/test/payments)
- Look for payments with AgentOAuth metadata:
  - `receipt_id`: Link to verifier receipt
  - `policy_id`: Policy that authorized the payment
  - `consent_token`: Agent's authorization token (preview)

**Check Verifier Receipts:**
- Visit `https://verifier.agentoauth.org/receipts/{receipt_id}` (from logs)
- Verifiable JWS-signed proof of authorization decision

## Expected Output

```
╔═══════════════════════════════════════════════════════════════╗
║     🤖 AgentOAuth × LangChain Invoice Payer Demo            ║
╚═══════════════════════════════════════════════════════════════╝

📄 Loading invoices...
✅ Loaded 3 invoices

🔑 Generating signing keypair...
✅ Keypair generated (kid: finance-agent-key-1)

📋 Creating payment policy...
✅ Policy created:
   Per-transaction limit: $500 USD
   Weekly budget: $2000 USD
   Allowed merchants: airbnb, expedia, uber
   Policy ID: pol_travel_abc123

🎫 Issuing consent token...
✅ Consent token issued

💳 Initializing Stripe (test mode)...
✅ Stripe initialized

🔧 Creating LangChain tool...
✅ Tool created

🤖 Initializing LangChain agent...
✅ Agent ready

═══════════════════════════════════════════════════════════════
                   PROCESSING INVOICES
═══════════════════════════════════════════════════════════════

🔍 Processing inv_001: airbnb - $300 USD
  → Verifying with AgentOAuth...
  ✅ Verified: ALLOW
  📊 Remaining budget: $1700
  → Creating Stripe payment...
  ✅ Payment successful: pi_123abc
  📝 Receipt: https://verifier.agentoauth.org/receipts/rcpt_xyz

🔍 Processing inv_002: expedia - $700 USD
  → Verifying with AgentOAuth...
  ⚠️  DENIED: Amount 700 USD exceeds per-transaction limit 500 USD

🔍 Processing inv_003: uber - $150 USD
  → Verifying with AgentOAuth...
  ✅ Verified: ALLOW
  📊 Remaining budget: $1550
  → Creating Stripe payment...
  ✅ Payment successful: pi_456def
  📝 Receipt: https://verifier.agentoauth.org/receipts/rcpt_abc

═══════════════════════════════════════════════════════════════
                      AGENT SUMMARY
═══════════════════════════════════════════════════════════════

Successfully processed 3 invoices:

✅ PAID (2):
   - inv_001: $300 (Airbnb - Hotel)
   - inv_003: $150 (Uber - Transportation)
   Total paid: $450

❌ DENIED (1):
   - inv_002: $700 (Expedia - Flights)
   Reason: Exceeds per-transaction limit of $500

💰 Budget Status:
   - Spent this week: $450 / $2000
   - Remaining: $1550
```

## How It Works

### 1. Policy Creation

The agent creates a policy with clear limits:

```typescript
{
  "version": "pol.v0.2",
  "id": "pol_travel_weekly",
  "actions": ["payments.send"],
  "resources": [
    {"type": "merchant", "match": {"ids": ["airbnb", "expedia", "uber"]}}
  ],
  "limits": {
    "per_txn": {"amount": 500, "currency": "USD"},
    "per_period": {"amount": 2000, "currency": "USD", "period": "week"}
  },
  "constraints": {
    "time": {
      "dow": ["Mon", "Tue", "Wed", "Thu", "Fri"],
      "start": "08:00",
      "end": "20:00",
      "tz": "America/Los_Angeles"
    }
  }
}
```

### 2. Verification Flow

```
Invoice → Agent → Verifier → Stripe
                     ↓
              Policy Decision
              (ALLOW/DENY)
                     ↓
              Signed Receipt
```

For each invoice:
1. **Agent** sends consent token + invoice details to verifier
2. **Verifier** checks:
   - Token signature valid?
   - Policy hash matches?
   - Action allowed?
   - Merchant whitelisted?
   - Amount under per-txn limit?
   - Weekly budget not exceeded?
   - Time constraints met?
3. **Verifier** returns `ALLOW` or `DENY` with signed receipt
4. **Agent** proceeds to Stripe only if `ALLOW`

### 3. Stripe Integration

Every payment includes AgentOAuth metadata:

```json
{
  "invoice_id": "inv_001",
  "merchant": "airbnb",
  "policy_id": "pol_travel_weekly",
  "receipt_id": "rcpt_xyz123",
  "verifier": "verifier.agentoauth.org"
}
```

This creates a complete audit trail linking:
- Stripe payment → AgentOAuth receipt → Policy → User authorization

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    LangChain Agent                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 1. Generate AgentOAuth consent token with policy     │   │
│  │ 2. Read invoices from invoices.json                  │   │
│  │ 3. For each invoice, call verify_and_pay tool        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
          ┌───────────────────────────────┐
          │   verify_and_pay Tool         │
          ├───────────────────────────────┤
          │ POST /verify                  │──► verifier.agentoauth.org
          │   - token                     │       │
          │   - invoice context           │       ├─ Validate signature
          │                               │       ├─ Check policy hash
          │                               │       ├─ Evaluate limits
          │                               │       ├─ Track budget (DO)
          │                               │       └─ Return decision + receipt
          │                               │
          │ If ALLOW:                     │
          │   Stripe PaymentIntent.create │──► Stripe Test API
          │   - amount, currency           │       │
          │   - metadata: receipt_id       │       └─ Payment successful
          └───────────────────────────────┘
```

## Files

- `agent.ts` - Main LangChain agent orchestration
- `tools/verify-and-pay.ts` - Custom LangChain tool (verify + pay)
- `utils/policy.ts` - Policy builder helper
- `invoices.json` - Sample invoice data
- `env.template` - Environment variables template

## Policy Limits (Configured)

| Limit Type | Amount | Result |
|------------|--------|--------|
| Per-transaction | $500 | Invoice #2 ($700) **DENIED** |
| Weekly budget | $2000 | Tracks across all payments |
| Time window | Mon-Fri, 8am-8pm PT | Outside hours **DENIED** |
| Merchants | airbnb, expedia, uber | Other merchants **DENIED** |

## Customization

### Change Policy Limits

Edit `utils/policy.ts`:

```typescript
.limitPerTxn(1000, 'USD')       // Raise per-txn limit
.limitPerPeriod(5000, 'USD', 'month')  // Change to monthly budget
.merchants(['airbnb', 'expedia', 'uber', 'delta'])  // Add airlines
```

### Use Local Verifier

Change `.env`:

```bash
VERIFIER_URL=http://localhost:3000
```

Then start local verifier:

```bash
cd packages/verifier-api
pnpm dev
```

### Add More Invoices

Edit `invoices.json` and add entries:

```json
{
  "invoice_id": "inv_004",
  "merchant": "delta",
  "amount": 450,
  "currency": "USD",
  "due_date": "2025-11-20",
  "description": "Flight upgrade"
}
```

## Troubleshooting

**Error: STRIPE_SECRET_KEY not set**
- Get test key from: https://dashboard.stripe.com/test/apikeys
- Add to `.env`: `STRIPE_SECRET_KEY=sk_test_...`

**Error: OPENAI_API_KEY not set**
- Get API key from: https://platform.openai.com/api-keys
- Add to `.env`: `OPENAI_API_KEY=sk-...`

**All payments denied**
- Check policy limits in `utils/policy.ts`
- Verify time constraints (must be Mon-Fri, 8am-8pm PT)
- Check merchant whitelist

**Verification fails**
- Ensure `verifier.agentoauth.org` is accessible
- Check token expiration (default: 7 days)
- Verify policy hash matches

## Learn More

- [AgentOAuth Docs](https://verifier.agentoauth.org/docs)
- [Interactive Playground](https://verifier.agentoauth.org/play)
- [GitHub Repository](https://github.com/agentoauth/agentoauth)
- [Policy Specification](https://github.com/agentoauth/agentoauth/blob/main/SPEC.md)

## License

MIT

