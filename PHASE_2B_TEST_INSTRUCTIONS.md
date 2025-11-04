# Phase 2B Testing Instructions - Complete Guide

## 🎯 Overview

Phase 2B adds **passkey-backed intent approval** with time-bound validity to AgentOAuth. This guide covers testing all components: SDK, verifiers, UI, and integration flows.

---

## ⚡ Quick Start (2 Minutes)

**Fastest way to test Phase 2B:**

```bash
# 1. Build everything (from repo root)
cd /Users/prithvi/projects/agentoauth
pnpm build

# 2. Start verifier (Terminal 1)
cd packages/verifier-api
pnpm dev

# 3. Run intent tests (Terminal 2)
cd packages/examples
pnpm test:intent

# 4. Try the UI demo (Terminal 3)
cd packages/langchain-invoice-demo/ui
pnpm dev
# Open http://localhost:3001
# Generate policy → Approve with Passkey → Start Processing
```

**Expected Results:**
- ✅ All 4 intent tests pass
- ✅ UI shows passkey approval modal
- ✅ Receipts include intent verification

---

## 🏗️ Pre-Test Setup

### 1. Install Dependencies
```bash
cd /Users/prithvi/projects/agentoauth
pnpm install
pnpm build
```

### 2. Verify Build Status
```bash
# SDK should build with intent module
pnpm --filter @agentoauth/sdk build
# ✅ Expected: Build success, dist/intent.js created

# Verifier API should build with intent validator
pnpm --filter @agentoauth/verifier-api build
# ✅ Expected: Build success, includes intent/validator.ts

# Hosted verifier should have intent validator
ls packages/hosted-verifier/src/intent/validator.ts
# ✅ Expected: File exists
```

---

## 📦 Component 1: SDK Intent Module

### Test: `requestIntent()` Function

**Location:** `packages/sdk-js/src/intent.ts`

**Test in Browser Console:**
```javascript
import { requestIntent, buildPolicyV2 } from '@agentoauth/sdk';

// Create test policy
const policy = buildPolicyV2()
  .actions(['payments.send'])
  .limitPerTxn(500, 'USD')
  .limitPerPeriod(2000, 'USD', 'week')
  .merchants(['airbnb', 'uber'])
  .finalize();

// Request 30-day approval
const intent = await requestIntent(policy, 30, window.location.hostname);

console.log('Intent created:', intent);
// ✅ Should show passkey prompt (Face ID / Touch ID)
// ✅ Returns intent object with valid_until = now + 30 days
// ✅ challenge === policy_hash
```

**Expected Output:**
```json
{
  "type": "webauthn.v0",
  "credential_id": "base64url...",
  "signature": "base64url...",
  "client_data_json": "base64url...",
  "authenticator_data": "base64url...",
  "approved_at": "2025-11-05T19:30:00.000Z",
  "valid_until": "2025-12-05T19:30:00.000Z",
  "challenge": "sha256:abc123...",
  "rp_id": "localhost"
}
```

**Test: Helper Functions**
```javascript
import { isWebAuthnSupported, isIntentExpired, getIntentRemainingDays } from '@agentoauth/sdk';

// Check browser support
console.log('WebAuthn supported:', isWebAuthnSupported());
// ✅ Chrome/Safari/Edge: true
// ❌ Old browsers: false

// Check if intent expired
console.log('Intent expired:', isIntentExpired(intent));
// ✅ Should be false for fresh intent

// Get remaining days
console.log('Remaining days:', getIntentRemainingDays(intent));
// ✅ Should be 30 for fresh 30-day intent
```

---

## 📦 Component 2: SDK Token Issuance

### Test: `issueConsent()` with Intent

