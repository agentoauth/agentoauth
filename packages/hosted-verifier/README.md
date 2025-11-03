# @agentoauth/hosted-verifier

Production-ready hosted verifier service to remove self-hosting friction from AgentOAuth adoption.

## 🌟 Features

- **🎉 Keyless Free Tier** - No API key needed! Start verifying tokens immediately
- **🔑 Optional API Keys** - JWT-based API keys for higher quotas and tracking
- **📊 Smart Rate Limiting** - Per-issuer (iss) and per-IP limits to prevent abuse
- **🔒 Privacy-First Audit Logs** - Hash PII, store only necessary data for analytics
- **⚡ Global Edge Deployment** - Cloudflare Workers for <50ms verification worldwide
- **📈 Usage Analytics** - Real-time quota monitoring and usage tracking
- **🛡️ Production Ready** - CORS, error handling, monitoring, and alerting

## 🔐 Why This Two-Layer System Matters

AgentOAuth verification creates a **cryptographic audit trail** that's fundamentally different from traditional OAuth:

### Traditional OAuth
```
User → Grant Access → App gets token → App uses token
```
*Problem*: Only proves access was granted, not intent for specific actions.

### AgentOAuth (Intent + Verification)
```
User → Agent signs intent (policy) → Verifier signs decision → Merchant enforces
```

### The Two Signatures

