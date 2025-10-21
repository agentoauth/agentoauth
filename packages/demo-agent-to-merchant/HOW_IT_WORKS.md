# How the Agent-to-Merchant Demo Works

## Overview

This demo shows a real-world use case: an AI payment agent making authorized payments to a merchant.

## The Players

1. **User (Alice)** - Wants her bot to pay a merchant
2. **Agent (payment-bot)** - AI that executes the payment
3. **Merchant** - Receives payment and verifies authorization

## The Flow (Step-by-Step)

### Step 1: User Grants Authorization

**What happens:** User Alice says: "Payment bot, you can spend up to $1000 USD on my behalf for merchant payments."

**In code (agent.js):**
```javascript
const payload = {
  ver: '0.1',
  user: 'did:example:alice',        // Who granted permission
  agent: 'payment-bot@demo',         // Who can act
  scope: 'pay:merchant',             // What they can do
  limit: {                           // How much they can spend
    amount: 1000,
    currency: 'USD'
  },
  aud: 'merchant-demo',              // Who can receive this
  exp: Math.floor(Date.now() / 1000) + 3600,  // When it expires
  nonce: crypto.randomUUID()         // Prevent reuse
};
```

### Step 2: Agent Creates Proof

**What happens:** The agent creates a cryptographically signed token proving this authorization.

**In code (agent.js):**
```javascript
import { request } from '@agentoauth/sdk';

// Sign the payload with Alice's private key
const token = await request(payload, alicePrivateKey, 'key-alice-001');

// Result: eyJhbGciOiJFZERTQSI...
// This is a JWS token (header.payload.signature)
```

**Why it matters:** The signature proves:
- Alice actually authorized this
- The authorization hasn't been tampered with
- The limits and scope are exactly what Alice approved

### Step 3: Agent Makes Payment Request

**What happens:** The agent sends a payment request to the merchant with the authorization token.

**In code (agent.js):**
```javascript
const response = await fetch('http://localhost:4000/api/payment', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    authToken: token,           // The signed authorization
    amount: 150,                // What we want to pay
    currency: 'USD',            // In what currency
    description: 'Freelance work'
  })
});
```

### Step 4: Merchant Verifies the Token

**What happens:** The merchant checks if this payment is actually authorized.

**In code (merchant.js):**
```javascript
import { decode } from '@agentoauth/sdk';

// Step 4a: Decode the token
const { header, payload } = decode(authToken);

// Step 4b: Verify expiration
const now = Math.floor(Date.now() / 1000);
if (payload.exp < now) {
  return { error: 'Token expired', code: 'EXPIRED' };
}

// Step 4c: Check scope
if (payload.scope !== 'pay:merchant') {
  return { error: 'Invalid scope', code: 'INVALID_SCOPE' };
}

// Step 4d: Check amount limit
if (requestedAmount > payload.limit.amount) {
  return { error: 'Amount exceeds limit', code: 'LIMIT_EXCEEDED' };
}

// Step 4e: Check currency
if (requestedCurrency !== payload.limit.currency) {
  return { error: 'Currency mismatch', code: 'CURRENCY_MISMATCH' };
}

// All checks passed! ✅
```

### Step 5: Payment Processing

**What happens:** All checks passed, so the merchant processes the payment.

**In code (merchant.js):**
```javascript
const transaction = {
  transactionId: `tx_${Date.now()}_${randomHex()}`,
  authorizedBy: payload.user,      // did:example:alice
  agent: payload.agent,            // payment-bot@demo
  amount: 150,
  currency: 'USD',
  timestamp: new Date().toISOString()
};

// Save transaction
transactions.push(transaction);

// Return confirmation
return {
  success: true,
  transactionId: transaction.transactionId,
  authorizedBy: payload.user,
  amount: 150,
  currency: 'USD',
  remainingLimit: 1000 - 150  // $850 remaining
};
```

### Step 6: Agent Receives Confirmation

**What happens:** The agent gets confirmation and displays it to Alice.

**Output:**
```
✅ Payment Successful!

   Transaction ID: tx_1729512345_a1b2c3d4
   Authorized by: did:example:alice
   Agent: payment-bot@demo
   Amount: $150.00 USD
   Timestamp: 2025-10-21T12:34:56.789Z
   Remaining limit: $850.00
```

---

## Security: Why This Works

### 1. Cryptographic Proof

The token signature proves:
- ✅ Alice actually signed this authorization
- ✅ Nobody can forge Alice's signature
- ✅ Any tampering invalidates the signature

**Example attack attempt:**
```javascript
// Attacker tries to change amount from $150 to $10,000
// They modify the payload but can't recreate Alice's signature
// Merchant verification fails: ❌ Invalid signature
```

### 2. Limit Enforcement

The merchant enforces the limit Alice set:
- ✅ $150 payment: Approved (within $1000 limit)
- ❌ $2000 payment: Rejected (exceeds $1000 limit)