**Script:** Create `test-issue-intent.js`
```javascript
import { issueConsent, requestIntent, buildPolicyV2, hashPolicy } from '@agentoauth/sdk';
import { generateKeyPair, exportJWK } from 'jose';
import crypto from 'crypto';

// 1. Generate keys
const { privateKey, publicKey } = await generateKeyPair('EdDSA');
const privateJWK = await exportJWK(privateKey);
const publicJWK = await exportJWK(publicKey);
publicJWK.alg = 'EdDSA';
publicJWK.kid = 'test-key-1';

// 2. Create policy
const policy = buildPolicyV2()
  .actions(['payments.send'])
  .limitPerTxn(500, 'USD')
  .merchants(['airbnb'])
  .finalize();

// 3. Mock intent (browser-only in real use)
const mockIntent = {
  type: 'webauthn.v0',
  credential_id: 'mock_cred_' + crypto.randomBytes(16).toString('base64url'),
  signature: crypto.randomBytes(64).toString('base64url'),
  client_data_json: Buffer.from(JSON.stringify({
    type: 'webauthn.get',
    challenge: hashPolicy(policy)
  })).toString('base64url'),
  authenticator_data: crypto.randomBytes(37).toString('base64url'),
  approved_at: new Date().toISOString(),
  valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  challenge: hashPolicy(policy),
  rp_id: 'localhost'
};

// 4. Issue token with intent
const { token } = await issueConsent({
  user: 'did:user:alice',
  agent: 'did:agent:test',
  scope: ['payments.send'],
  policy,
  intent: mockIntent,
  privateKey: privateJWK,
  keyId: publicJWK.kid,
  expiresIn: '7d'
});

// 5. Decode and verify
import { decode } from '@agentoauth/sdk';
const decoded = decode(token);

console.log('Token version:', decoded.payload.ver);
// ✅ Expected: "act.v0.3"

console.log('Has intent:', !!decoded.payload.intent);
// ✅ Expected: true

console.log('Intent valid until:', decoded.payload.intent.valid_until);
// ✅ Expected: ~30 days from now
```

**Run:**
```bash
cd packages/examples
node test-issue-intent.js
```

---

## 📦 Component 3: Local Verifier Intent Validation

### Test: Start Verifier & Test Intent

**Terminal 1 - Start Verifier:**
```bash
cd packages/verifier-api
pnpm dev
# ✅ Should start on port 3000
# ✅ Logs should show "Listening on http://0.0.0.0:3000"
```

**Terminal 2 - Run Intent Tests:**
```bash
cd packages/examples
pnpm test:intent

# Or directly:
node test-intent-e2e.js
```

**Expected Output:**
```
╔═══════════════════════════════════════════════════════════════════╗
║            INTENT VALIDATION E2E TESTS (act.v0.3)                ║
╚═══════════════════════════════════════════════════════════════════╝

📝 Test 1: Valid Intent (30 days) - should ALLOW
✅ Test 1 PASSED
   Intent verified: N/A

📝 Test 2: Expired Intent - should DENY
✅ Test 2 PASSED
   Error: User approval expired on [date]

📝 Test 3: Policy Hash Mismatch - should DENY
✅ Test 3 PASSED
   Error: Intent challenge does not match policy hash

📝 Test 4: Backward Compatibility (v0.2) - should ALLOW
✅ Test 4 PASSED
   v0.2 token processed without intent validation

╔═══════════════════════════════════════════════════════════════════╗
║                         TEST SUMMARY                               ║
╚═══════════════════════════════════════════════════════════════════╝

✅ Test 1
✅ Test 2
✅ Test 3
✅ Test 4

Total: 4 tests
Passed: 4
Failed: 0
```

### Manual cURL Test: Valid Intent

```bash
# Create a v0.3 token (use script above or SDK)
# Then verify:

curl -X POST http://localhost:3000/verify \
  -H "Content-Type: application/json" \
  -d '{
    "token": "eyJ...YOUR_V0.3_TOKEN_HERE...",
    "audience": "merchant.example",
    "action": "payments.send",
    "resource": {"type": "merchant", "id": "airbnb"},
    "amount": 300,
    "currency": "USD"
  }'
```

**Expected Response:**
```json
{
  "valid": true,
  "payload": {
    "ver": "act.v0.3",
    "intent": { "valid_until": "2025-12-05..." }
  },
  "policy_decision": {
    "allowed": true,
    "receipt_id": "receipt_...",
    "receipt": "eyJ..."
  }
}
```

### Manual cURL Test: Expired Intent

```bash
# Create v0.3 token with expired intent (valid_until in past)
# Then verify (same curl as above)
```

**Expected Response:**
```json
{
  "valid": false,
  "error": "User approval expired on 2025-10-01T...",
  "code": "INTENT_EXPIRED",
  "intent_expired": true,
  "intent_valid_until": "2025-10-01T..."
}
```

