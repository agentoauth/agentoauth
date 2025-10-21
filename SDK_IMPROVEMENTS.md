# SDK Improvements - Enhanced Input Validation & Error Handling

## ✅ Improvements Implemented

### 1. Enhanced Input Validation

**Before signing, all inputs are validated:**

```typescript
// ✅ Payload validated against JSON schema
const token = await request(payload, privateKey, kid);

// ❌ Throws AgentOAuthError if:
// - Payload doesn't match schema
// - Required fields missing
// - Invalid types or formats
// - Key is invalid or malformed
```

**Validation includes:**
- ✅ All required fields present
- ✅ Correct types (string, number, object)
- ✅ Format validation (scope pattern, currency ISO 4217)
- ✅ Constraints (amount ≥ 0, nonce ≥ 8 chars)
- ✅ Version compatibility (ver === "0.1")

### 2. Consistent Error Objects

**All errors follow the same structure:**

```typescript
interface AgentOAuthErrorObject {
  code: ErrorCode;      // Machine-readable
  message: string;      // Human-readable
  details?: unknown;    // Additional context
}
```

**Error codes:**
- `INVALID_PAYLOAD` - Payload validation failed
- `INVALID_KEY` - Key format or usage error
- `INVALID_SIGNATURE` - Signature verification failed
- `EXPIRED` - Token expired
- `INVALID_AUDIENCE` - Audience mismatch
- `INVALID_VERSION` - Unsupported version
- `DECODE_ERROR` - Token decoding failed
- `NETWORK_ERROR` - JWKS fetch failed

**Example usage:**
```typescript
try {
  const token = await request(payload, key, kid);
} catch (error) {
  if (error instanceof AgentOAuthError) {
    console.error(`[${error.code}]`, error.message);
    console.error('Details:', error.details);
    
    // Serialize to JSON
    const errorObj = error.toJSON();
    // { code: 'INVALID_PAYLOAD', message: '...', details: {...} }
  }
}
```

### 3. Comprehensive JSDoc Comments

**All exports now have complete JSDoc:**

- ✅ Function descriptions
- ✅ Parameter documentation with types
- ✅ Return value documentation
- ✅ Throws documentation
- ✅ Usage examples
- ✅ Remarks and warnings

**Example:**

```typescript
/**
 * Creates a signed AgentOAuth authorization token.
 * 
 * This function validates the payload against the AgentOAuth v0.1 schema,
 * signs it with the provided private key using EdDSA (Ed25519) or ES256K,
 * and returns a JWS compact serialization token.
 * 
 * @param payload - The authorization payload containing user, agent, scope, limits, etc.
 * @param privateKey - Private key in JWK (JSON Web Key) format for signing
 * @param kid - Key identifier to include in the JWT header (for key rotation support)
 * 
 * @returns A JWS compact token string (header.payload.signature)
 * 
 * @throws {AgentOAuthError} With code 'INVALID_PAYLOAD' if payload validation fails
 * @throws {AgentOAuthError} With code 'INVALID_KEY' if the private key is invalid
 * 
 * @example
 * ```typescript
 * const token = await request({
 *   ver: '0.1',
 *   user: 'did:example:alice',
 *   agent: 'payment-bot@myapp',
 *   scope: 'pay:merchant',
 *   limit: { amount: 1000, currency: 'USD' },
 *   exp: Math.floor(Date.now() / 1000) + 3600,
 *   nonce: crypto.randomUUID()
 * }, privateJWK, 'key-2025-01');
 * ```
 */
export async function request(...): Promise<string>
```

### 4. Token Decoding Helper

**New `decode()` function for debugging:**

```typescript
import { decode } from '@agentoauth/sdk';

// Decode without verification (for debugging only)
const { header, payload } = decode(token);

console.log('Algorithm:', header.alg);  // "EdDSA"
console.log('Key ID:', header.kid);     // "key-2025-01"
console.log('Type:', header.typ);       // "JWT"
console.log('User:', payload.user);
console.log('Agent:', payload.agent);
console.log('Expires:', new Date(payload.exp * 1000));
```

**⚠️ Important:** `decode()` does NOT verify:
- Signature validity
- Token expiration
- Audience claims
- Payload schema

Always use `verify()` for security-critical decisions!

## API Changes

### New Exports

```typescript
// Functions
export { request } from './request.js';
export { verify } from './verify.js';
export { decode } from './decode.js';  // ✨ NEW

// Types
export type {
  AgentOAuthPayload,
  VerifyOptions,
  VerificationResult,
  DecodedToken,              // ✨ NEW
  ErrorCode,                 // ✨ NEW
  AgentOAuthErrorObject      // ✨ NEW
} from './types.js';

// Error class
export { AgentOAuthError } from './types.js';
```

### Enhanced Error Handling

**request() - Throws errors:**
```typescript
try {
  const token = await request(payload, privateKey, kid);
} catch (error) {
  if (error instanceof AgentOAuthError) {
    switch (error.code) {
      case 'INVALID_PAYLOAD':
        console.error('Payload validation failed:', error.details);
        break;
      case 'INVALID_KEY':
        console.error('Key error:', error.message);
        break;
    }
  }
}
```

