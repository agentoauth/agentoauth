# Demo Scenarios - Detailed Walkthrough

## Overview

This document provides detailed walkthroughs of different scenarios demonstrating AgentOAuth in action.

---

## Scenario 1: Successful Payment Flow

### Context
Alice wants her AI payment assistant to pay a freelance developer $150 for completed work. She has authorized the bot to spend up to $1000 USD on her behalf.

### Steps

**Step 1: Alice Authorizes the Payment Bot**

In a real app, this would be a UI flow. For the demo:
```bash
# The agent.js script simulates this authorization
node agent.js --user "did:example:alice" \
              --amount 150 \
              --limit 1000
```

**Step 2: Agent Creates Authorization Token**

The payment bot creates an AgentOAuth token:

```json
{
  "ver": "0.1",
  "user": "did:example:alice",
  "agent": "payment-bot@demo",
  "scope": "pay:merchant",
  "limit": {
    "amount": 1000,
    "currency": "USD"
  },
  "aud": "merchant-demo",
  "exp": 1729516345,
  "nonce": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

The token is signed with Alice's private key, creating a JWS:
```
eyJhbGciOiJFZERTQSIsImtpZCI6ImFnZW50LWtleS0xNzI5NTEyMzQ1IiwidHlwIjoiSldUIn0.
eyJ2ZXIiOiIwLjEiLCJ1c2VyIjoiZGlkOmV4YW1wbGU6YWxpY2UiLCJhZ2VudCI6InBheW1lbn...
3a5d8f2e9c1b4e7a...
```

**Step 3: Agent Sends Payment Request**

```http
POST http://localhost:4000/api/payment
Content-Type: application/json

{
  "authToken": "eyJhbGc...",
  "amount": 150,
  "currency": "USD",
  "description": "Freelance development work"
}
```

**Step 4: Merchant Verifies Authorization**

The merchant server:
1. Decodes the token
2. Verifies the signature (simulated in demo)
3. Checks expiration: ✅ Not expired
4. Checks scope: ✅ Equals "pay:merchant"
5. Checks limit: ✅ 150 ≤ 1000
6. Checks currency: ✅ Matches USD

**Step 5: Payment Processed**

```json
{
  "success": true,
  "transactionId": "tx_1729512345_a1b2c3d4",
  "authorizedBy": "did:example:alice",
  "agent": "payment-bot@demo",
  "amount": 150,
  "currency": "USD",
  "timestamp": "2025-10-21T12:34:56.789Z",
  "remainingLimit": 850
}
```

**Result:** ✅ Payment successful! Alice's bot paid $150 with proof of authorization.

---

## Scenario 2: Amount Exceeds Limit

### Context
The payment bot attempts to pay $2000, but Alice only authorized $1000.

### Steps

**Step 1: Agent Creates Token (Limit: $1000)**

```bash
node agent.js --amount 2000 --limit 1000
```

**Step 2: Merchant Validates**

Merchant checks authorization:
- ✅ Signature valid
- ✅ Not expired
- ✅ Correct scope
- ❌ **Amount check fails**: 2000 > 1000

**Step 3: Payment Rejected**

```json
{
  "success": false,
  "error": "Amount exceeds authorized limit",
  "code": "LIMIT_EXCEEDED",
  "details": {
    "requested": 2000,
    "authorized": 1000
  }
}
```

**Result:** ❌ Payment rejected! The agent cannot exceed its authorization.

---

## Scenario 3: Expired Authorization

### Context
An agent tries to use an old authorization token that has expired.

### Steps

**Step 1: Create Expired Token**

Modify agent.js temporarily:
```javascript
exp: Math.floor(Date.now() / 1000) - 3600  // 1 hour ago
```

**Step 2: Merchant Validates**

Merchant checks:
- Token signature: ✅ Valid (was legitimately signed)
- Expiration check: ❌ **Expired 1 hour ago**

**Step 3: Payment Rejected**

```json
{
  "success": false,
  "error": "Token verification failed: Token expired",
  "code": "EXPIRED"
}
```

**Result:** ❌ Old authorizations don't work. Must get new authorization.

---

## Scenario 4: Wrong Scope

### Context
Agent has authorization for reading data but tries to make a payment.

### Steps

**Step 1: Create Token with Wrong Scope**

```bash
node agent.js --scope read:data --amount 100
```

Token payload:
```json
{
  "scope": "read:data",  // ❌ Wrong scope!
  ...
}
```

**Step 2: Merchant Validates**

Merchant checks:
- Signature: ✅ Valid
- Expiration: ✅ Not expired
- Scope: ❌ **Expected "pay:merchant", got "read:data"**

**Step 3: Payment Rejected**

```json
{
  "success": false,
  "error": "Invalid scope: expected 'pay:merchant', got 'read:data'",
  "code": "INVALID_SCOPE"
}
```

**Result:** ❌ Can't use a data-reading authorization for payments.

---

## Scenario 5: Currency Mismatch

### Context
Agent authorized for EUR but tries to pay in USD.

### Steps

**Step 1: Create USD Payment with EUR Authorization**

This would require modifying the agent to create mismatched currencies.

**Step 2: Merchant Validates**

Merchant checks:
- Currency: ❌ **Expected EUR, got USD**

**Step 3: Payment Rejected**

```json
{
  "success": false,
  "error": "Currency mismatch: expected EUR, got USD",
  "code": "CURRENCY_MISMATCH"
}
```

---

## Real-World Use Cases

### Use Case 1: Freelance Payments

**Scenario:** User authorizes a payment bot to pay freelancers up to $5000/month.

```javascript
// Monthly authorization
const token = await request({
  user: 'did:web:alice.example',
  agent: 'payroll-bot@company',
  scope: 'pay:freelancer',
  limit: { amount: 5000, currency: 'USD' },
  exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days
  nonce: crypto.randomUUID()
}, alicePrivateKey, 'key-alice-2025-10');
```

### Use Case 2: Automated Bill Payment

**Scenario:** User authorizes a bot to pay recurring bills.

```javascript
const token = await request({
  user: 'did:example:bob',
  agent: 'bill-pay-bot@service',
  scope: 'pay:bill',
  limit: { amount: 500, currency: 'USD' },
  aud: 'electric-company.example',
  exp: Math.floor(Date.now() / 1000) + 86400, // 24 hours
  nonce: crypto.randomUUID()
}, bobPrivateKey, 'key-bob-001');
```

### Use Case 3: Shopping Assistant

**Scenario:** User authorizes a shopping bot to make purchases up to $200.

```javascript
const token = await request({
  user: 'did:example:carol',
  agent: 'shopping-assistant@app',
  scope: 'purchase:product',
  limit: { amount: 200, currency: 'EUR' },
  exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  nonce: crypto.randomUUID()
}, carolPrivateKey, 'key-carol-123');
```

---

## Testing Different Scenarios

### Test Matrix

| Scenario | Amount | Limit | Scope | Expires | Expected Result |
|----------|--------|-------|-------|---------|----------------|
| Happy path | $150 | $1000 | pay:merchant | Future | ✅ Success |
| Exceed limit | $2000 | $1000 | pay:merchant | Future | ❌ LIMIT_EXCEEDED |
| Expired | $150 | $1000 | pay:merchant | Past | ❌ EXPIRED |
| Wrong scope | $150 | $1000 | read:data | Future | ❌ INVALID_SCOPE |
| Currency mismatch | 150 EUR | 1000 USD | pay:merchant | Future | ❌ CURRENCY_MISMATCH |
| Edge case | $1000 | $1000 | pay:merchant | Future | ✅ Success (exact limit) |
| Just over | $1001 | $1000 | pay:merchant | Future | ❌ LIMIT_EXCEEDED |

### Running Tests

```bash
# Happy path
node agent.js --amount 150 --limit 1000