---

## 📦 Component 4: Hosted Verifier (Cloudflare Workers)

### Test: Wrangler Dev Mode

```bash
cd packages/hosted-verifier
pnpm run dev
# Should start on http://localhost:8787
```

**Test Health Endpoint:**
```bash
curl http://localhost:8787/health

# Expected: features array includes "act.v0.3"
```

**Test v0.3 Token:**
```bash
# Create v0.3 token with intent
# Then:

curl -X POST http://localhost:8787/verify \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_V0.3_TOKEN",
    "audience": "merchant.example",
    "action": "payments.send",
    "resource": {"type": "merchant", "id": "airbnb"},
    "amount": 300,
    "currency": "USD"
  }'

# ✅ Should validate intent
# ✅ Receipt includes intent_verified: true
```

---

## 📦 Component 5: UI IntentApprover Component

### Test: Standalone Component

**Location:** `packages/langchain-invoice-demo/ui/components/IntentApprover.tsx`

**Test in UI:**
```bash
cd packages/langchain-invoice-demo/ui
pnpm dev
# Open http://localhost:3001
```

**Test Steps:**

1. **Generate Policy First**
   - Enter: "Travel: $500/trip, $2000/week, Airbnb, Uber"
   - Click "Generate Policy"
   - Wait for GPT-4 to create policy JSON

2. **Open Intent Approver**
   - Click "Approve with Passkey"
   - ✅ Modal should appear

3. **Verify UI Elements**
   - ✅ Policy summary card visible
   - ✅ Three duration buttons: 7 / 30 / 90 days
   - ✅ Default selected: 30 days
   - ✅ Expiry date shown (30 days from now)
   - ✅ "Approve with Passkey" button visible
   - ✅ "Cancel" button visible

4. **Test Duration Selection**
   - Click "7 Days" → Expiry updates to 7 days from now
   - Click "90 Days" → Expiry updates to 90 days from now
   - Click "30 Days" → Back to 30 days
   - ✅ Selected option has primary border/background

5. **Test Passkey Approval**
   - Click "Approve with Passkey"
   - ✅ Browser passkey prompt appears
   - Complete biometric/PIN
   - ✅ Modal closes
   - ✅ "Passkey Approved" badge appears
   - ✅ Shows expiry date

6. **Test Cancellation**
   - Open approver modal again (reset first)
   - Click "Cancel"
   - ✅ Modal closes
   - ✅ No intent created
   - ✅ Can still process without passkey

7. **Test Error Handling**
   - Open approver modal
   - Click "Approve with Passkey"
   - Dismiss passkey prompt (Cancel)
   - ✅ Error message shown in modal
   - ✅ Can retry or cancel

---

## 📦 Component 6: FlowProgressBar (Updated)

### Test: 6-Step Progress

**Location:** `packages/langchain-invoice-demo/ui/components/FlowProgressBar.tsx`

**Verify Steps:**
```bash
# In UI at http://localhost:3001
```

**Expected Steps:**
1. 👤 **User Input** - Active when typing policy
2. 🧠 **AI Generate** - Active during GPT-4 generation
3. 🔑 **User Approval** - Active when passkey modal open ← NEW STEP
4. ✍️ **Agent Sign** - Active when creating token (🔐 signature badge)
5. ✅ **Verify** - Active during verification (🔐 signature badge)
6. 💰 **Payment** - Active during Stripe processing

**Test Flow:**
1. Type policy → Step 1 active
2. Click "Generate" → Step 2 active
3. Click "Approve with Passkey" → Step 3 active
4. Complete approval → Step 3 marked complete ✅
5. Click "Start Processing" → Step 4 active
6. First invoice verified → Step 5 active
7. Payment processed → Step 6 active
8. All complete → All steps show ✅

**Hover Tooltips:**
- Hover over each step → Tooltip shows description
- ✅ "User Approval" tooltip: "Passkey approval with time limit"

---

## 📦 Component 7: Complete UI Demo Flow

### Test Scenario 1: Full Flow with Passkey (Happy Path)

```bash
cd packages/langchain-invoice-demo/ui

# Setup
cp .env.example .env
# Add STRIPE_SECRET_KEY and OPENAI_API_KEY to .env

pnpm dev
# Open http://localhost:3001
```