**Example:**
```javascript
if (amount > payload.limit.amount) {
  // REJECT - can't exceed authorization
  return { error: 'Exceeds limit', code: 'LIMIT_EXCEEDED' };
}
```

### 3. Expiration

Tokens expire automatically:
- ✅ Within 1 hour: Valid
- ❌ After 1 hour: Expired

**Example:**
```javascript
if (payload.exp < Math.floor(Date.now() / 1000)) {
  // REJECT - authorization expired
  return { error: 'Expired', code: 'EXPIRED' };
}
```

### 4. Scope Restriction

Token only works for its designated purpose:
- ✅ Scope "pay:merchant": Can make payments
- ❌ Scope "read:data": Cannot make payments

**Example:**
```javascript
if (payload.scope !== 'pay:merchant') {
  // REJECT - wrong permission type
  return { error: 'Invalid scope', code: 'INVALID_SCOPE' };
}
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USER AUTHORIZES                                              │
│    "Payment bot can spend up to $1000 USD"                      │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. AGENT CREATES TOKEN                                          │
│    payload = { user, agent, scope, limit, exp, nonce }          │
│    signature = sign(payload, alice-private-key)                 │
│    token = base64(header) + "." + base64(payload) + "." + sig   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. AGENT SENDS TO MERCHANT                                      │
│    POST /api/payment                                            │
│    { authToken: token, amount: 150, currency: "USD" }           │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. MERCHANT VERIFIES                                            │
│    ✓ Signature valid? (using Alice's public key)                │
│    ✓ Not expired? (check exp > now)                             │
│    ✓ Correct scope? (scope === "pay:merchant")                  │
│    ✓ Within limit? (150 <= 1000)                                │
│    ✓ Currency matches? (USD === USD)                            │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. MERCHANT PROCESSES                                           │
│    All checks passed → Process payment                          │
│    Return: { success: true, transactionId: "tx_..." }           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Concepts

### Authorization vs Authentication

- **Authentication**: "Who are you?" (identity)
- **Authorization**: "What are you allowed to do?" (permissions)

AgentOAuth handles **authorization**:
- Not just "Is this Alice?" 
- But "Did Alice authorize this specific $150 payment?"

### Bearer Token

The token is a "bearer credential":
- Whoever presents it can use it
- Like a signed check or voucher
- That's why expiration is important!

### Scope

OAuth-style scopes define what the token allows:
- `pay:merchant` - Can make merchant payments
- `read:data` - Can read data
- `write:calendar` - Can write to calendar

One token = one scope (keep it simple).

### Limit

The `limit` object constrains the authorization:
```javascript
limit: {
  amount: 1000,    // Maximum amount
  currency: 'USD'  // In this currency
}
```

The merchant enforces this: $150 ≤ $1000 ✅

### Audience

The `aud` (audience) field targets the token:
```javascript
aud: 'merchant-demo'  // Only for this merchant
```

Prevents token from being used at a different merchant.

---

## Why This Matters

### Problem Without AgentOAuth

**Scenario:** Alice's payment bot needs to pay a merchant.

**Without AgentOAuth:**
- ❌ Give bot Alice's password? (Dangerous!)
- ❌ Give bot unlimited access? (Risky!)
- ❌ Trust the bot? (No verification!)
- ❌ Audit trail? (Who authorized what?)

### Solution With AgentOAuth

**With AgentOAuth:**
- ✅ Bot has limited authorization ($1000 max)
- ✅ Cryptographic proof Alice authorized it
- ✅ Merchant can verify independently
- ✅ Complete audit trail
- ✅ Automatic expiration
- ✅ Cannot exceed authorization

---

## Real-World Applications

### 1. Freelance Platforms

Platform bots pay freelancers automatically with user authorization:
```
User authorizes: "Pay up to $5000/month to freelancers"
→ Bot can make payments automatically
→ Each payment has proof of authorization
→ Platform has complete audit trail
```

### 2. Bill Payment Services

Bots pay recurring bills with authorization:
```
User authorizes: "Pay electric bill up to $200"
→ Bot pays when bill arrives
→ Won't pay if bill exceeds $200
→ User stays in control
```

### 3. Shopping Assistants

Shopping bots make purchases with limits:
```
User authorizes: "Buy groceries up to $300"
→ Bot can purchase items
→ Won't exceed budget
→ User can audit all purchases
```

### 4. Business Automation

Corporate agents handle transactions:
```
Manager authorizes: "Approve travel expenses up to $2000"
→ Agent can approve within limit
→ Manager has proof of all approvals
→ Finance has complete audit trail
```

---

## Code Walkthrough

### agent.js - Key Parts

```javascript
// 1. Generate/load keys
const { privateJWK, kid } = await getKeys();

