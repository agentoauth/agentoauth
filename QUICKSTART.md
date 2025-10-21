# AgentOAuth Quick Start Guide

## Installation

```bash
# Install pnpm if you haven't already
npm install -g pnpm

# Install all dependencies
pnpm install
```

## Build Everything

```bash
pnpm build
```

## Running the Demo

### 1. Start the Verifier API

```bash
cd packages/verifier-api
pnpm dev
```

The API will start on `http://localhost:3000` with these endpoints:
- `GET /.well-known/jwks.json` - Public keys
- `POST /verify` - Verify tokens
- `POST /demo/create-token` - Create demo tokens

### 2. Start the Playground

In a new terminal:

```bash
cd packages/playground
pnpm dev
```

Open `http://localhost:8080` in your browser.

### 3. Try It Out

1. Click "Create Demo Token" in the playground
2. The token will be automatically filled in
3. Click "Verify Token" to validate it
4. See the decoded header and payload

## Using the SDK

### Install the SDK

```bash
pnpm add @agentoauth/sdk jose
```

### Create a Token

```typescript
import { request } from '@agentoauth/sdk';
import { generateKeyPair, exportJWK } from 'jose';

// Generate keys
const { privateKey } = await generateKeyPair('EdDSA');
const privateJWK = await exportJWK(privateKey);

// Create token
const token = await request({
  ver: '0.1',
  user: 'did:example:alice',
  agent: 'my-bot@service',
  scope: 'pay:merchant',
  limit: { amount: 1000, currency: 'USD' },
  exp: Math.floor(Date.now() / 1000) + 3600,
  nonce: crypto.randomUUID()
}, privateJWK, 'my-key-id');

console.log('Token:', token);
```

### Verify a Token

```typescript
import { verify } from '@agentoauth/sdk';

const result = await verify(
  token,
  'https://issuer.example/.well-known/jwks.json',
  { audience: 'merchant.example' }
);

if (result.valid) {
  console.log('Valid token!', result.payload);
} else {
  console.error('Invalid:', result.error);
}
```

## Package Structure

```
packages/
├── spec/              → Protocol specification
│   ├── SPEC.md        → Complete spec document
│   ├── consent.schema.json
│   └── examples/      → Valid and invalid token examples
│
├── sdk-js/            → JavaScript/TypeScript SDK
│   ├── src/           → Source code
│   └── README.md      → SDK documentation
│
├── verifier-api/      → Demo verification server
│   ├── src/           → Hono API server
│   └── README.md      → API documentation
│
└── playground/        → Interactive validator
    ├── index.html     → Web interface
    ├── app.js         → Client-side logic
    └── style.css      → Styling
```

## Development

```bash
# Lint all packages
pnpm lint

# Run all tests
pnpm test

# Build all packages
pnpm build
```

## Next Steps

1. Read the [Specification](packages/spec/SPEC.md)
2. Explore the [SDK Documentation](packages/sdk-js/README.md)
3. Review [Security Best Practices](SECURITY.md)
4. Check [Contributing Guidelines](CONTRIBUTING.md)

## Testing with cURL

```bash
# Get public keys
curl http://localhost:3000/.well-known/jwks.json

# Create a demo token
curl -X POST http://localhost:3000/demo/create-token \
  -H "Content-Type: application/json" \
  -d '{
    "user": "did:example:alice",
    "agent": "test-bot",
    "scope": "pay:merchant",
    "limit": {"amount": 1000, "currency": "USD"}
  }'

# Verify a token
curl -X POST http://localhost:3000/verify \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_TOKEN_HERE",
    "audience": "merchant.example"
  }'
```

## Troubleshooting

**Issue**: `pnpm: command not found`
- Install pnpm: `npm install -g pnpm`

**Issue**: Port 3000 already in use
- Change port: `PORT=3001 pnpm dev`

**Issue**: SDK not found when importing
- Build packages first: `pnpm build`
- Install from workspace: `pnpm install`

## Support

- 📖 [Full Documentation](README.md)
- 🐛 [Report Issues](https://github.com/yourusername/agentoauth/issues)
- 💬 [Discussions](https://github.com/yourusername/agentoauth/discussions)