**Step-by-Step Test:**

**A. Policy Generation**
1. Enter policy: "Travel expenses: max $500 per booking, $2000/week, only Airbnb, Uber, Expedia"
2. Click "Generate Policy"
3. ✅ Progress bar shows: User Input ✅ → AI Generate (active)
4. Wait for GPT-4 (~3-5 seconds)
5. ✅ Policy card appears
6. ✅ Progress bar shows: Input ✅ → AI ✅
7. ✅ Intent approver section appears (purple gradient box)
8. Click "View JSON" on policy card
9. ✅ JSON shown with syntax highlighting
10. ✅ Can copy JSON to clipboard

**B. Passkey Approval**
1. ✅ "Approve with Passkey" button visible
2. Click "Approve with Passkey"
3. ✅ Modal appears with policy summary
4. ✅ Three duration options: 7 / 30 / 90 days
5. ✅ Default: 30 days selected
6. ✅ Expiry date shown: [30 days from now]
7. Select different durations:
   - Click "7 Days" → Expiry updates
   - Click "90 Days" → Expiry updates
   - Click "30 Days" → Back to 30
8. Click "Approve with Passkey"
9. ✅ Browser passkey prompt appears (Face ID / Touch ID / Windows Hello)
10. Complete biometric authentication
11. ✅ Modal closes
12. ✅ "Passkey Approved" badge appears (green)
13. ✅ Shows: "Valid until: [date]"
14. ✅ Progress bar shows: Input ✅ → AI ✅ → Approval ✅

**C. Processing Invoices**
1. Click "Start Processing"
2. ✅ Logs show: "🚀 Starting invoice processing..."
3. ✅ Logs show: "🔐 Using passkey approval (expires: [date])"
4. ✅ Logs show: "✅ Including passkey approval (valid until [date])"
5. ✅ Progress updates: Signing → Verification → Payment
6. Watch invoices update:
   - inv_001 (airbnb $300): ✅ PAID
   - inv_002 (expedia $700): ❌ DENIED (exceeds $500 limit)
   - inv_003 (uber $150): ✅ PAID
7. ✅ Final log: "🎉 Complete: 2 paid, 1 denied"
8. ✅ All progress steps marked complete

**D. Verify Receipts**
1. Click on inv_001 row
2. ✅ Opens receipt in new tab
3. ✅ Receipt shows:
   - `decision: "ALLOW"`
   - `intent_verified: true`
   - `intent_valid_until: "2025-12-05..."`
   - `intent_approved_at: "2025-11-05..."`
4. Repeat for inv_002 (denied):
   - ✅ Shows `decision: "DENY"`
   - ✅ Has intent fields (approval was valid, but amount exceeded)

**E. Stripe Verification**
1. Click "View Stripe Dashboard"
2. ✅ Opens https://dashboard.stripe.com/test/payments
3. ✅ See 3 PaymentIntents:
   - inv_001: succeeded (metadata: agentoauth_decision: "ALLOW")
   - inv_002: incomplete (metadata: status: "denied_by_policy")
   - inv_003: succeeded
4. ✅ All have receipt_id in metadata

---

### Test Scenario 2: Expired Intent Simulation

**Steps:**
1. Generate policy (as above)
2. Click "Approve with Passkey"
3. ✅ **Check "Simulate expired approval (for demo)"**
4. Select 30 days and approve
5. ✅ "Passkey Approved" badge shows with "⚠️ Expired - Demo" warning
6. Click "Start Processing"
7. ✅ Logs show: "⚠️ Simulating expired intent (for demo)"
8. ✅ Verifier calls return INTENT_EXPIRED
9. ✅ All 3 invoices DENIED
10. ✅ Denial reason: "User approval expired on [yesterday's date]"
11. Check Stripe dashboard:
    - ✅ All 3 PaymentIntents show "denied_by_policy"
    - ✅ Metadata includes deny_reason with expiry message

---

### Test Scenario 3: Without Passkey (v0.2 Fallback)

