# Cloudflare Workers Policy Verifier - Deployment Guide

## Prerequisites

- Cloudflare account with Workers plan ($5/month)
- `wrangler` CLI v4.0+ installed and authenticated
- Domain configured in Cloudflare (e.g., `agentoauth.org`)
- Node.js 18+ and pnpm installed
- GitHub repository (for CI/CD)

**Note**: Wrangler v4 is required for Durable Objects. Upgrade with:
```bash
pnpm install  # Installs wrangler@^4.0.0
```

## Local Development Setup

### 1. Install Dependencies

```bash
cd packages/hosted-verifier
pnpm install
```

### 2. Generate Signing Keys

```bash
# This creates keys for API auth and receipt signing
pnpm run gen-keys

# Follow instructions to set secrets
```

### 3. Test Locally

```bash
# Start local development server
wrangler dev

# In another terminal, test health endpoint
curl http://localhost:8787/health
```

You should see:
```json
{
  "status": "ok",
  "service": "agentoauth-verifier",
  "version": "0.7.0",
  "features": ["act.v0.2", "policy-eval", "stateful-budgets", "receipts"]
}
```

## Automated Deployment (Recommended)

The fastest way to deploy is using the automated deployment script:

### Prerequisites
- Wrangler CLI authenticated (`wrangler login`)
- Generated keys (`pnpm run gen-keys`)

### Steps

```bash
cd packages/hosted-verifier

# 1. Generate keys (auto-creates .env.local)
pnpm run gen-keys

# 2. Run automated deployment
pnpm run deploy:auto
```

The script will:
1. Check wrangler authentication
2. Load secrets from .env.local
3. Create KV namespaces automatically
4. Update wrangler.toml with IDs
5. Create R2 bucket (if needed)
6. Set all Cloudflare secrets
7. Deploy to production
8. Verify deployment

**That's it!** Your verifier is deployed.

---

## Manual Deployment

If you prefer manual control, follow these steps:

### 1. Create Cloudflare Resources

```bash
# Create KV namespace for rate limiting and storage
wrangler kv namespace create RATE_LIMIT_KV

# The command above will output the production namespace ID.
# Copy the ID and update wrangler.toml
# For preview namespace (for wrangler dev), create separately:
wrangler kv namespace create RATE_LIMIT_KV_PREVIEW

# Create R2 bucket for audit logs (optional)
wrangler r2 bucket create agentoauth-audit-logs

# Update wrangler.toml with the IDs returned above
```

### 2. Update Configuration

Edit `wrangler.toml` and replace:
- `id` in `[[env.production.kv_namespaces]]` with your production KV namespace ID
- `preview_id` with your preview KV namespace ID
- Verify `zone_name` matches your domain

### 3. Set Secrets

```bash
# API key public key (from gen-keys output)
wrangler secret put API_KEY_PUBLIC_KEY --env production

# Audit salt for PII hashing
wrangler secret put AUDIT_SALT --env production

# Receipt signing private key (JWK format)
wrangler secret put SIGNING_PRIVATE_KEY --env production

# Receipt signing key ID
wrangler secret put SIGNING_KID --env production
```

**Example SIGNING_PRIVATE_KEY format:**
```json
{
  "kty": "OKP",
  "crv": "Ed25519",
  "d": "...",
  "x": "...",
  "alg": "EdDSA"
}
```

### 4. Deploy to Production

```bash
# Deploy the worker with Durable Object
wrangler deploy --env production

# Verify deployment
curl https://verifier.agentoauth.org/health
```

## CI/CD Setup

### Automated Testing

The project includes E2E tests that run automatically in GitHub Actions:

```bash
# Run tests locally
cd packages/hosted-verifier
pnpm test
```

This will:
1. Start `wrangler dev` server
2. Wait for worker to be ready
3. Run health check, policy linting, and verification tests
4. Stop the server

### GitHub Actions Configuration

Tests are configured in `.github/workflows/ci.yml`:

```yaml
- name: Run Cloudflare Workers E2E tests
  run: |
    cd packages/hosted-verifier
    pnpm test
  env:
    NODE_ENV: test
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
  continue-on-error: true
```

**Required GitHub Secrets:**
- `CLOUDFLARE_API_TOKEN` - API token with Workers permissions
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID

To set up secrets:
1. Go to Cloudflare Dashboard → My Profile → API Tokens
2. Create token with `Account.Cloudflare Workers:Edit` permissions
3. Add to GitHub repo: Settings → Secrets and variables → Actions

### Automated Deployment

For automated deployments, add a deployment step:

```yaml
- name: Deploy to Cloudflare Workers
  run: |
    cd packages/hosted-verifier
    wrangler deploy --env production
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
  if: github.ref == 'refs/heads/main'
```

## Testing the Deployment

### 1. Basic Health Check

```bash
curl https://verifier.agentoauth.org/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "agentoauth-verifier",
  "version": "0.7.0",
  "features": ["act.v0.2", "policy-eval", "stateful-budgets", "receipts"]
}
```

