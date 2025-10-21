# Security Policy

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability in AgentOAuth, please report it responsibly.

**Please DO NOT open a public issue for security vulnerabilities.**

### How to Report

Email security reports to: **[security@yourproject.example]**

Include in your report:

- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Suggested fix (if any)

### What to Expect

1. **Acknowledgment**: We'll acknowledge your report within 48 hours
2. **Assessment**: We'll assess the vulnerability and determine severity
3. **Fix**: We'll work on a fix and coordinate disclosure timing with you
4. **Credit**: We'll credit you in the security advisory (unless you prefer to remain anonymous)

### Disclosure Policy

- We aim to patch critical vulnerabilities within 7 days
- We'll coordinate public disclosure with you
- We'll publish a security advisory after the fix is released

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Security Best Practices

When using AgentOAuth:

1. **Always use HTTPS** for token transmission
2. **Store tokens securely** - encrypt at rest, never log in plaintext
3. **Validate audience** - always check the `aud` field matches your service
4. **Use short expiration times** - tokens should expire quickly (minutes to hours)
5. **Implement nonce tracking** - track used nonces to prevent replay attacks
6. **Rotate keys regularly** - use `kid` to support multiple active keys
7. **Monitor for suspicious activity** - log and alert on verification failures
8. **Keep dependencies updated** - regularly update jose and other cryptographic libraries

## Security Best Practices

### Key Rotation

**Why**: Keys can be compromised, algorithms can become weak, and regular rotation limits damage from breaches.

**How to implement**:
1. Generate new keys periodically (recommended: every 90 days)
2. Use the `kid` (Key ID) field to support multiple active keys simultaneously
3. Publish all active public keys in your JWKS endpoint
4. Phase out old keys:
   - Day 0: Generate new key with `kid: "key-2025-01"`
   - Day 1-7: Issue new tokens with new key, keep old key in JWKS
   - Day 7+: Remove old key from JWKS (after all tokens expired)

**Example**:
```javascript
// keys.js - Key rotation implementation
const activeKeys = [
  { kid: 'key-2025-01', privateJWK: {...}, publicJWK: {...} },  // current
  { kid: 'key-2024-10', privateJWK: {...}, publicJWK: {...} }   // previous (grace period)
];

// Issue tokens with newest key
const currentKey = activeKeys[0];
const token = await request(payload, currentKey.privateJWK, currentKey.kid);

// JWKS endpoint returns all active public keys
app.get('/.well-known/jwks.json', () => ({
  keys: activeKeys.map(k => k.publicJWK)
}));
```

### Audience Validation

**Why**: Prevents token theft and reuse against unintended services (confused deputy attacks).

**How to implement**:
1. **Always include `aud`** when creating tokens for specific services
2. **Always validate `aud`** matches your service identifier
3. Use specific audience identifiers (e.g., `merchant-123.payments.example`)

**Example**:
```javascript
// Token creation - specify audience
const token = await request({
  ...payload,
  aud: 'merchant-acme.payments.example'  // specific merchant
}, privateJWK, kid);

// Token verification - enforce audience
const result = await verify(token, jwksUrl, {
  audience: 'merchant-acme.payments.example'  // must match!
});

if (!result.valid) {
  // Token was issued for a different merchant
  console.error('Audience mismatch:', result.error);
}
```

**Don't**:
- Use generic audiences like `"merchant"` or `"api"`
- Skip audience validation
- Accept tokens with missing `aud` in production

### Nonce & Replay Protection

**Why**: Prevents attackers from reusing captured tokens (replay attacks).

**How to implement**:
1. **Generate cryptographically random nonces** (minimum 8 characters, recommend 16+)
2. **Track used nonces** within the token validity period
3. **Reject duplicate nonces**

**Example**:
```javascript
// In-memory nonce tracking (use Redis/database in production)
const usedNonces = new Map(); // Map<nonce, expiryTime>

async function verifyWithReplayProtection(token, jwksUrl) {
  const result = await verify(token, jwksUrl);
  
  if (!result.valid) return result;
  
  const { nonce, exp } = result.payload;
  
  // Check if nonce was already used
  if (usedNonces.has(nonce)) {
    return {
      valid: false,
      error: 'Token replay detected',
      code: 'REPLAY_ATTACK'
    };
  }
  
  // Record nonce with expiration
  usedNonces.set(nonce, exp);
  
  // Cleanup expired nonces periodically
  cleanupExpiredNonces();
  
  return result;
}

function cleanupExpiredNonces() {
  const now = Math.floor(Date.now() / 1000);
  for (const [nonce, exp] of usedNonces.entries()) {
    if (exp < now) usedNonces.delete(nonce);
  }
}
```

