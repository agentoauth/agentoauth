# Cloudflare Workers Policy Verifier - Testing Guide

## Prerequisites

```bash
cd packages/hosted-verifier
pnpm install
wrangler dev  # Start local dev server
```

In another terminal, run test commands against `http://localhost:8787`.

## Test Data Setup

### Generate Test Keys

```bash
pnpm run gen-keys
```

This generates:
- API key signing keypair
- Demo API key for testing

### Create Test Policy

```json
{
  "version": "pol.v0.2",
  "id": "pol_test_001",
  "actions": ["payments.send"],
  "resources": [
    {"type": "merchant", "match": {"ids": ["airbnb", "expedia"]}}
  ],
  "limits": {
    "per_txn": {"amount": 500, "currency": "USD"},
    "per_period": {"amount": 1500, "currency": "USD", "period": "week"}
  },
  "constraints": {
    "time": {
      "start": "08:00",
      "end": "20:00",
      "tz": "UTC"
    }
  }
}
```

### Create Test Token

Use the SDK or Playground to create an `act.v0.2` token with the policy embedded.

## Test Scenarios

### 1. Policy Linting

**Test**: Basic policy validation

```bash
curl -X POST http://localhost:8787/lint/policy \
  -H "Content-Type: application/json" \
  -d @test-policy.json
```

**Expected**: `200 OK` with `valid: true` and `policy_hash`.

**Test**: Invalid policy (missing fields)

```bash
curl -X POST http://localhost:8787/lint/policy \
  -H "Content-Type: application/json" \
  -d '{"version": "pol.v0.2"}'
```

**Expected**: `400 Bad Request` with `valid: false` and errors array.

### 2. Token Linting

**Test**: Valid token

```bash
curl -X POST http://localhost:8787/lint/token \
  -H "Content-Type: application/json" \
  -d '{"token": "eyJhbGciOiJFZERTQSIs..."}'
```

**Expected**: `200 OK` with decoded header and payload.

### 3. Stateless Policy Checks (DENY)

**Test**: Amount exceeds per_txn limit

```bash
curl -X POST http://localhost:8787/verify \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ak_demo_..." \
  -d '{
    "token": "<token_with_policy>",
    "action": "payments.send",
    "resource": {"type": "merchant", "id": "airbnb"},
    "amount": 600,
    "currency": "USD"
  }'
```

**Expected**: `403 Forbidden` with `decision: "DENY"` and reason about amount limit.

**Test**: Invalid action

```bash
curl -X POST http://localhost:8787/verify \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ak_demo_..." \
  -d '{
    "token": "<token_with_policy>",
    "action": "payments.review",
    "resource": {"type": "merchant", "id": "airbnb"},
    "amount": 250,
    "currency": "USD"
  }'
```

**Expected**: `403 Forbidden` with reason about action not permitted.

**Test**: Invalid resource

```bash
curl -X POST http://localhost:8787/verify \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ak_demo_..." \
  -d '{
    "token": "<token_with_policy>",
    "action": "payments.send",
    "resource": {"type": "merchant", "id": "booking"},
    "amount": 250,
    "currency": "USD"
  }'
```

**Expected**: `403 Forbidden` with reason about resource not allowed.

**Test**: Outside time window

```bash
# Make request at 21:00 UTC
curl -X POST http://localhost:8787/verify \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ak_demo_..." \
  -d '{
    "token": "<token_with_policy>",
    "action": "payments.send",
    "resource": {"type": "merchant", "id": "airbnb"},
    "amount": 250,
    "currency": "USD",
    "context": {"time": "2025-01-01T21:00:00Z"}
  }'
```

**Expected**: `403 Forbidden` with reason about time constraint.

### 4. Stateful Budget Tracking

**Test**: First request within budget

```bash
curl -X POST http://localhost:8787/verify \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ak_demo_..." \
  -d '{
    "token": "<token_with_policy>",
    "action": "payments.send",
    "resource": {"type": "merchant", "id": "airbnb"},
    "amount": 250,
    "currency": "USD"
  }'
```

**Expected**: `200 OK` with `decision: "ALLOW"`, receipt_id, and remaining_budget showing 1250.

**Test**: Second request reducing budget

Repeat the same request.

**Expected**: `200 OK` with remaining_budget showing 1000.

**Test**: Exhaust budget

Make multiple requests totaling 1500 USD.

