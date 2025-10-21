# AgentOAuth

A neutral protocol for AI agents to prove who authorized what. AgentOAuth provides verifiable authorization tokens with clear scope, limits, and expiration—built on OAuth/JWT patterns for maximum interoperability.

**Status**: ✅ v0.1 Complete | 📦 26 Unit Tests Passing | 🔐 Production Ready

**Latest**: Enhanced input validation, consistent error handling, JSDoc comments, decode() helper, and agent-to-merchant demo

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
- **Open protocol**: MIT/Apache 2.0 dual license

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

- 📖 [Specification](packages/spec/SPEC.md) — Complete protocol documentation
- 🔧 [JavaScript SDK](packages/sdk-js) — Node.js and browser support (26 tests)
- 🎮 [Playground](packages/playground) — Interactive token validator
- 🔐 [Verifier API](packages/verifier-api) — Reference implementation
- 🎬 [Agent→Merchant Demo](packages/demo-agent-to-merchant) — End-to-end payment flow
- 🧪 [Test Summary](TEST_SUMMARY.md) — Unit test documentation
- 🎉 [Project Status](PROJECT_COMPLETE.md) — Complete implementation overview

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

## License

Dual licensed under MIT and Apache 2.0. See [LICENSE](LICENSE).

