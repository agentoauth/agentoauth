# AgentOAuth Invoice Payer UI

> Visual dashboard for watching an AI agent autonomously pay invoices with verifiable policy enforcement.

## Features

🤖 **AI-powered policy creation** - Describe your policy in plain English, GPT-4 generates the JSON  
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

Edit `.env` and add your API keys:
```env
STRIPE_SECRET_KEY=sk_test_...
OPENAI_API_KEY=sk-...
```

Get your keys from:
- Stripe: https://dashboard.stripe.com/test/apikeys
- OpenAI: https://platform.openai.com/api-keys

### 3. Run the UI

```bash
pnpm dev
```

Open [http://localhost:3001](http://localhost:3001)

### 4. Start processing

1. **Describe your policy** in natural language (or click an example)
   - Example: "Travel expenses: max $500 per booking, $2000/week, only Airbnb, Expedia, Uber"
2. Click **"Generate Policy"** - GPT-4 converts it to AgentOAuth policy JSON
3. Review the generated policy (click "View JSON" to see the full structure)
4. Click **"Start Processing"** to watch the agent work
5. View receipts by clicking any invoice row
6. Check **"View Stripe Dashboard"** to see all payments (including denials)

## How It Works

### AI-Powered Flow

```
[1] User Input
    "Travel expenses: max $500 per booking, $2000/week..."
         ↓
[2] AI Generation (GPT-4)
    Converts natural language → pol.v0.2 JSON
         ↓
[3] Agent Signs Policy 🔐 Signature #1 (Intent)
    Creates AgentOAuth consent token
         ↓
[4] For Each Invoice
    Calls verifier.agentoauth.org/verify
         ↓
[5] Verifier Checks Policy 🔐 Signature #2 (Verification)
    • Validates signature
    • Checks limits
    • Issues receipt
         ↓
[6] Merchant Enforces (Stripe)
    Creates PaymentIntent with receipt metadata
```

### Example Policy Prompts

- **Travel**: "Max $500 per booking, $2000/week, only Airbnb, Expedia, Uber"
- **SaaS**: "Max $100/month per service, only Stripe, AWS, Vercel"
- **Team Lunch**: "Max $50 per person, $500/week, only Uber Eats, DoorDash"

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
| `OPENAI_API_KEY` | ✅ Yes | - | Your OpenAI API key (for policy generation) |
| `OPENAI_MODEL` | No | `gpt-4o` | OpenAI model to use |
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