**Expected**: Final request or next exceeding 1500 returns `403 Forbidden` with reason about budget exhausted.

**Test**: Concurrent budget updates

Make 3 concurrent requests for 250 USD each.

**Expected**: All should succeed with atomic budget tracking (no overspend).

### 5. Replay Protection

**Test**: Reuse same token

```bash
# First request
curl -X POST http://localhost:8787/verify \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ak_demo_..." \
  -d @request.json

# Second request with same token
curl -X POST http://localhost:8787/verify \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ak_demo_..." \
  -d @request.json
```

**Expected**: First succeeds, second returns `409 Conflict` with `replay_detected`.

**Note**: With per_period limits, tokens can be reused for budget tracking. Replay protection is per-policy implementation.

### 6. Idempotency Keys

**Test**: Same idempotency key

```bash
# First request with idempotency_key
curl -X POST http://localhost:8787/verify \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ak_demo_..." \
  -d '{
    "token": "<token_with_policy>",
    "action": "payments.send",
    "resource": {"type": "merchant", "id": "airbnb"},
    "amount": 250,
    "currency": "USD",
    "idempotency_key": "idem_unique_123"
  }'

# Repeat with same key
curl -X POST http://localhost:8787/verify \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ak_demo_..." \
  -d '{
    "token": "<token_with_policy>",
    "action": "payments.send",
    "resource": {"type": "merchant", "id": "airbnb"},
    "amount": 250,
    "currency": "USD",
    "idempotency_key": "idem_unique_123"
  }'
```

**Expected**: Both return same decision without budget deduction on second call.

### 7. Revocation

**Test**: Revoke token

```bash
# 1. Revoke
curl -X POST http://localhost:8787/revoke \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ak_demo_..." \
  -d '{"jti": "act_..."}'

# 2. Try to verify
curl -X POST http://localhost:8787/verify \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ak_demo_..." \
  -d '{
    "token": "<revoked_token>",
    "action": "payments.send",
    "resource": {"type": "merchant", "id": "airbnb"},
    "amount": 250,
    "currency": "USD"
  }'
```

**Expected**: `403 Forbidden` with `code: "REVOKED"`.

**Test**: Revoke policy

```bash
# 1. Revoke policy
curl -X POST http://localhost:8787/revoke \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ak_demo_..." \
  -d '{"policy_id": "pol_test_001"}'

# 2. Try to verify any token with this policy
curl -X POST http://localhost:8787/verify \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ak_demo_..." \
  -d @request.json
```

**Expected**: `403 Forbidden` with `code: "POLICY_REVOKED"`.

### 8. Simulation Endpoint

**Test**: Same result, no mutation

```bash
# 1. Check budget via verify
curl -X POST http://localhost:8787/verify \
  -H "X-API-Key: ak_demo_..." \
  -d @request.json
# Note: remaining_budget

# 2. Simulate (multiple times)
curl -X POST http://localhost:8787/simulate \
  -H "X-API-Key: ak_demo_..." \
  -d @request.json

curl -X POST http://localhost:8787/simulate \
  -H "X-API-Key: ak_demo_..." \
  -d @request.json

# 3. Verify again - budget unchanged
curl -X POST http://localhost:8787/verify \
  -H "X-API-Key: ak_demo_..." \
  -d @request.json
```

**Expected**: Simulation returns same remaining_budget repeatedly, verify shows unchanged budget.

### 9. Receipt Retrieval

**Test**: Get receipt by ID

```bash
# 1. Make request to get receipt_id
RECEIPT_ID=$(curl -X POST http://localhost:8787/verify \
  -H "X-API-Key: ak_demo_..." \
  -d @request.json | jq -r '.receipt_id')

# 2. Retrieve receipt
curl http://localhost:8787/receipts/$RECEIPT_ID
```

**Expected**: Returns JWS compact format receipt token.

**Test**: Invalid receipt ID

```bash
curl http://localhost:8787/receipts/rcpt_invalid
```

**Expected**: `404 Not Found`.

### 10. Policy Hash Verification

**Test**: Tampered policy

```bash
# 1. Create token with valid policy
# 2. Manually modify the policy in the token payload
# 3. Try to verify

curl -X POST http://localhost:8787/verify \
  -H "X-API-Key: ak_demo_..." \
  -d '{
    "token": "<token_with_modified_policy>",
    ...
  }'
```

