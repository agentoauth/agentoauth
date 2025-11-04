# AgentOAuth

## AgentOAuth v0.8 — Alpha

> Public read-only repository. Spec and APIs are evolving.

A neutral protocol for AI agents to prove who authorized what. AgentOAuth provides verifiable authorization tokens with clear scope, limits, and expiration—built on OAuth/JWT patterns for maximum interoperability.

**Status**: ✅ v0.8 Alpha | 📦 19 Unit Tests + 23 Conformance Tests Passing | 🔐 Production Ready

**Latest v0.8 (Phase 2B)**: Time-Bound Passkey Approval - WebAuthn/Passkey-backed human intent verification with automatic expiry (7/30/90 days). Adds cryptographic proof that a real user approved a specific policy with a defined time window.

**Previous v0.7 (Phase 2A)**: Policy Support - programmable consent with pol.v0.2 schema, policy evaluation engine, JWS receipts, budget tracking

## 🚀 5-Minute Quickstart

**Four ways to get started - choose your platform:**

### Option 0: Hosted Verifier (Zero Setup) ⭐
```bash
# Set API key for hosted verifier (get from alpha@agentoauth.org)
export USE_HOSTED_VERIFIER=true
export AGENTOAUTH_API_KEY="ak_your_api_key_here"

# Run demo with hosted verification
pnpm demo
```

### Option 1: Express Middleware (Recommended)
```bash
# Complete agent-to-merchant flow with middleware
pnpm quickstart:node

# Or manually:
cd quickstarts/node-express
npm install && npm run demo
```

### Option 2: Cloudflare Workers (Edge Deployment)
```bash
# Deploy to Cloudflare's global edge network
pnpm quickstart:cf

# Or manually:
cd quickstarts/cloudflare-workers
npm install && npx wrangler dev
```

### Option 3: Direct SDK (Low-Level)

**Complete walkthrough from setup to revocation:**

### Minute 1: Setup

```bash
cd /Users/prithvi/projects/agentoauth
npm install -g pnpm
pnpm setup  # Installs deps and builds packages
```

### Minute 2: Generate Keys & Issue Token

```bash
cd packages/examples
node issue-token.js
```

You'll see:
- ✅ Generated Ed25519 keypair
- 🎫 Created authorization token
- 📋 Token (copy this!)
- 📦 Decoded payload with jti

### Minute 3: Verify Token

```bash
# Start verifier API (terminal 1)
cd ../verifier-api && pnpm dev

# Verify token (terminal 2)
cd ../examples
node verify-token.js
# Paste the token from step 2
```

Result: ✅ Token is Valid

### Minute 4: Revoke Token

```bash
# Get the jti from the token output
curl -X POST http://localhost:3000/revoke \
  -H "Content-Type: application/json" \
  -d '{"jti": "YOUR_JTI_HERE"}'
```

Result: Token revoked!

### Minute 5: Re-verify (Fails)

```bash
node verify-token.js
# Paste the same token
```

Result: ❌ Token is INVALID - Code: REVOKED

**🎉 You've seen the complete lifecycle: issue → verify → revoke → verify fails!**

---

## Quick Start

### 3-Step Quickstart

**Step 1: Generate a key pair**

```bash
# Using Node.js and jose library
node -e "
const jose = require('jose');
(async () => {
  const { privateKey, publicKey } = await jose.generateKeyPair('EdDSA');
  const privateJWK = await jose.exportJWK(privateKey);
  const publicJWK = await jose.exportJWK(publicKey);
  console.log('Private Key:', JSON.stringify(privateJWK, null, 2));
  console.log('Public Key:', JSON.stringify(publicJWK, null, 2));
})();
"
```

**Step 2: Issue a token**

```bash
# Save this as issue-token.js
import { request } from '@agentoauth/sdk';

const privateJWK = { /* paste your private key */ };

const token = await request({
  ver: '0.1',
  user: 'did:example:alice',
  agent: 'my-bot@service',
  scope: 'pay:merchant',
  limit: { amount: 1000, currency: 'USD' },
  exp: Math.floor(Date.now() / 1000) + 3600,
  nonce: crypto.randomUUID()
}, privateJWK, 'key-1');

console.log(token);

# Run it
node issue-token.js
```