**Steps:**
1. Generate policy
2. **Skip passkey approval** - don't click "Approve with Passkey"
3. Click "Start Processing" directly
4. ✅ Logs show: "ℹ️ Running in basic mode (no passkey approval)"
5. ✅ Token created is act.v0.2 (check logs)
6. ✅ Processing continues normally
7. ✅ 2 paid, 1 denied (based on policy limits only)
8. Click receipt:
   - ✅ No `intent_verified` field
   - ✅ No `intent_valid_until` field

---

### Test Scenario 4: Passkey Cancelled/Failed

**Steps:**
1. Generate policy
2. Click "Approve with Passkey"
3. Modal opens
4. Click "Approve with Passkey" button
5. When passkey prompt appears, **click Cancel or Dismiss**
6. ✅ Error shown in modal: "User cancelled passkey approval"
7. ✅ Can retry or cancel
8. Click "Cancel" on modal
9. ✅ Returns to main screen
10. ✅ Can still process without passkey

---

### Test Scenario 5: Browser Without WebAuthn

**Test in:**
- Older Chrome < 90
- Or disable WebAuthn in DevTools

**Steps:**
1. Generate policy
2. Click "Approve with Passkey"
3. ✅ Modal shows "Passkey Not Supported"
4. ✅ Warning explains browser limitation
5. ✅ Suggests compatible browsers
6. ✅ "Continue Without Passkey" button visible
7. Click button
8. ✅ Returns to main screen
9. Can process in v0.2 mode

---

## 📦 Component 8: Intent Validator (Server-Side)

### Test: validateIntentBasic()

**Location:** `packages/verifier-api/src/intent/validator.ts`

**Test Script:**
```javascript
import { validateIntentBasic } from './packages/verifier-api/src/intent/validator.ts';
import { hashPolicy } from '@agentoauth/sdk';

const policy = { /* test policy */ };
const policyHash = hashPolicy(policy);

// Test 1: Valid intent
const validIntent = {
  type: 'webauthn.v0',
  challenge: policyHash,
  approved_at: new Date().toISOString(),
  valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  rp_id: 'localhost'
};

const result1 = validateIntentBasic(validIntent, policyHash);
console.log('Valid intent:', result1);
// ✅ Expected: { valid: true, expired: false, remainingDays: 30 }

// Test 2: Expired intent
const expiredIntent = {
  ...validIntent,
  valid_until: new Date(Date.now() - 1000).toISOString() // Yesterday
};

const result2 = validateIntentBasic(expiredIntent, policyHash);
console.log('Expired intent:', result2);
// ✅ Expected: { valid: false, expired: true, code: 'INTENT_EXPIRED' }

// Test 3: Wrong challenge
const wrongIntent = {
  ...validIntent,
  challenge: 'sha256:wronghash'
};

const result3 = validateIntentBasic(wrongIntent, policyHash);
console.log('Wrong challenge:', result3);
// ✅ Expected: { valid: false, code: 'INTENT_POLICY_MISMATCH' }
```

---

## 📦 Component 9: Receipt Intent Fields

### Test: Receipt Contains Intent Info

**After running intent E2E tests:**
```bash
# Get a receipt ID from test output
curl http://localhost:3000/receipts/receipt_abc123

# Or decode the receipt JWT manually
```

**Expected Receipt Payload (v0.3):**
```json
{
  "version": "receipt.v0.2",
  "id": "receipt_abc123",
  "policy_id": "pol_...",
  "decision": "ALLOW",
  "timestamp": 1730000000,
  "intent_verified": true,
  "intent_valid_until": "2025-12-05T19:30:00.000Z",
  "intent_approved_at": "2025-11-05T19:30:00.000Z"
}
```

**Expected Receipt Payload (v0.2 - no intent):**
```json
{
  "version": "receipt.v0.2",
  "id": "receipt_xyz789",
  "policy_id": "pol_...",
  "decision": "ALLOW",
  "timestamp": 1730000000
  // No intent fields
}
```

---

## 📦 Component 10: Integration Testing

### Full End-to-End Flow

**Setup:**
```bash
# Terminal 1: Start local verifier
cd packages/verifier-api
pnpm dev

# Terminal 2: Start UI
cd packages/langchain-invoice-demo/ui
pnpm dev
```

**Test Complete Flow:**

1. **Policy Creation**
   - Open http://localhost:3001
   - Enter custom policy description
   - Click "Generate Policy"
   - ✅ GPT-4 creates JSON
   - ✅ Policy card shows limits

