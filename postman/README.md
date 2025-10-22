# AgentOAuth Postman Collection

Postman/Insomnia collection for testing the AgentOAuth API.

## Import

### Postman
1. Open Postman
2. Click Import
3. Select `AgentOAuth-v0.2.postman_collection.json`
4. Collection will appear in sidebar

### Insomnia
1. Open Insomnia
2. Import → From File
3. Select `AgentOAuth-v0.2.postman_collection.json`

## Variables

The collection uses these variables:

| Variable | Default Value | Description |
|----------|---------------|-------------|
| `baseUrl` | `http://localhost:3000` | Verifier API base URL |
| `token` | `(empty)` | Token to verify/revoke |
| `jti` | `(empty)` | JWT ID for revocation |
| `expectedAud` | `merchant.example` | Expected audience |

Update these in Collection → Variables.

## Requests

### 1. Create Demo Token

Creates a test token for verification.

**Request:**
```json
POST {{baseUrl}}/demo/create-token
{
  "user": "did:example:alice",
  "agent": "test-bot",
  "scope": "pay:merchant",
  "limit": {"amount": 1000, "currency": "USD"},
  "aud": "{{expectedAud}}"
}
```

**Response:**
```json
{
  "token": "eyJhbGc...",
  "payload": {...},
  "kid": "key-123"
}
```

**Next:** Copy the `token` value to the `{{token}}` variable.

### 2. Verify Token

Verifies a token's signature and claims.

**Request:**
```json
POST {{baseUrl}}/verify
{
  "token": "{{token}}",
  "audience": "{{expectedAud}}"
}
```

**Response (Valid):**
```json
{
  "valid": true,
  "payload": {
    "ver": "0.2",
    "jti": "550e8400-e29b-41d4-a716-446655440000",
    "user": "did:example:alice",
    ...
  }
}
```

**Response (Invalid):**
```json
{
  "valid": false,
  "error": "Token expired",
  "code": "EXPIRED"
}
```

### 3. Revoke Token

Revokes a token by its jti.

**Request:**
```json
POST {{baseUrl}}/revoke
{
  "jti": "{{jti}}"
}
```

**Response:**
```json
{
  "success": true,
  "jti": "550e8400-...",
  "revokedAt": "2025-10-21T12:34:56.789Z",
  "alreadyRevoked": false
}
```

**Next:** Verify the token again - it should fail with `REVOKED`.

### 4. Get JWKS

Retrieves public keys for verification.

**Request:**
```
GET {{baseUrl}}/.well-known/jwks.json
```

**Response:**
```json
{
  "keys": [
    {
      "kty": "OKP",
      "crv": "Ed25519",
      "x": "...",
      "kid": "key-123",
      "use": "sig",
      "alg": "EdDSA"
    }
  ]
}
```

### 5. Health Check

Checks API health and statistics.

**Request:**
```
GET {{baseUrl}}/health
```

**Response:**
```json
{
  "status": "ok",
  "service": "agentoauth-verifier",
  "version": "0.2.0",
  "timestamp": "2025-10-21T12:34:56.789Z",
  "uptime": 123.456,
  "keyId": "key-123",
  "revoked": 5,
  "replayCache": 42
}
```

## Workflow Example

1. **Create Demo Token** → Copy `token` and `jti` from response
2. **Set Variables** → `{{token}}` and `{{jti}}`
3. **Verify Token** → Should return `valid: true`
4. **Verify Again** → Should return `valid: false, code: REPLAY` (replay detection!)
5. **Or Revoke** → POST /revoke with jti
6. **Verify Revoked** → Should return `valid: false, code: REVOKED`

## Tips

- Use Postman Tests tab to auto-extract token and jti
- Use Environment variables for different setups (dev, staging, prod)
- Save example responses for documentation

## Test Script Example

Add this to the "Create Demo Token" Tests tab:

```javascript
const response = pm.response.json();
pm.collectionVariables.set("token", response.token);
pm.collectionVariables.set("jti", response.payload.jti);
```

This automatically sets the token and jti variables!

## License

MIT AND Apache-2.0