**Step 3: Verify via cURL**

```bash
# Start the demo verifier API first
cd packages/verifier-api && pnpm dev

# Then verify your token
curl -X POST http://localhost:3000/verify \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_TOKEN_HERE",
    "audience": "merchant.example"
  }'

# Response: {"valid": true, "payload": {...}}
```

## Features

- **Five-field schema**: user, agent, scope, limit, expiry + signature
- **JWS tokens**: EdDSA (Ed25519) recommended, ES256K optional
- **JWT-compatible**: Works with existing JWT libraries
- **Policy Support (v0.2)**: Structured rules with actions, resources, limits, constraints
- **Intent Approval (v0.3)**: Time-bound passkey approval with automatic expiry
- **Open protocol**: MIT/Apache 2.0 dual license

## 🔐 Passkey Intent Approval (v0.3 - NEW!)

AgentOAuth v0.3 adds **time-bound human approval** using WebAuthn/Passkeys:

### Why It Matters

Traditional agent authorization lacks proof of explicit human approval. With intent approval:

- **Cryptographic Proof**: WebAuthn signature proves a real user approved the policy
- **Time-Bounded**: Approval automatically expires (7/30/90 days) - no manual revocation needed
- **Policy-Bound**: Passkey signature is cryptographically tied to the specific policy hash
- **Auto-Expiry Protection**: Even if agent keys are compromised, attacker can only act within the approval window

### How It Works

```
[1] User describes policy → AI generates pol.v0.2 JSON
       ↓
[2] User approves with Passkey (selects 7/30/90 days)
       ↓ Creates intent with valid_until timestamp
[3] Agent creates token with embedded intent (act.v0.3)
       ↓ 🔐 Signature Layer 1: Agent's intent
[4] Verifier checks: policy + intent expiry + budget
       ↓ 🔐 Signature Layer 2: Verifier's decision  
[5] Merchant enforces with cryptographic receipt
```

### SDK Usage

```typescript
import { requestIntent, issueConsent, buildPolicyV2 } from '@agentoauth/sdk';

// 1. Build policy
const policy = buildPolicyV2()
  .actions(['payments.send'])
  .limitPerTxn(500, 'USD')
  .limitPerPeriod(2000, 'USD', 'week')
  .finalize();

// 2. Request passkey approval (browser only)
const intent = await requestIntent(
  policy, 
  30, // 30 days
  window.location.hostname
);
// User sees passkey prompt (biometric/PIN)

// 3. Issue consent token with intent
const { token } = await issueConsent({
  user: 'did:user:alice',
  agent: 'did:agent:finance',
  scope: ['payments.send'],
  policy,
  intent, // <-- Includes passkey approval
  expiresIn: '7d'
});

// Token now includes:
// - policy: structured rules
// - intent: WebAuthn assertion with valid_until
// - Two-layer security: agent signs intent, verifier signs decision
```

### Automatic Expiry

```typescript
// Intent expires automatically - no manual revocation needed
{
  "intent": {
    "approved_at": "2025-11-05T19:00:00Z",
    "valid_until": "2025-12-05T19:00:00Z", // 30 days later
    "type": "webauthn.v0"
  }
}

// After Dec 5, verifier returns:
// { "decision": "DENY", "code": "INTENT_EXPIRED" }
```

### Browser Support

- ✅ Chrome/Edge 90+
- ✅ Safari 16+
- ✅ Firefox 119+
- ⚠️ Older browsers: Falls back to v0.2 (no intent)

### Try It

See the [LangChain Invoice Demo](packages/langchain-invoice-demo/ui/) for a full working example with passkey approval UI!

## Try the Demo

**See it in action:** Agent makes payment, merchant verifies authorization!

```bash
cd /Users/prithvi/projects/agentoauth

# Complete setup and run demo (just 2 commands!)
npm install -g pnpm
pnpm demo
```

**That's it!** The `pnpm demo` command does everything: installs dependencies, builds packages, and runs the demo.

**Single command from root:**
- `pnpm demo` - Install, build, and run demo (does it all!)
- `pnpm setup` - Just setup (install + build)
- `pnpm test` - Run all tests
- `pnpm build` - Just rebuild packages