2. **Passkey Approval**
   - Click "Approve with Passkey"
   - Select 30 days
   - Complete passkey ceremony
   - ✅ Intent created with correct expiry
   - ✅ Badge shows approval status

3. **Agent Processing**
   - Click "Start Processing"
   - ✅ 6-step progress bar updates
   - ✅ Logs stream in real-time
   - ✅ Token is act.v0.3 (check logs)

4. **Verification**
   - ✅ Each invoice sent to verifier
   - ✅ Intent validated (not expired)
   - ✅ Policy evaluated
   - ✅ Budget tracked

5. **Payment**
   - ✅ Stripe PaymentIntents created
   - ✅ Receipts stored with intent fields

6. **Receipt Validation**
   - Click any invoice
   - ✅ Receipt opens in new tab
   - ✅ Shows intent verification details
   - ✅ JWS signature valid

---

## 🧪 Regression Testing

### Ensure v0.2 Still Works

**Test 1: v0.2 Token Creation**
```bash
cd packages/examples
node issue-with-policy.js
# ✅ Should create act.v0.2 token
# ✅ No intent field
```

**Test 2: v0.2 Verification**
```bash
# Start verifier
cd packages/verifier-api && pnpm dev

# In another terminal
cd packages/examples
node verify-with-policy.js
# ✅ Should verify successfully
# ✅ No intent validation performed
```

**Test 3: v0.2 in UI**
```bash
# In UI:
1. Generate policy
2. Skip passkey approval
3. Start processing
# ✅ Works exactly as before
# ✅ No intent-related errors
```

**Test 4: Policy E2E Tests**
```bash
cd packages/examples
pnpm test-e2e
# ✅ All 5 tests should pass:
# - Basic verification
# - Policy evaluation
# - Budget tracking (4th request denied)
# - Merchant matching
# - Action validation
```

---

## 🔍 Error Case Testing

### 1. INTENT_EXPIRED

**Setup:**
```bash
# In UI, use "Simulate expired approval" checkbox
```

**Expected:**
- ✅ All invoices DENIED
- ✅ Error: "User approval expired on [date]"
- ✅ Code: "INTENT_EXPIRED"
- ✅ Stripe shows all as denied_by_policy

### 2. INTENT_POLICY_MISMATCH

**Setup:**
```javascript
// Manually create token with mismatched challenge
const intent = createMockIntent(policy, 30);
intent.challenge = 'sha256:wronghash'; // Tamper
```

**Expected:**
- ✅ Verification fails
- ✅ Error: "Intent challenge does not match policy hash"
- ✅ Code: "INTENT_POLICY_MISMATCH"

### 3. INTENT_INVALID

**Test Cases:**
- Invalid intent.type (not "webauthn.v0")
- Invalid base64url encoding
- Missing required fields
- Malformed client_data_json

**Expected:**
- ✅ All rejected with code: "INTENT_INVALID"

### 4. Browser Not Supported

**Setup:**
- Use old browser or disable WebAuthn

**Expected:**
- ✅ `isWebAuthnSupported()` returns false
- ✅ IntentApprover shows fallback UI
- ✅ Can continue without passkey

---

## 🌐 Browser Compatibility Testing

### Test Matrix

| Browser | Version | Test Result |
|---------|---------|-------------|
| Chrome | 120+ | ✅ Full passkey support |
| Safari | 17+ | ✅ Full passkey support (Face ID / Touch ID) |
| Edge | 120+ | ✅ Full passkey support (Windows Hello) |
| Firefox | 119+ | ✅ Full passkey support |
| Chrome | 89 | ⚠️ Should show fallback, use v0.2 |
| Safari | 15 | ⚠️ Should show fallback, use v0.2 |

**Test Each Browser:**
1. Open UI demo
2. Generate policy
3. Click "Approve with Passkey"
4. Verify passkey prompt appears (or fallback shown)
5. Complete flow
6. Check console for any errors

---

## 📊 Performance Testing

### SDK Bundle Size
```bash
cd packages/sdk-js
ls -lh dist/intent.js
# ✅ Should be < 5KB

du -sh dist/
# ✅ Total SDK should be < 100KB
```

### Verifier Latency

