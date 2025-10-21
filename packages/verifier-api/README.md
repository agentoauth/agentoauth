# @agentoauth/verifier-api

Reference implementation of an AgentOAuth verification server.

## Features

- JWKS endpoint at `/.well-known/jwks.json`
- Token verification endpoint at `/verify` with input validation
- Health check endpoint at `/health` (CI-ready)
- Demo token creation endpoint (for testing)
- Explicit CORS configuration (`Access-Control-Allow-Origin: *`)
- Security-first logging (token hashes only, never full tokens)
- Comprehensive input validation (400 for missing/invalid data)

## Running

```bash
pnpm install
pnpm dev
```

Server starts on port 3000 by default.

## Endpoints

### `GET /.well-known/jwks.json`

Returns the public key set for token verification.

**Response:** `200 OK`
```json
{
  "keys": [
    {
      "kty": "OKP",
      "crv": "Ed25519",
      "x": "...",
      "kid": "key-1729512345",
      "use": "sig",
      "alg": "EdDSA"
    }
  ]
}
```

### `GET /health`

Health check endpoint for CI and monitoring.

**Response:** `200 OK` (when healthy) or `503 Service Unavailable` (when initializing)
```json
{
  "status": "ok",
  "service": "agentoauth-verifier",
  "version": "0.1.0",
  "timestamp": "2025-10-21T12:34:56.789Z",
  "uptime": 123.456,
  "keyId": "key-1729512345"
}
```

**Usage in CI:**
```bash
curl -f http://localhost:3000/health || exit 1
```

### `POST /verify`

Verify an AgentOAuth token with comprehensive input validation.

**Request:**
```json
{
  "token": "eyJhbGc...",
  "audience": "merchant.example"  // optional
}
```

**Response:** `200 OK` (validation result)
```json
{
  "valid": true,
  "payload": {
    "ver": "0.1",
    "user": "did:example:alice",
    "agent": "payment-bot",
    "scope": "pay:merchant",
    "limit": { "amount": 1000, "currency": "USD" },
    "exp": 1729512345,
    "nonce": "..."
  }
}
```

**Error:** `400 Bad Request` (missing/invalid input)
```json
{
  "valid": false,
  "error": "Missing or invalid token field",
  "code": "INVALID_REQUEST"
}
```

**Security:** Logs token hash only (never full token):
```
🔐 Verification attempt: { tokenHash: '3a5d8f2e9c1b4e7a', ... }
```

### `POST /demo/create-token`

Create a demo token for testing.

Request:
```json
{
  "user": "did:example:alice",
  "agent": "test-bot",
  "scope": "pay:merchant",
  "limit": { "amount": 1000, "currency": "USD" }
}
```

Response:
```json
{
  "token": "eyJhbGc...",
  "payload": { ... },
  "kid": "key-1234567890"
}
```

## License

MIT AND Apache-2.0