See [SUPER_SIMPLE_START.md](SUPER_SIMPLE_START.md) or [ONE_COMMAND_SETUP.md](ONE_COMMAND_SETUP.md) for details.

## Resources

### Hosted Verifier (v0.6) ⭐
- 🌐 [Hosted Verifier](https://verifier.agentoauth.org) - Global edge deployment
- 📖 [Deployment Guide](packages/hosted-verifier/README.md) - Setup your own instance
- 🔑 [API Key Generator](packages/hosted-verifier/scripts/generate-keys.js) - Generate signing keys
- 📊 [Terms & Privacy](https://verifier.agentoauth.org/terms) - Alpha service terms

### Core Protocol (v0.2)
- 📖 [Specification](packages/spec/SPEC.md) — Complete protocol documentation
- 📋 [OpenAPI Spec](packages/spec/openapi.yaml) — Formal API specification
- 🔧 [JavaScript SDK](packages/sdk-js) — Enhanced with 15+ ergonomic functions
- 🔐 [Verifier API](packages/verifier-api) — Reference implementation with revocation

### 5-Minute Developer Experience (v0.5)
- 🚀 [Node/Express Quickstart](quickstarts/node-express/) — Complete middleware examples
- ⚡ [Cloudflare Workers Quickstart](quickstarts/cloudflare-workers/) — Edge deployment
- 🤖 [Agent Express Middleware](packages/agent-express/) — Auto-signing middleware
- 🏪 [Merchant Express Middleware](packages/merchant-express/) — Validation middleware

### Testing & Validation
- 🧪 [Conformance Tests](packages/conformance) — 23+ test cases & cross-language vectors
- 🎮 [Playground](packages/playground) — Interactive validator with copy buttons & samples
- 🎬 [Agent→Merchant Demo](packages/demo-agent-to-merchant) — End-to-end payment flow
- 💡 [Examples](packages/examples) — issue-token.js, verify-token.js scripts
- 📮 [Postman Collection](postman/) — API testing collection

### Documentation
- 📝 [Changelog](CHANGELOG.md) — Version history and release notes

## Architecture

```
packages/
  spec/                    # Protocol specification and JSON schema
  sdk-js/                  # JavaScript/TypeScript SDK (26 tests)
  verifier-api/            # Demo verification server (Hono)
  playground/              # Browser-based token validator
  demo-agent-to-merchant/  # End-to-end payment demo (agent + merchant)
```

## Development

This is a pnpm workspace monorepo. **All commands run from the root directory:**

```bash
# First time setup (install + build)
pnpm setup

# Run the agent-to-merchant demo
pnpm demo

# Run all tests
pnpm test

# Rebuild packages
pnpm build
```

### Individual Component Development

```bash
# Start verifier API (port 3000)
cd packages/verifier-api && pnpm dev

# Start playground (port 8080)
cd packages/playground && pnpm dev

# Start merchant server (for manual demo)
pnpm demo:merchant

# Run agent (in another terminal)
pnpm demo:agent --amount 150
```

See [ONE_COMMAND_SETUP.md](ONE_COMMAND_SETUP.md) for the simplified workflow.

## Troubleshooting

Having issues? We have comprehensive debugging guides:

- 🚨 **[QUICK_DEBUG.md](QUICK_DEBUG.md)** - Quick reference card for common errors
- 🔍 **[DEBUG_LOGS_GUIDE.md](DEBUG_LOGS_GUIDE.md)** - Complete guide to reading error logs
- 🛠️ **[FIX_DEMO_TOKEN_ERROR.md](FIX_DEMO_TOKEN_ERROR.md)** - Fix "Error on creating demo token"
- 📖 **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Complete troubleshooting reference

The verifier API and playground have extensive logging - check your browser console (F12) and server terminal for detailed error information.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## Security

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## Sanity Check

Verify everything works:

```bash
pnpm install && pnpm -r build && pnpm -r test
```

Expected: ✅ All packages build, 18 tests pass

See [SANITY_CHECK.md](SANITY_CHECK.md) for detailed results.

## Repository

GitHub: https://github.com/agentoauth/agentoauth

## License

Dual licensed under MIT and Apache 2.0. See [LICENSE](LICENSE).