**Production considerations**:
- Use distributed cache (Redis) for multi-instance deployments
- Set TTL on nonce records to match token expiry
- Consider bloom filters for high-volume scenarios

### Storage Guidance

**Why**: Tokens are bearer credentials - anyone with the token can use it.

**How to store tokens safely**:

#### Client-Side Storage
```javascript
// ❌ DON'T: Store in localStorage (vulnerable to XSS)
localStorage.setItem('token', token);

// ✅ DO: Use httpOnly cookies (when possible)
// Server sets:
Set-Cookie: auth_token=<token>; HttpOnly; Secure; SameSite=Strict

// ✅ DO: Use sessionStorage for SPA (better than localStorage)
sessionStorage.setItem('token', token);

// ✅ BEST: Use memory only (no persistence)
let authToken = null; // Lost on page refresh, most secure
```

#### Server-Side Storage
```javascript
// ❌ DON'T: Log tokens
console.log('Received token:', token);  // BAD!

// ✅ DO: Encrypt at rest
const encrypted = await encrypt(token, serverKey);
await db.save({ userId, token: encrypted });

// ✅ DO: Use secure key management
// - AWS KMS, HashiCorp Vault, Azure Key Vault
// - Never commit keys to git
// - Rotate encryption keys regularly

// ✅ DO: Hash tokens in logs (if you must log)
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
console.log('Token hash:', tokenHash.substring(0, 16));
```

#### Database Storage
```sql
-- Token table with encryption
CREATE TABLE auth_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  token_encrypted BYTEA NOT NULL,  -- AES-256-GCM encrypted
  token_hash VARCHAR(64) NOT NULL, -- For lookup without decrypting
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_token_hash ON auth_tokens(token_hash);
CREATE INDEX idx_expires_at ON auth_tokens(expires_at) 
  WHERE expires_at > NOW(); -- Only index active tokens
```

### Transport Security

**Requirements**:
- ✅ **Always use HTTPS/TLS** for token transmission
- ✅ Use TLS 1.2 or higher
- ✅ Validate server certificates
- ✅ Consider mutual TLS (mTLS) for high-security scenarios

**Example**:
```javascript
// ❌ DON'T: Send tokens over HTTP
fetch('http://api.example/verify', { ... });

// ✅ DO: Always use HTTPS
fetch('https://api.example/verify', { ... });

// ✅ DO: Add extra encryption for sensitive operations
const encryptedToken = await encryptWithServiceKey(token, recipientPublicKey);
fetch('https://api.example/verify', {
  body: JSON.stringify({ encryptedToken })
});
```

### Token Lifetime

**Recommendations**:
- **Short-lived tokens**: 1-24 hours for most operations
- **Very short-lived**: 5-15 minutes for high-value transactions
- **Include refresh mechanism** for longer sessions

**Example**:
```javascript
// High-value transaction: 15 minutes
const highValueToken = await request({
  ...payload,
  limit: { amount: 50000, currency: 'USD' },
  exp: Math.floor(Date.now() / 1000) + (15 * 60)  // 15 min
}, privateJWK, kid);

// Regular operation: 1 hour
const regularToken = await request({
  ...payload,
  limit: { amount: 100, currency: 'USD' },
  exp: Math.floor(Date.now() / 1000) + (60 * 60)  // 1 hour
}, privateJWK, kid);
```

### Monitoring & Alerting

**What to monitor**:
1. Failed verification attempts (potential attacks)
2. Replay attack attempts (duplicate nonces)
3. Expired token usage patterns
4. Unusual audience mismatches

**Example logging**:
```javascript
// Structured logging for security events
logger.security({
  event: 'token_verification_failed',
  code: result.code,
  audience: expectedAudience,
  tokenAudience: result.payload?.aud,
  timestamp: new Date().toISOString(),
  ip: request.ip,
  userAgent: request.headers['user-agent']
});
```

## Known Security Considerations

See the [Security Considerations](packages/spec/SPEC.md#security-considerations) section in the specification for additional protocol-level security guidance.

## Security Updates

Subscribe to security advisories:
- Watch this repository for security alerts
- Follow releases for security patches

Thank you for helping keep AgentOAuth secure!

