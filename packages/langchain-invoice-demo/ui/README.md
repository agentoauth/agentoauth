# AgentOAuth Invoice Payer UI

> Visual dashboard for watching an AI agent autonomously pay invoices with verifiable policy enforcement.

## Features

✨ **Real-time processing** - Watch invoices being verified and paid live  
🎨 **Animated UI** - Smooth transitions and status updates with Framer Motion  
📊 **Live agent logs** - See what the AI is thinking in real-time  
🧾 **Cryptographic receipts** - Every decision is verifiable  
💳 **Stripe integration** - View all payments (even denials) in your dashboard  

## Quick Start

### 1. Prerequisites

From the monorepo root:
```bash
pnpm install
```

### 2. Set up environment

```bash
cd packages/langchain-invoice-demo/ui
cp .env.example .env
```

Edit `.env`:
```env
STRIPE_SECRET_KEY=sk_test_...
```

### 3. Run the UI

```bash
pnpm dev
```

Open [http://localhost:3001](http://localhost:3001)

### 4. Start processing

1. Click **"Start Processing"**
2. Watch the agent verify and pay invoices in real-time
3. Click any invoice with a receipt to view the cryptographic proof
4. Click **"View Stripe Dashboard"** to see all payments (including denials)

## How It Works

```
┌─────────────────┐
│  Policy Created │ → $500/txn, $2000/week, merchants: [airbnb, expedia, uber]
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Token Signed   │ → Consent token with policy + policy_hash
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Process Invoice │
│   inv_001: $300 │ → ✅ PAID (within limits)
│   inv_002: $700 │ → ❌ DENIED (exceeds $500/txn)
│   inv_003: $150 │ → ✅ PAID (within limits)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Create Stripe  │ → PaymentIntents created for ALL attempts (even denials)
│  PaymentIntents │    Metadata includes: decision, receipt_id, policy_id
└─────────────────┘
```

## Architecture

- **Next.js 15** - App Router + Server Actions
- **Framer Motion** - Smooth animations
- **Tailwind CSS** - Deep blue design system
- **Server-Sent Events** - Real-time updates from agent
- **AgentOAuth SDK** - Policy enforcement
- **Stripe API** - Payment processing

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STRIPE_SECRET_KEY` | ✅ Yes | - | Your Stripe test secret key |
| `VERIFIER_URL` | No | `https://verifier.agentoauth.org` | AgentOAuth verifier endpoint |

## Features

### Real-time Invoice Table
- Animated status transitions (pending → verifying → paid/denied)
- Click any row to view cryptographic receipt
- Color-coded backgrounds for visual clarity

### Policy Card
- Shows active policy limits
- Per-transaction and weekly budget
- Allowed merchants list

### Agent Logs Panel
- Live stream of agent decisions
- Timestamped events
- Color-coded by severity

## Stripe Integration

Both **PAID** and **DENIED** invoices are logged in Stripe with metadata:

```json
{
  "metadata": {
    "invoice_id": "inv_002",
    "merchant": "expedia",
    "agentoauth_decision": "DENY",
    "deny_reason": "Amount 700 USD exceeds limit 500 USD",
    "receipt_id": "rcpt_01HY...",
    "policy_id": "pol_travel_demo",
    "status": "denied_by_policy"
  }
}
```

This creates a **complete audit trail** of all payment attempts.

## Development

```bash
# Install dependencies
pnpm install

# Run dev server
pnpm dev

# Build for production
pnpm build

# Run production build
pnpm start
```

## License

MIT