**Benchmark Script:**
```bash
# Test 100 verifications with intent
time for i in {1..100}; do
  curl -s -X POST http://localhost:3000/verify \
    -H "Content-Type: application/json" \
    -d '{"token":"YOUR_V0.3_TOKEN","audience":"merchant.example"}' \
    > /dev/null
done

# ✅ Target: < 200ms average (adds ~20ms for intent checks)
```

---

## 🎯 Acceptance Criteria Checklist

### SDK
- ✅ `requestIntent()` creates valid intent with time bounds
- ✅ `issueConsent()` creates v0.3 tokens when intent provided
- ✅ `isWebAuthnSupported()` detects browser capability
- ✅ Helper functions work correctly
- ✅ TypeScript compiles with DOM types
- ✅ ESM build includes intent.mjs

### Verifiers
- ✅ Local verifier validates intent structure
- ✅ Hosted verifier validates intent (Workers-compatible)
- ✅ Intent expiry enforced (no grace period)
- ✅ Policy hash binding verified
- ✅ Receipts include intent fields (v0.3 only)
- ✅ v0.2 tokens still work (backward compatible)
- ✅ Health endpoint advertises act.v0.3

### UI
- ✅ IntentApprover component renders correctly
- ✅ Duration selection works (7/30/90 days)
- ✅ Passkey ceremony triggers properly
- ✅ Error handling for cancelled/failed approvals
- ✅ Browser fallback shows when WebAuthn unavailable
- ✅ Expiry simulation works for demo
- ✅ Progress bar shows 6 steps
- ✅ Intent state persists correctly
- ✅ Reset clears intent state

### Integration
- ✅ Policy → Intent → Token → Verify → Payment flow works
- ✅ Intent passed from UI → API → Agent
- ✅ Verifier validates and includes in receipt
- ✅ Stripe metadata includes intent verification
- ✅ Logs show intent status clearly

### Testing
- ✅ E2E tests cover all scenarios
- ✅ CI workflow updated
- ✅ UI linting passes
- ✅ Documentation complete

---

## 🚨 Common Issues & Solutions

### Issue 1: "WebAuthn/Passkey not supported"
**Solution:** Use Chrome 90+, Safari 16+, or Firefox 119+

### Issue 2: Passkey prompt doesn't appear
**Solution:**
- Check browser console for errors
- Verify `window.PublicKeyCredential` is defined
- Try in incognito mode (no extensions)

### Issue 3: "Intent validation failed"
**Possible causes:**
- Intent expired (check valid_until)
- Challenge mismatch (policy was modified)
- Invalid base64url encoding

### Issue 4: v0.2 fallback not working
**Solution:**
- Check `isWebAuthnSupported()` returns false
- Verify IntentApprover shows fallback UI
- Ensure processing continues without intent

### Issue 5: Build errors with intent.ts
**Solution:**
- Verify tsconfig.json includes "DOM" in lib
- Check navigator/window typed as `any` where needed
- Run `pnpm install` to get latest types

---

## 📋 Quick Test Commands

```bash
# Build everything
pnpm install && pnpm build

# SDK tests
pnpm --filter @agentoauth/sdk test

# Intent E2E
cd packages/examples && pnpm test:intent

# UI lint
cd packages/langchain-invoice-demo/ui && pnpm run lint

# Full demo
cd packages/langchain-invoice-demo/ui && pnpm dev
# Then open http://localhost:3001
```

---

## ✅ Success Indicators

### When Everything Works:
1. ✅ SDK builds without errors
2. ✅ 18 SDK unit tests pass
3. ✅ 4 intent E2E tests pass
4. ✅ UI shows passkey approval option
5. ✅ Passkey prompt appears (supported browsers)
6. ✅ Intent validated by verifiers
7. ✅ Receipts include intent fields
8. ✅ Expired intents rejected
9. ✅ v0.2 tokens still work
10. ✅ No console errors in browser

---

## 🎉 Phase 2B Testing Complete!

**What to verify:**
- All 16 implementation tasks completed
- SDK, verifiers, UI all working
- Tests passing (SDK + E2E + UI)
- Documentation comprehensive
- Backward compatibility maintained

**Ready for:**
- Alpha user testing
- Production deployment
- Integration into real systems