1. **Intent Layer (Agent's Signature)**
   - Agent creates consent token with policy: `{"policy": {...}, "exp": ..., "jti": ...}`
   - Signed by agent's key: `<agent-signature>`
   - Proves: "This agent was authorized by the user to perform this specific action"

2. **Verification Layer (Verifier's Signature)**  
   - Verifier evaluates policy and signs decision: `{"decision": "ALLOW", ...}`
   - Signed by verifier's key: `<verifier-signature>`
   - Proves: "A trusted third party verified and approved this request"

### Why It Matters

**If either side cheats or gets hacked, it's detectable.**

A merchant or auditor can:
1. ✅ **Check the agent's token** → "Was this really authorized by the user/agent?"
2. ✅ **Check the verifier's receipt** → "Did a trusted verifier actually approve this request?"

### Cryptographic Audit Trail

Every transaction has two independent, verifiable proofs:
- **Intent**: Agent's signature on the policy
- **Verification**: Verifier's signature on the decision

This dual-signature model means:
- Rogue agents can't forge authorization (missing user delegation)
- Compromised verifiers can't approve without valid agent tokens
- Merchants have cryptographic proof for compliance and audits
- Every action is traceable to both the authorizing agent AND the verifying party

**That's what makes AgentOAuth different** — it doesn't just grant access, it **proves intent and verification**.

## 🚀 Quick Start

### Automated Deployment (2 Commands)

The fastest way to deploy:

```bash
cd packages/hosted-verifier

# 1. Generate keys (auto-creates .env.local)
pnpm run gen-keys

# 2. Deploy automatically
pnpm run deploy:auto
```

That's it! The gen-keys script creates `.env.local` automatically, and deploy:auto handles everything else (KV creation, configuration, secrets, deployment).

---

### Manual Deployment

For step-by-step control, see [DEPLOYMENT.md](DEPLOYMENT.md).

## 📋 API Endpoints

### Authentication (Optional!)

**Good news**: API keys are OPTIONAL! You can start using the service immediately without signing up.

**Free Tier Limits** (no API key needed):
- 1,000 verifications/day per token issuer (`iss` claim)
- 10,000 verifications/month per issuer
- 60 requests/minute per IP address
- 1,000 requests/hour per IP address

**For Higher Quotas**: Include an API key:
```bash
# Option 1: X-API-Key header (recommended)
curl -H "X-API-Key: ak_your_api_key_here" ...

# Option 2: Authorization header  
curl -H "Authorization: Bearer ak_your_api_key_here" ...
```

### Endpoints

#### `GET /health`
Service health and status information.

```bash
curl https://verifier.agentoauth.org/health
```

#### `GET /.well-known/jwks.json`  
Public keys for token verification (JWKS format).

```bash
curl https://verifier.agentoauth.org/.well-known/jwks.json
```

#### `POST /verify`
Verify AgentOAuth tokens with rate limiting and audit logging.

**No API key required!** Just send the token:

```bash
curl -X POST https://verifier.agentoauth.org/verify \
  -H "Content-Type: application/json" \
  -d '{
    "token": "eyJhbGciOiJFZERTQSI...",
    "audience": "merchant.example"
  }'
```

**With API key** (for higher quotas):

```bash
curl -X POST https://verifier.agentoauth.org/verify \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ak_your_api_key_here" \
  -d '{
    "token": "eyJhbGciOiJFZERTQSI...",
    "audience": "merchant.example"
  }'
```

**Response (Success):**
```json
{
  "valid": true,
  "payload": {
    "ver": "0.2",
    "user": "did:example:alice",
    "agent": "payment-bot",
    "scope": "pay:merchant",
    "limit": {"amount": 1000, "currency": "USD"}
  },
  "verifiedBy": "agentoauth.org",
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

**Response (Invalid):**
```json
{
  "valid": false,
  "error": "Token has expired", 
  "code": "EXPIRED",
  "suggestion": "Generate a new token with a longer expiration time"
}
```

#### `GET /usage` 🔑
Check API key usage and quotas.

```bash
curl -H "X-API-Key: ak_your_api_key_here" \
  https://verifier.agentoauth.org/usage
```

**Response:**
```json
{
  "organization": {
    "id": "demo-org-001",
    "name": "Demo Organization", 
    "tier": "free"
  },
  "quotas": {
    "daily": 1000,
    "monthly": 10000
  },
  "usage": {
    "daily": {"used": 45, "limit": 1000},
    "monthly": {"used": 156, "limit": 10000}
  }
}
```

#### `GET /terms`
Terms of service and privacy policy.

```bash
curl https://verifier.agentoauth.org/terms
```

## 🔧 Integration Examples

### Express.js Merchant

```javascript
import express from 'express';

const app = express();
const USE_HOSTED = process.env.USE_HOSTED_VERIFIER === 'true';
const API_KEY = process.env.AGENTOAUTH_API_KEY;

app.post('/api/payment', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (USE_HOSTED) {
    // Use hosted verifier
    const response = await fetch('https://verifier.agentoauth.org/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify({ token, audience: 'my-merchant' })
    });
    
    const result = await response.json();
    
    if (result.valid) {
      // Process payment with verified token
      res.json({ success: true, authorizedBy: result.payload.user });
    } else {
      res.status(401).json({ error: result.error, code: result.code });
    }
  } else {
    // Use local verification...
  }
});
```

### Cloudflare Workers

```javascript
export default {
  async fetch(request, env) {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    
    const response = await fetch('https://verifier.agentoauth.org/verify', {
      method: 'POST', 
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': env.AGENTOAUTH_API_KEY
      },
      body: JSON.stringify({ token, audience: 'my-service' })
    });
    
    const result = await response.json();
    
    if (result.valid) {
      return Response.json({ success: true, user: result.payload.user });
    } else {
      return Response.json({ error: result.error }, { status: 401 });
    }
  }
};
```

## 🔒 Security & Privacy

### API Key Security
- API keys use EdDSA signatures with 1-year expiration
- Keys are prefixed with `ak_` for easy identification
- Revocation support built-in (contact support)

### Privacy-First Audit Logging
- **PII Hashing**: User IDs, IP addresses, organization names hashed with salt
- **No Token Storage**: Complete tokens never stored
- **Amount Ranges**: Exact amounts converted to privacy-preserving ranges
- **Minimal Data**: Only necessary fields for service operation

### Rate Limiting
- **Free Tier**: 1,000 requests/day, 10,000/month
- **Fair Use**: Automated abuse detection
- **Quota Headers**: `X-RateLimit-*` headers in all responses

## 📊 Monitoring & Analytics

### Real-Time Metrics
- Request volume and success rates
- Average response times  
- Error code breakdown
- Geographic distribution

### Privacy-Preserving Analytics
- Aggregated usage patterns
- Scope popularity (non-PII)
- Amount ranges (not exact values)
- Temporal patterns

## 🆙 Quotas & Tiers

| Tier | Daily Limit | Monthly Limit | Price |
|------|-------------|---------------|-------|
| **Free** | 1,000 | 10,000 | $0 |
| **Pro** | 50,000 | 1,000,000 | Contact |
| **Enterprise** | 500,000 | 10,000,000 | Contact |

Contact `alpha@agentoauth.org` for tier upgrades.

## 🚨 Error Codes

| Code | Description | Suggestion |
|------|-------------|------------|
| `MISSING_API_KEY` | No API key provided | Include X-API-Key header |
| `INVALID_API_KEY` | API key invalid/expired | Check key format and expiration |
| `QUOTA_EXCEEDED` | Rate limit exceeded | Upgrade plan or wait for reset |
| `MISSING_TOKEN` | No token in request | Include token in request body |
| `EXPIRED` | Token has expired | Generate new token |
| `INVALID_SIGNATURE` | Token signature invalid | Check token and public keys |
| `INVALID_AUDIENCE` | Audience mismatch | Verify expected audience |
| `REVOKED` | Token has been revoked | Generate new token |
| `REPLAY` | Token already used | Generate new token for each request |

## ⚠️ Alpha Service Notice

This is an **experimental alpha service** for development and testing:

- **No SLA** - Best effort uptime
- **No Production Use** - Development only  
- **Subject to Change** - Service may be discontinued
- **Fair Use** - Abuse monitoring enabled

## 🛠️ Development

### Local Development

```bash
# Install dependencies
npm install

# Start development server
wrangler dev

# Test locally
curl http://localhost:8787/health
```

### Key Management

```bash
# Generate new keypair
npm run gen-keys

# Rotate API key signing keys (contact support)
# Update secrets with new keys
wrangler secret put API_KEY_PUBLIC_KEY --env production
```

## 📞 Support

- **Documentation**: [AgentOAuth Spec](../spec/SPEC.md)
- **Issues**: [GitHub Issues](https://github.com/agentoauth/agentoauth/issues)  
- **Email**: `alpha@agentoauth.org`
- **Discord**: [AgentOAuth Community](https://discord.gg/agentoauth)

## 📝 License

MIT AND Apache-2.0

---

**🌍 Global AgentOAuth verification at the edge - removing self-hosting friction for developers worldwide.**