// 2. Create authorization payload
const payload = {
  ver: '0.1',
  user: 'did:example:alice',
  agent: 'payment-bot@demo',
  scope: 'pay:merchant',
  limit: { amount: 1000, currency: 'USD' },
  exp: Math.floor(Date.now() / 1000) + 3600,
  nonce: crypto.randomUUID()
};

// 3. Sign it
const token = await request(payload, privateJWK, kid);

// 4. Send to merchant
await fetch(`${merchantUrl}/api/payment`, {
  method: 'POST',
  body: JSON.stringify({ authToken: token, amount, currency })
});
```

### merchant.js - Key Parts

```javascript
// 1. Receive payment request
const { authToken, amount, currency } = await c.req.json();

// 2. Verify token
const { payload } = decode(authToken);

// 3. Check authorization
if (payload.exp < now) return error('EXPIRED');
if (payload.scope !== 'pay:merchant') return error('INVALID_SCOPE');
if (amount > payload.limit.amount) return error('LIMIT_EXCEEDED');
if (currency !== payload.limit.currency) return error('CURRENCY_MISMATCH');

// 4. Process payment
const transactionId = createTransaction(payload, amount, currency);

// 5. Return confirmation
return { success: true, transactionId, authorizedBy: payload.user };
```

---

## Extending the Demo

### Add Real Signature Verification

Replace `decode()` with `verify()` for production:

```javascript
import { verify } from '@agentoauth/sdk';

const result = await verify(
  authToken,
  'https://auth.example/.well-known/jwks.json',
  { audience: 'merchant-demo' }
);

if (!result.valid) {
  return { error: result.error, code: result.code };
}
```

### Add Nonce Tracking (Replay Protection)

```javascript
const usedNonces = new Set();

if (usedNonces.has(payload.nonce)) {
  return { error: 'Replay attack detected', code: 'REPLAY' };
}

usedNonces.add(payload.nonce);
setTimeout(() => usedNonces.delete(payload.nonce), 3600000); // 1h
```

### Add Database Persistence

```javascript
// Replace in-memory storage
await db.transactions.create({
  id: transactionId,
  authorizedBy: payload.user,
  agent: payload.agent,
  amount,
  currency,
  tokenHash,
  createdAt: new Date()
});
```

### Add Web Dashboard

Create a simple UI showing:
- Payment authorization form
- Transaction history table
- Real-time payment status
- Authorization limits remaining

---

## Security Features Demonstrated

### 1. Non-Repudiation

Alice cannot deny she authorized the payment:
- ✅ Her private key signed the token
- ✅ Only she has that key
- ✅ Signature proves authorization

### 2. Tamper Detection

Any modification is detected:
```
Original: amount: 150
Tampered: amount: 1500
Result: ❌ Signature invalid (tampering detected)
```

### 3. Time Limits

Authorization expires automatically:
```
Hour 0: ✅ Token valid
Hour 1: ❌ Token expired
```

No manual revocation needed!

### 4. Scope Isolation

Token only works for its designated purpose:
```
Token scope: "pay:merchant"
✅ Can: Make merchant payments
❌ Cannot: Read calendar, send emails, etc.
```

### 5. Amount Limits

Merchant enforces spending limits:
```
Authorized: $1000
Request $150: ✅ Approved
Request $2000: ❌ Rejected
```

---

## Production Considerations

### What the Demo Simplifies

For clarity, the demo:
- Uses `decode()` instead of `verify()` (skips signature verification)
- Stores keys in filesystem (should use key management service)
- Uses in-memory storage (should use database)
- No nonce tracking (should track to prevent replay)
- Single merchant (should support multiple)

### For Production, Add:

1. **Real signature verification** with JWKS
2. **Key management service** (AWS KMS, Vault, etc.)
3. **Database persistence** (PostgreSQL, MongoDB)
4. **Nonce tracking** (Redis with TTL)
5. **Rate limiting** (prevent abuse)
6. **Monitoring & alerting** (track verification failures)
7. **HTTPS/TLS** (encrypt all communication)
8. **Webhook callbacks** (notify user of payments)

---

## Learning Objectives

After running this demo, you should understand:

✅ **How AgentOAuth tokens are created** (payload + signature)
✅ **What information tokens contain** (user, agent, scope, limit, exp)
✅ **How verification works** (decode, check exp, check limits)
✅ **Why signatures matter** (tamper-proof authorization)
✅ **How limits are enforced** (merchant validates before processing)
✅ **Why expiration is important** (limits exposure window)
✅ **How audit trails work** (log user, agent, amount, time)

---

## Next Steps

1. **Run the demo**: `bash demo.sh`
2. **Try different amounts**: Test limit enforcement
3. **Read the code**: Understand token creation and verification
4. **Extend it**: Add signature verification, nonce tracking, database
5. **Build your own**: Use AgentOAuth in your application!

The demo code is simple and readable - perfect for learning how AgentOAuth works in practice!