# Exceed limit
node agent.js --amount 2000 --limit 1000

# Edge case (exactly at limit)
node agent.js --amount 1000 --limit 1000

# Just over limit
node agent.js --amount 1001 --limit 1000

# Different users
node agent.js --user "did:example:bob" --amount 100 --limit 500
node agent.js --user "did:example:carol" --amount 50 --limit 200
```

---

## Console Output Examples

### Successful Payment

```
🤖 AgentOAuth Payment Agent

📝 Payment Request:
   User: did:example:alice
   Agent: payment-bot@demo
   Amount: $150.00 USD
   Limit: $1000.00 USD
   Merchant: http://localhost:4000
   Scope: pay:merchant

🔑 Loading existing keypair...
   Key ID: agent-key-1729512345

🎫 Creating authorization token...
✅ Token created
   Preview: eyJhbGciOiJFZERTQSIsImtpZCI6ImFnZW50LWtleS...

💸 Sending payment to merchant...
   POST http://localhost:4000/api/payment

✅ Payment Successful!

   Transaction ID: tx_1729512345_a1b2c3d4
   Authorized by: did:example:alice
   Agent: payment-bot@demo
   Amount: $150.00 USD
   Timestamp: 2025-10-21T12:34:56.789Z
   Remaining limit: $850.00
```

### Failed Payment (Limit Exceeded)

```
🤖 AgentOAuth Payment Agent

📝 Payment Request:
   User: did:example:alice
   Agent: payment-bot@demo
   Amount: $2000.00 USD
   Limit: $1000.00 USD

...

❌ Payment Failed!

   Error: Amount exceeds authorized limit
   Code: LIMIT_EXCEEDED
   Details: {
     "requested": 2000,
     "authorized": 1000
   }
```

---

## Key Takeaways

1. **Cryptographic Proof**: Every payment has verifiable proof of authorization
2. **Limit Enforcement**: Merchants can safely enforce spending limits
3. **Automatic Expiration**: No risk of old authorizations being reused
4. **Clear Audit Trail**: Know exactly who authorized what, when
5. **Secure by Default**: Tampering or exceeding limits is automatically caught

This demo shows how AgentOAuth provides a neutral, secure way for AI agents to prove they have authorization to act on behalf of users!