**Expected**: `400 Bad Request` with `code: "POLICY_HASH_MISMATCH"`.

### 11. Legacy Token Support

**Test**: Token without policy

```bash
curl -X POST http://localhost:8787/verify \
  -H "X-API-Key: ak_demo_..." \
  -d '{
    "token": "<legacy_token_v0.2_without_policy>",
    "audience": "merchant.example"
  }'
```

**Expected**: `200 OK` with `valid: true` (legacy validation).

### 12. Error Handling

**Test**: Missing API key

```bash
curl -X POST http://localhost:8787/verify \
  -H "Content-Type: application/json" \
  -d @request.json
```

**Expected**: `401 Unauthorized` with `code: "MISSING_API_KEY"`.

**Test**: Invalid API key

```bash
curl -X POST http://localhost:8787/verify \
  -H "X-API-Key: invalid_key" \
  -d @request.json
```

**Expected**: `401 Unauthorized` with `code: "INVALID_API_KEY"`.

**Test**: Missing token

```bash
curl -X POST http://localhost:8787/verify \
  -H "X-API-Key: ak_demo_..." \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected**: `400 Bad Request` with `code: "MISSING_TOKEN"`.

**Test**: Expired token

```bash
curl -X POST http://localhost:8787/verify \
  -H "X-API-Key: ak_demo_..." \
  -d '{
    "token": "<expired_token>",
    ...
  }'
```

**Expected**: `400 Bad Request` with `code: "EXPIRED"`.

## Integration Tests

### Complete Workflow

```bash
#!/bin/bash

API_KEY="ak_demo_..."
BASE_URL="http://localhost:8787"

# 1. Health check
curl -s $BASE_URL/health | jq .

# 2. Lint policy
POLICY_HASH=$(curl -s -X POST $BASE_URL/lint/policy \
  -H "Content-Type: application/json" \
  -d @test-policy.json | jq -r '.policy_hash')

# 3. Create token with policy (using SDK or Playground)
TOKEN="eyJhbGciOiJFZERTQSIs..."

# 4. Verify first request
RECEIPT_ID=$(curl -s -X POST $BASE_URL/verify \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d @request.json | jq -r '.receipt_id')

# 5. Retrieve receipt
curl -s $BASE_URL/receipts/$RECEIPT_ID

# 6. Exhaust budget
for i in {1..6}; do
  curl -s -X POST $BASE_URL/verify \
    -H "X-API-Key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d @request.json | jq '.decision'
done

# 7. Revoke policy
curl -s -X POST $BASE_URL/revoke \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"policy_id": "pol_test_001"}' | jq .

# 8. Try to verify (should fail)
curl -s -X POST $BASE_URL/verify \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d @request.json | jq '.code'
```

## Performance Testing

### Load Test

```bash
# Install Apache Bench
brew install httpd  # macOS

# Run load test
ab -n 1000 -c 10 \
  -p request.json \
  -T "application/json" \
  -H "X-API-Key: ak_demo_..." \
  http://localhost:8787/verify
```

Monitor:
- p50, p95, p99 latency
- Requests per second
- Error rate

### Target Metrics

- **p50 verify**: < 200ms
- **p50 simulate**: < 120ms
- **p95**: < 500ms
- **Error rate**: < 0.1%

## Acceptance Criteria Checklist

- [x] Stateless DENY works (amount > per_txn)
- [x] Budgets update atomically (concurrent requests)
- [x] Replay detected on duplicate jti/idempotency_key
- [x] Revocations effective within 2s
- [x] /simulate returns same decision without mutation
- [ ] p50 latency < 200ms verify, < 120ms simulate
- [x] Receipt signing and retrieval works
- [x] /lint endpoints validate correctly
- [x] Multi-tenant isolation (iss-based)
- [ ] Trial tier rate limits enforced

## Troubleshooting

### Issue: "Policy hash verification failed"

Check that policy embedded in token matches the policy_hash field.

### Issue: "Replay detected" on first request

Verify the token has a unique jti. Check Durable Object state isn't persisted.

### Issue: Budget not decreasing

Ensure per_period limit exists and amount is provided in request.

### Issue: High latency

Check Durable Object invocation logs. Consider caching or optimization.

## Next Steps

1. Run all tests against production
2. Monitor error rates and latency
3. Set up automated testing in CI/CD
4. Add load testing to deployment pipeline

