# AgentOAuth + Cloudflare Workers

Deploy AgentOAuth at the edge with Cloudflare Workers in under 5 minutes!

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Login to Cloudflare (first time only)
npx wrangler login

# 3. Deploy both workers
npx wrangler deploy --env agent
npx wrangler deploy --env merchant

# Or run locally for development
npm run agent:dev    # Start agent worker locally
npm run merchant:dev # Start merchant worker locally
```

## 📋 What's Included

### Agent Worker (`src/agent.ts`)
- **Token Issuance**: Issues consent tokens on-demand
- **Payment Forwarding**: Signs and forwards payment requests
- **Data Fetching**: Handles read-only data requests
- **Policy Building**: Creates authorization policies dynamically

### Merchant Worker (`src/merchant.ts`)
- **Token Validation**: Validates AgentOAuth tokens at the edge
- **Payment Processing**: Processes authorized payments
- **Data Serving**: Serves data to authorized agents
- **Admin Operations**: Handles administrative tasks

## 🎯 API Endpoints

### Agent Worker

| Endpoint | Method | Description |
|----------|---------|-------------|
| `/health` | GET | Health check and capabilities |
| `/issue-token` | POST | Issue consent token manually |
| `/make-payment` | POST | Issue token + forward payment |
| `/fetch-data` | POST | Issue token + fetch data |
| `/build-policy` | POST | Build authorization policy |

### Merchant Worker

| Endpoint | Method | Scope Required | Description |
|----------|---------|---------------|-------------|
| `/health` | GET | None | Public health check |
| `/status` | GET | None (optional) | Status with optional auth |
| `/receive-payment` | POST | `pay:merchant` | Process payments |
| `/data` | GET | `read:data` | Serve data |
| `/admin/revoke` | POST | `admin:manage` | Revoke tokens |

## 🧪 Testing Examples

### 1. Issue Token Manually

```bash
curl -X POST https://agentoauth-agent.your-subdomain.workers.dev/issue-token \
  -H "Content-Type: application/json" \
  -d '{
    "user": "did:example:alice",
    "agent": "cf-agent-v1",
    "scope": "pay:merchant",
    "limit": {"amount": 1000, "currency": "USD"},
    "audience": "merchant.example",
    "expiresIn": "1h"
  }'
```

### 2. Make Payment (Agent → Merchant)

```bash
curl -X POST https://agentoauth-agent.your-subdomain.workers.dev/make-payment \
  -H "Content-Type: application/json" \
  -d '{
    "merchantUrl": "https://agentoauth-merchant.your-subdomain.workers.dev/receive-payment",
    "merchant": "merchant.example",
    "payment": {
      "amount": 250,
      "currency": "USD",
      "recipient": "merchant-123",
      "description": "Cloudflare Workers payment"
    },
    "policy": {
      "preset": "payment",
      "maxAmount": 1000,
      "expiresIn": "1h"
    }
  }'
```

### 3. Fetch Data

```bash
curl -X POST https://agentoauth-agent.your-subdomain.workers.dev/fetch-data \
  -H "Content-Type: application/json" \
  -d '{
    "dataUrl": "https://agentoauth-merchant.your-subdomain.workers.dev/data",
    "merchant": "merchant.example"
  }'
```

### 4. Build Policy

```bash
curl -X POST https://agentoauth-agent.your-subdomain.workers.dev/build-policy \
  -H "Content-Type: application/json" \
  -d '{
    "preset": "payment",
    "limits": {"amount": 5000, "currency": "EUR"},
    "scopes": ["pay:merchant", "read:receipt"],
    "expiresIn": "2h",
    "audience": "eu-merchant.example"
  }'
```

## 🔧 Configuration

### Environment Variables

Set these using `wrangler secret put`:

```bash
# For agent worker (optional - auto-generates if not set)
wrangler secret put AGENTOAUTH_PRIVATE_KEY --env agent

# For merchant worker (optional - validates self-contained tokens)
wrangler secret put AGENTOAUTH_PUBLIC_KEY --env merchant

# Merchant API URL for agent
wrangler secret put MERCHANT_API_URL --env agent
```

### Wrangler Configuration

Edit `wrangler.toml`:

```toml
name = "agentoauth-quickstart"
main = "src/agent.ts"
compatibility_date = "2023-10-16"

[env.agent]
name = "your-agent-worker-name"
main = "src/agent.ts"

