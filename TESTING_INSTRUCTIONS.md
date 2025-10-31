# AgentOAuth v0.7 Testing Instructions

Complete testing guide for Phase 2A: Policy Support

## Prerequisites

All builds must pass first:
```bash
cd /Users/prithvi/projects/agentoauth
pnpm install
pnpm build
```

---

## 🚀 Automated Testing (Recommended)

**Run all tests automatically:**

```bash
cd packages/examples
pnpm test-e2e
# or
node test-policy-e2e.js
```

This will:
- ✅ Start/stop Verifier API automatically
- ✅ Run all 7 tests sequentially
- ✅ Show colored pass/fail results
- ✅ Print summary report

Expected: All 7 tests pass! 🎉

---

## Manual Testing (Step-by-Step)

## Test 1: Issue Token with Policy (Standalone)

### Terminal 1: Issue Token
```bash
cd packages/examples
node issue-with-policy.js
```

**Expected Output:**
- Policy JSON displayed
- Full token string displayed (copy this!)
- Token payload shown
- Policy details shown

**What This Tests:**
- Policy Builder fluent API
- Canonical JSON hashing
- Policy hash generation
- Token creation with policy

---

## Test 2: Decode Token (Standalone)

### Terminal: Decode Token
```bash
cd packages/examples
node verify-with-policy.js
# Paste token from Test 1 when prompted
```

**Expected Output:**
- ✅ Token is valid!
- Decoded payload shown
- Full policy JSON shown
- Note about full verification

**What This Tests:**
- Token decoding
- Policy extraction
- Payload display

---

## Test 3: Full Policy Evaluation (Verifier API)

### Terminal 1: Start Verifier API
```bash
cd packages/verifier-api
pnpm dev
```

Wait for: `✅ Server listening on http://localhost:3000`

### Terminal 2: Create Token with Policy
```bash
curl -X POST http://localhost:3000/demo/create-token \
  -H "Content-Type: application/json" \
  -d '{
    "user": "did:example:alice",
    "agent": "travel-assistant@company.com",
    "scope": "payments.send",
    "policy": {
      "version": "pol.v0.2",
      "id": "pol_travel_001",
      "actions": ["payments.send"],
      "resources": [{"type": "merchant", "match": {"ids": ["airbnb"]}}],
      "limits": {
        "per_txn": {"amount": 500, "currency": "USD"},
        "per_period": {"amount": 1500, "currency": "USD", "period": "week"}
      }
    }
  }'
```

**Expected Response:**
```json
{
  "token": "eyJ...",
  "payload": {...},
  "kid": "key-..."
}
```

**Copy the token from response**

### Terminal 3: Test ALLOW Decision
```bash
curl -X POST http://localhost:3000/verify \
  -H "Content-Type: application/json" \
  -d '{
    "token": "PASTE_TOKEN_HERE",
    "action": "payments.send",
    "resource": {"type": "merchant", "id": "airbnb"},
    "amount": 250,
    "currency": "USD"
  }'
```

**Expected Response:**
```json
{
  "valid": true,
  "payload": {...},
  "policy_decision": {
    "allowed": true,
    "reason": null,
    "remaining": {"period": 1250, "currency": "USD"},
    "receipt_id": "receipt_xxx",
    "receipt": "eyJ..."
  }
}
```

**What This Tests:**
- Policy hash validation
- Action matching
- Resource matching
- Per-transaction limit check
- Budget tracking
- Receipt generation

---

## Test 4: DENY Decision (Amount Exceeded)

### Using same token from Test 3:

```bash
curl -X POST http://localhost:3000/verify \
  -H "Content-Type: application/json" \
  -d '{
    "token": "PASTE_TOKEN_HERE",
    "action": "payments.send",
    "amount": 600,
    "currency": "USD"
  }'
```

**Expected Response:**
```json
{
  "valid": false,
  "error": "Transaction amount exceeds per-transaction limit of 500 USD",
  "policy_decision": {
    "allowed": false,
    "reason": "Transaction amount exceeds per-transaction limit of 500 USD",
    "receipt_id": "receipt_xxx",
    "receipt": "eyJ..."
  },
  "code": "POLICY_DENY"
}
```

**What This Tests:**
- Per-transaction limit enforcement
- Proper error messaging
- DENY receipt generation

---

## Test 5: Budget Tracking

### Using same token from Test 3, make multiple requests:

```bash
# Request 1 - Should ALLOW
curl -X POST http://localhost:3000/verify \
  -H "Content-Type: application/json" \
  -d '{
    "token": "PASTE_TOKEN_HERE",
    "action": "payments.send",
    "amount": 400,
    "currency": "USD"
  }'

# Request 2 - Should ALLOW
curl -X POST http://localhost:3000/verify \
  -H "Content-Type: application/json" \
  -d '{
    "token": "PASTE_TOKEN_HERE",
    "action": "payments.send",
    "amount": 400,
    "currency": "USD"
  }'

# Request 3 - Should ALLOW
curl -X POST http://localhost:3000/verify \
  -H "Content-Type: application/json" \
  -d '{
    "token": "PASTE_TOKEN_HERE",
    "action": "payments.send",
    "amount": 400,
    "currency": "USD"
  }'

# Request 4 - Should DENY (budget exceeded: 1200 > 1500 remaining)
curl -X POST http://localhost:3000/verify \
  -H "Content-Type: application/json" \
  -d '{
    "token": "PASTE_TOKEN_HERE",
    "action": "payments.send",
    "amount": 400,
    "currency": "USD"
  }'
```

**Expected:**
- First 3 requests: `allowed: true`, remaining budget decreases
- 4th request: `allowed: false`, reason mentions budget exceeded

**What This Tests:**
- Stateful budget tracking
- Per-period limit enforcement
- Budget decrementing

---

## Test 6: Receipt Retrieval

### From Test 3 or 4, copy a receipt_id, then:

```bash
curl http://localhost:3000/receipts/RECEIPT_ID_HERE
```

**Expected Response:**
```json
{
  "receipt": "eyJ..."
}
```

**Decode the receipt JWT** to see decision and metadata

**What This Tests:**
- Receipt storage
- Receipt retrieval

---

## Test 7: Policy Revocation

### Using a policy_id from Test 3:

```bash
curl -X POST http://localhost:3000/revoke \
  -H "Content-Type: application/json" \
  -d '{"policy_id": "pol_travel_001"}'
```

**Expected Response:**
```json
{
  "success": true,
  "policy_id": "pol_travel_001",
  "revokedAt": "2025-10-31T18:00:00.000Z",
  "alreadyRevoked": false
}
```

### Then try to use the token again:

```bash
curl -X POST http://localhost:3000/verify \
  -H "Content-Type: application/json" \
  -d '{
    "token": "PASTE_TOKEN_HERE",
    "action": "payments.send",
    "amount": 100,
    "currency": "USD"
  }'
```

**Expected Response:**
```json
{
  "valid": false,
  "error": "Policy has been revoked",
  "code": "POLICY_REVOKED"
}
```

**What This Tests:**
- Policy-level revocation
- Revoked policy detection

---

## Test 8: Playground UI

### Start Playground:
```bash
cd packages/playground
pnpm dev
```

Open http://localhost:8080

### Test Policy Builder Tab:
1. Fill in policy fields
2. Click "Build Policy JSON"
3. Verify policy structure

### Test Policy Tester Tab:
1. Get a token from `/demo/create-token` endpoint
2. Paste token
3. Fill in test context
4. Click "Test Policy"
5. Verify ALLOW/DENY decision

**What This Tests:**
- Policy Builder UI
- Policy Tester UI
- Visual feedback

---

## Quick Testing Checklist

- [ ] Issue token with policy (issue-with-policy.js)
- [ ] Decode token and view policy (verify-with-policy.js)
- [ ] Create token via API with policy
- [ ] Evaluate policy - ALLOW case
- [ ] Evaluate policy - DENY case (limit exceeded)
- [ ] Test budget tracking across requests
- [ ] Retrieve receipt
- [ ] Revoke policy
- [ ] Use playground UI

---

## Troubleshooting

### Issue: "no applicable key found in JSON Web Key Set"
**Fix:** Make sure you're using tokens created by `/demo/create-token`, not `issue-with-policy.js`

### Issue: "Verifier API not running"
**Fix:** Start verifier: `cd packages/verifier-api && pnpm dev`

### Issue: "Token expired"
**Fix:** Create a new token with longer expiry

### Issue: Budget not tracking
**Fix:** Check that per_period limit is in policy and amount/currency match

---

## Success Criteria

All tests should pass:
- ✅ Policies can be created with fluent API
- ✅ Tokens include policy and policy_hash
- ✅ Verifier evaluates policies correctly
- ✅ ALLOW/DENY decisions work
- ✅ Budgets track statefully
- ✅ Receipts are signed and retrievable
- ✅ Policies can be revoked
- ✅ Playground UI works

---

## Next Steps After Testing

1. Review logs for any errors
2. Check CHANGELOG.md is up to date
3. Tag release: `git tag v0.7.0`
4. Push changes