**verify() - Returns result object:**
```typescript
const result = await verify(token, jwksUrl, options);

if (!result.valid) {
  switch (result.code) {
    case 'EXPIRED':
      console.error('Token expired');
      break;
    case 'INVALID_AUDIENCE':
      console.error('Wrong audience:', result.error);
      break;
    case 'INVALID_SIGNATURE':
      console.error('Signature invalid');
      break;
  }
}
```

**decode() - Throws errors:**
```typescript
try {
  const { header, payload } = decode(token);
} catch (error) {
  if (error instanceof AgentOAuthError && error.code === 'DECODE_ERROR') {
    console.error('Malformed token:', error.message);
  }
}
```

## Testing

**New tests added (total: 26 tests):**

```
✓ Token Decoding (decode) (5 tests)
  ✓ Should decode valid token without verification
  ✓ Should decode expired token without error
  ✓ Should throw on malformed token
  ✓ Should throw on invalid input
  ✓ Should include error code in thrown error

✓ Error Handling (2 tests)
  ✓ Should throw AgentOAuthError with consistent structure
  ✓ Should include validation errors in details
```

Run tests:
```bash
cd packages/sdk-js
pnpm test
```

## Migration Guide

### Before (v0.1.0)

```typescript
// Simple error handling
try {
  const token = await request(payload, key, kid);
} catch (error) {
  console.error(error.message);
}

// No decode helper
// Had to manually base64 decode
```

### After (v0.1.1+)

```typescript
// Structured error handling
try {
  const token = await request(payload, key, kid);
} catch (error) {
  if (error instanceof AgentOAuthError) {
    console.error(`[${error.code}]`, error.message);
    console.error('Details:', error.details);
    
    // Can serialize
    logToMonitoring(error.toJSON());
  }
}

// Built-in decode helper
const { header, payload } = decode(token);
console.log('Debug:', { header, payload });
```

## Benefits

### For Developers

✅ **Better DX**: Clear error messages with actionable details
✅ **Easier debugging**: decode() helper for token inspection
✅ **Type safety**: Full TypeScript support with JSDoc
✅ **Consistent API**: Same error structure everywhere

### For Production

✅ **Better monitoring**: Structured errors easy to log/track
✅ **Faster debugging**: Error codes + details pinpoint issues
✅ **Input validation**: Catches issues before signing
✅ **Clear documentation**: JSDoc in IDE tooltips

## Examples

### Example 1: Detailed Error Logging

```typescript
import { request, AgentOAuthError } from '@agentoauth/sdk';

async function createAuthToken(payload, key, kid) {
  try {
    return await request(payload, key, kid);
  } catch (error) {
    if (error instanceof AgentOAuthError) {
      // Log structured error
      logger.error({
        errorCode: error.code,
        message: error.message,
        details: error.details,
        stack: error.stack
      });
      
      // Different handling per error type
      if (error.code === 'INVALID_PAYLOAD') {
        // Show validation errors to user
        throw new UserFacingError(
          'Invalid authorization request',
          error.details.validationErrors
        );
      }
    }
    throw error;
  }
}
```

### Example 2: Token Debugging

```typescript
import { decode, verify } from '@agentoauth/sdk';

async function debugToken(token) {
  // First, decode to see contents
  try {
    const { header, payload } = decode(token);
    console.log('Token structure:');
    console.log('  Algorithm:', header.alg);
    console.log('  Key ID:', header.kid);
    console.log('  User:', payload.user);
    console.log('  Expires:', new Date(payload.exp * 1000));
    console.log('  Scope:', payload.scope);
  } catch (error) {
    console.error('Cannot decode token:', error.message);
    return;
  }
  
  // Then verify signature
  const result = await verify(token, jwksUrl);
  if (result.valid) {
    console.log('✅ Signature valid');
  } else {
    console.log('❌ Verification failed:', result.code);
  }
}
```

### Example 3: Comprehensive Validation

```typescript
import { request, AgentOAuthError } from '@agentoauth/sdk';

// Input validation happens automatically
const payload = {
  ver: '0.1',
  user: 'did:example:alice',
  agent: 'bot',
  scope: 'invalid scope!',  // ❌ Will fail: invalid characters
  limit: { amount: -100, currency: 'USD' },  // ❌ Will fail: negative
  exp: Date.now() / 1000,  // ❌ Will fail: must be integer
  nonce: '123'  // ❌ Will fail: too short (< 8 chars)
};

try {
  await request(payload, key, kid);
} catch (error) {
  // error.code === 'INVALID_PAYLOAD'
  // error.details.validationErrors contains all issues
}
```

## Summary

All requested improvements implemented:

✅ **Input validation** - JSON schema validation before signing
✅ **Consistent errors** - Structured error objects with codes
✅ **JSDoc comments** - Complete documentation for all exports
✅ **decode() helper** - Easy token inspection for debugging
✅ **26 tests passing** - Including new decode and error tests

The SDK now provides a production-ready, developer-friendly API with excellent error handling and debugging capabilities!

