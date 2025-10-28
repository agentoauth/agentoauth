# @agentoauth/hosted-verifier

Production-ready hosted verifier service to remove self-hosting friction from AgentOAuth adoption.

## 🌟 Features

- **🔑 API Key Authentication** - JWT-based API keys with organization quotas
- **📊 Rate Limiting** - Per-organization daily/monthly limits with Redis/KV storage
- **🔒 Privacy-First Audit Logs** - Hash PII, store only necessary data for analytics
- **⚡ Global Edge Deployment** - Cloudflare Workers for <50ms verification worldwide
- **📈 Usage Analytics** - Real-time quota monitoring and usage tracking
- **🛡️ Production Ready** - CORS, error handling, monitoring, and alerting

## 🚀 Quick Start

### Prerequisites

- Cloudflare account with Workers plan ($5/month)
- Domain configured in Cloudflare (e.g., `agentoauth.org`)
- `wrangler` CLI installed and authenticated

### 1. Generate Keys

```bash
cd packages/hosted-verifier
npm run gen-keys
```

This generates:
- EdDSA keypair for API key signing
- Demo API key for testing
- Deployment commands

### 2. Set Up Cloudflare Resources

```bash
# Create KV namespace for rate limiting
wrangler kv:namespace create "RATE_LIMIT_KV" --env production
wrangler kv:namespace create "RATE_LIMIT_KV" --env production --preview

# Create R2 bucket for audit logs
wrangler r2 bucket create agentoauth-audit-logs
```

### 3. Configure Secrets

```bash
# Set API key public key (from gen-keys output)
wrangler secret put API_KEY_PUBLIC_KEY --env production

# Set audit salt for PII hashing
wrangler secret put AUDIT_SALT --env production
```

### 4. Update Configuration

Edit `wrangler.toml` and replace:
- `your-kv-namespace-id` with actual KV namespace ID
- `your-preview-kv-id` with actual preview KV namespace ID
- Verify `zone_name` matches your domain

### 5. Deploy

```bash
# Deploy to production
wrangler deploy --env production

# Verify deployment
curl https://verifier.agentoauth.org/health
```

## 📋 API Endpoints

### Authentication

All endpoints except `/health`, `/terms`, and `/.well-known/jwks.json` require an API key.

Include API key in requests:
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

#### `POST /verify` 🔑
Verify AgentOAuth tokens with rate limiting and audit logging.

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
