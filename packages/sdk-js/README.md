# @agentoauth/sdk

JavaScript/TypeScript SDK for the AgentOAuth protocol.

## Installation

```bash
npm install @agentoauth/sdk jose ajv
# or
pnpm add @agentoauth/sdk jose ajv
# or
yarn add @agentoauth/sdk jose ajv
```

**Note:** This SDK requires `jose` and `ajv` as peer dependencies. They must be installed separately to avoid bundling issues in serverless environments.

## Quick Start

### Issue a Token

```typescript
import { request } from '@agentoauth/sdk';
import { generateKeyPair, exportJWK } from 'jose';

// Generate a key pair (Ed25519)
const { privateKey } = await generateKeyPair('EdDSA');
const privateJWK = await exportJWK(privateKey);

// Create token payload
const payload = {
  ver: '0.1',
  user: 'did:example:alice',
  agent: 'my-bot@service',
  scope: 'pay:merchant',
  limit: { amount: 1000, currency: 'USD' },
  exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  nonce: crypto.randomUUID()
};

// Issue token
const token = await request(payload, privateJWK, 'key-id-1');
console.log(token);
```

### Verify a Token

```typescript
import { verify } from '@agentoauth/sdk';

const result = await verify(
  token,
  'https://issuer.example/.well-known/jwks.json',
  {
    audience: 'merchant.example',
    clockSkew: 60 // allow 60s clock skew
  }
);

if (result.valid) {
  console.log('Token is valid!', result.payload);
} else {
  console.error('Invalid token:', result.error);
}
```

## API

### `request(payload, privateKey, kid)`

Creates a signed AgentOAuth token with full input validation.

**Parameters:**
- `payload`: AgentOAuthPayload object (validated against JSON schema)
- `privateKey`: Private key in JWK format
- `kid`: Key identifier string

**Returns:** `Promise<string>` - JWS compact token

**Throws:** 
- `AgentOAuthError` with code `INVALID_PAYLOAD` if validation fails
- `AgentOAuthError` with code `INVALID_KEY` if key is invalid

**Example:**
```typescript
try {
  const token = await request(payload, privateJWK, 'key-2025-01');
} catch (error) {
  if (error instanceof AgentOAuthError) {
    console.error(`Error ${error.code}:`, error.message);
    console.error('Details:', error.details);
  }
}
```

### `verify(token, jwksUrl, options?)`

Verifies an AgentOAuth token's signature, expiration, and claims.

**Parameters:**
- `token`: JWS compact token string
- `jwksUrl`: URL to JWKS endpoint
- `options`: Optional verification options
  - `audience`: Expected audience (must match token's aud)
  - `clockSkew`: Clock tolerance in seconds (default: 60)
  - `currentTime`: Override current time for testing

**Returns:** `Promise<VerificationResult>`

**Result object:**
```typescript
{
  valid: boolean;
  payload?: AgentOAuthPayload;  // if valid
  error?: string;                // if invalid
  code?: ErrorCode;              // error code
}
```

**Error codes:**
- `INVALID_SIGNATURE` - Signature verification failed
- `EXPIRED` - Token has expired
- `INVALID_AUDIENCE` - Audience mismatch
- `INVALID_PAYLOAD` - Payload schema invalid
- `INVALID_VERSION` - Unsupported version
- `NETWORK_ERROR` - Failed to fetch JWKS

### `decode(token)`

Decodes a token without verification (for debugging).

**⚠️ Warning:** This does NOT verify the signature. Always use `verify()` for authorization decisions.

**Parameters:**
- `token`: JWS compact token string

**Returns:** `DecodedToken`
```typescript
{
  header: {
    alg: string;
    kid: string;
    typ: string;
  };
  payload: AgentOAuthPayload;
}
```

**Throws:** `AgentOAuthError` with code `DECODE_ERROR` if token is malformed

**Example:**
```typescript
try {
  const { header, payload } = decode(token);
  console.log('Algorithm:', header.alg);
  console.log('Key ID:', header.kid);
  console.log('User:', payload.user);
  console.log('Expires:', new Date(payload.exp * 1000));
} catch (error) {
  console.error('Failed to decode:', error.message);
}
```

## Types

```typescript
/** Token payload structure */
interface AgentOAuthPayload {
  ver: '0.1';
  user: string;
  agent: string;
  scope: string;
  limit: { amount: number; currency: string };
  aud?: string;
  exp: number;
  nonce: string;
}

/** Verification result */
interface VerificationResult {
  valid: boolean;
  payload?: AgentOAuthPayload;
  error?: string;
  code?: ErrorCode;
}

/** Decoded token (header + payload) */
interface DecodedToken {
  header: {
    alg: string;
    kid: string;
    typ: string;
  };
  payload: AgentOAuthPayload;
}

/** Error codes */
type ErrorCode = 
  | 'INVALID_PAYLOAD'
  | 'INVALID_SIGNATURE' 
  | 'EXPIRED'
  | 'INVALID_AUDIENCE'
  | 'INVALID_VERSION'
  | 'INVALID_KEY'
  | 'DECODE_ERROR'
  | 'NETWORK_ERROR';

/** Error class with consistent structure */
class AgentOAuthError extends Error {
  code: ErrorCode;
  details?: unknown;
  toJSON(): { code: ErrorCode; message: string; details?: unknown };
}
```

## Error Handling

All functions throw or return consistent error objects:

```typescript
// Thrown errors (request, decode)
try {
  const token = await request(payload, key, kid);
} catch (error) {
  if (error instanceof AgentOAuthError) {
    console.error(`[${error.code}]`, error.message);
    console.error('Details:', error.details);
    
    // Convert to JSON
    const errorObj = error.toJSON();
    // { code: 'INVALID_PAYLOAD', message: '...', details: {...} }
  }
}

// Returned errors (verify)
const result = await verify(token, jwksUrl);
if (!result.valid) {
  console.error(`[${result.code}]`, result.error);
}
```

## Testing

Run the comprehensive test suite:

```bash
pnpm test

# Watch mode for development
pnpm test:watch
```

### Test Coverage

- ✅ Valid token verification → `valid: true`
- ❌ Expired token → `EXPIRED` error code
- ❌ Audience mismatch → `INVALID_AUDIENCE` error code  
- ❌ Tampered payload → `INVALID_SIGNATURE` error code
- Plus 14 additional edge case tests

See [RUN_TESTS.md](RUN_TESTS.md) for full test documentation.

## License

MIT AND Apache-2.0