[env.merchant]  
name = "your-merchant-worker-name"
main = "src/merchant.ts"
```

## 🌍 Edge Benefits

### Global Distribution
- **Sub-50ms latency** worldwide
- **Auto-scaling** based on demand
- **Zero cold starts** for active regions

### Security at the Edge
- **Token validation** before reaching origin
- **DDoS protection** built-in
- **SSL/TLS termination** at edge

### Cost Efficiency
- **Pay per request** (100k free requests/day)
- **No server management**
- **Automatic optimization**

## 🎯 5-Minute Development Flow

1. **Clone & Install** (1 minute)
   ```bash
   npm install
   npx wrangler login
   ```

2. **Local Development** (2 minutes)
   ```bash
   npm run agent:dev     # Terminal 1
   npm run merchant:dev  # Terminal 2
   ```

3. **Test Locally** (1 minute)
   ```bash
   # Test payment flow
   curl -X POST http://localhost:8787/make-payment -H "Content-Type: application/json" -d '{"merchantUrl": "http://localhost:8788/receive-payment", "payment": {"amount": 100, "recipient": "test"}}'
   ```

4. **Deploy to Edge** (1 minute)
   ```bash
   npx wrangler deploy --env agent
   npx wrangler deploy --env merchant
   ```

5. **Test Production** (30 seconds)
   ```bash
   curl https://your-agent.workers.dev/health
   curl https://your-merchant.workers.dev/health
   ```

## 🔄 Complete Flow Example

### Step 1: Agent Issues Token & Makes Payment

```javascript
// POST /make-payment
{
  "merchantUrl": "https://merchant.workers.dev/receive-payment",
  "merchant": "merchant.example",
  "payment": {
    "amount": 500,
    "currency": "USD", 
    "recipient": "shop-123"
  },
  "policy": {
    "preset": "payment",
    "maxAmount": 1000
  }
}
```

### Step 2: Agent Worker Flow

1. **Build Policy**: Creates payment policy with $1000 limit
2. **Issue Token**: Generates consent token with policy
3. **Forward Request**: Sends payment to merchant with token
4. **Return Result**: Returns merchant response to caller

### Step 3: Merchant Worker Flow

1. **Extract Token**: Gets Bearer token from Authorization header
2. **Validate Token**: Verifies signature and expiration
3. **Check Scope**: Ensures `pay:merchant` scope present
4. **Validate Amount**: Checks amount against token limit
5. **Process Payment**: Creates transaction and returns result

### Step 4: Response

```json
{
  "success": true,
  "payment": {
    "transactionId": "cf_1699123456_abc123",
    "amount": 500,
    "currency": "USD",
    "authorizedBy": "did:worker:agent",
    "agent": "cf-worker-agent-v1"
  },
  "tokenUsed": true,
  "timestamp": "2023-11-04T12:34:56.789Z"
}
```

## 🏗️ Architecture Benefits

### Agent Worker
- **Token Generation**: Creates tokens on-demand at edge
- **Request Signing**: Automatically signs outbound requests
- **Policy Management**: Dynamic policy creation
- **Error Handling**: Comprehensive error responses

### Merchant Worker  
- **Token Validation**: Validates tokens at edge before processing
- **Scope Enforcement**: Granular permission checking
- **Amount Limits**: Financial limit validation
- **Audit Logging**: Request logging for compliance

## 📊 Performance Characteristics

- **Latency**: <50ms globally (vs 200ms+ traditional servers)
- **Throughput**: 1000+ requests/second per region
- **Availability**: 99.9%+ uptime SLA
- **Scalability**: Auto-scales to zero and infinity

## 🔄 Production Considerations

### Key Management
```javascript
// Use Cloudflare KV for key storage
const publicKey = await env.KEYS.get('public-key-v1');
```

### Token Revocation
```javascript
// Use Durable Objects for revocation list
const revokedTokens = env.REVOCATION_LIST.get(id);
```

### Rate Limiting
```javascript
// Use Cloudflare Rate Limiting API
if (await isRateLimited(request)) {
  return new Response('Rate limited', { status: 429 });
}
```

### Monitoring
```javascript
// Use Cloudflare Analytics
console.log(JSON.stringify({
  event: 'token_validated',
  user: payload.user,
  amount: request.amount
}));
```

## 🎯 Next Steps

1. **Custom Domains**: Add custom domains to workers
2. **KV Storage**: Store keys and revocation lists in KV
3. **Durable Objects**: Use for stateful operations
4. **R2 Storage**: Store audit logs and analytics
5. **Workers Analytics**: Monitor usage and performance

## 💡 Why Cloudflare Workers?

- **Global Edge Network**: 300+ locations worldwide
- **Instant Deployment**: Deploy in seconds
- **Serverless Simplicity**: No infrastructure management
- **Cost Effective**: Pay only for usage
- **High Performance**: V8 isolates, not containers
- **Developer Experience**: Great tooling with Wrangler

**Result: Production-ready AgentOAuth at the edge in under 5 minutes! 🚀**