### 2. Test Policy Linting

```bash
curl -X POST https://verifier.agentoauth.org/lint/policy \
  -H "Content-Type: application/json" \
  -d '{
    "version": "pol.v0.2",
    "id": "pol_test_001",
    "actions": ["payments.send"],
    "resources": [{"type": "merchant", "match": {"ids": ["airbnb"]}}],
    "limits": {
      "per_txn": {"amount": 500, "currency": "USD"},
      "per_period": {"amount": 1500, "currency": "USD", "period": "week"}
    }
  }'
```

Expected response:
```json
{
  "valid": true,
  "policy_hash": "sha256:...",
  "canonical": "{...}"
}
```

### 3. Test Token Linting

```bash
curl -X POST https://verifier.agentoauth.org/lint/token \
  -H "Content-Type: application/json" \
  -d '{
    "token": "eyJhbGciOiJFZERTQSIs..."
  }'
```

### 4. Test Policy Verification (with API key)

First, you'll need a valid API key. See the existing README for API key generation.

```bash
curl -X POST https://verifier.agentoauth.org/verify \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ak_your_api_key_here" \
  -d '{
    "token": "eyJhbGciOiJFZERTQSIs...",
    "action": "payments.send",
    "resource": {"type": "merchant", "id": "airbnb"},
    "amount": 250,
    "currency": "USD"
  }'
```

Expected response (ALLOW):
```json
{
  "decision": "ALLOW",
  "receipt_id": "rcpt_...",
  "policy_hash": "sha256:...",
  "remaining_budget": {
    "amount": 1250,
    "currency": "USD",
    "period_ends": "2025-11-09T00:00:00Z"
  }
}
```

Expected response (DENY):
```json
{
  "decision": "DENY",
  "reason": "Amount 600 USD exceeds per-transaction limit 500 USD"
}
```

### 5. Test Simulation (No State Changes)

```bash
curl -X POST https://verifier.agentoauth.org/simulate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ak_your_api_key_here" \
  -d '{
    "token": "eyJhbGciOiJFZERTQSIs...",
    "action": "payments.send",
    "resource": {"type": "merchant", "id": "airbnb"},
    "amount": 250,
    "currency": "USD"
  }'
```

Note: Includes `"simulation": true` in response.

### 6. Test Revocation

```bash
# Revoke a token
curl -X POST https://verifier.agentoauth.org/revoke \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ak_your_api_key_here" \
  -d '{
    "jti": "act_..."
  }'

# Or revoke a policy
curl -X POST https://verifier.agentoauth.org/revoke \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ak_your_api_key_here" \
  -d '{
    "policy_id": "pol_..."
  }'
```

### 7. Retrieve Receipt

```bash
curl https://verifier.agentoauth.org/receipts/rcpt_...
```

Returns JWS compact format receipt.

## Performance Testing

### Latency Targets

- **p50 verify**: < 200ms (with stateless checks)
- **p50 simulate**: < 120ms (no state mutations)
- **p95**: < 500ms

Test with `ab` or similar:

```bash
ab -n 100 -c 10 -H "X-API-Key: ak_your_key" -p test-request.json \
  https://verifier.agentoauth.org/verify
```

## Monitoring

### Cloudflare Dashboard

1. Logs: https://dash.cloudflare.com → Workers & Pages → agentoauth-verifier → Logs
2. Analytics: Workers & Pages → agentoauth-verifier → Analytics
3. Errors: Monitor error rates and latencies

### Key Metrics to Watch

- Request rate per second
- Error rates (by error code)
- p50, p95, p99 latency
- Durable Object HITS/MISS
- KV read/write operations

## Troubleshooting

### "No applicable key found"

Check that signing keys are properly set:
```bash
wrangler secret list --env production
```

### "Durable Object not found"

Ensure migrations are complete:
```bash
wrangler deploy --env production
# Check wrangler.toml for [[migrations]] section
```

### "KV namespace not found"

Verify KV namespaces are created and bound:
```bash
wrangler kv namespace list
```

### High Latency

- Check Durable Object invocations (expensive)
- Monitor KV read/write counts
- Consider caching JWKS responses
- Review policy complexity

## Rollback

If deployment fails:

```bash
# List recent deployments
wrangler versions list --env production

# Rollback to previous version
wrangler versions rollback <deployment-id>
```

## Security Checklist

- [ ] All secrets are set and not exposed
- [ ] Rate limiting is enabled
- [ ] Audit logging is working
- [ ] Revocations are effective
- [ ] Token size limits enforced (16KB)
- [ ] Policy size limits enforced (10KB)
- [ ] CORS configured appropriately
- [ ] API keys are rotating regularly

## Next Steps

1. Set up Cloudflare Analytics
2. Configure alerting for error rates
3. Add integration tests
4. Set up CI/CD pipeline
5. Monitor performance and optimize

## Support

- **Documentation**: See README.md in this directory
- **Issues**: https://github.com/agentoauth/agentoauth/issues
- **Email**: alpha@agentoauth.org

