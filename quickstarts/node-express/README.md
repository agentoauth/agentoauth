# AgentOAuth + Express - 5 Minute Quickstart

Get from zero to verified agent-to-merchant flow in under 5 minutes!

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run the complete demo (starts all services and tests)
npm run demo

# Or run components individually:
npm run merchant  # Start merchant server
npm run agent     # Start agent server  
npm run test      # Run test suite
```

## 📋 What This Demonstrates

This quickstart shows the complete AgentOAuth flow with Express middleware:

### Agent Side (`agent.js`)
- **Automatic token signing** with `@agentoauth/agent-express`
- **Policy presets** for different use cases (payment, read-only, admin)
- **Zero-config key management** (auto-generates keys)
- **Request middleware** that signs all outgoing requests

### Merchant Side (`merchant.js`)
- **Token validation** with `@agentoauth/merchant-express`
- **Scope-based authorization** (payment, read, admin scopes)
- **Amount limit enforcement** 
- **Flexible middleware** (require auth, parse auth, scope-specific)

### Test Suite (`test.js`)
- **End-to-end flow testing**
- **Direct SDK usage examples**
- **Policy builder demonstrations**
- **Error handling validation**

## 🎯 Key Features Showcased

### 1. Express Middleware Magic

**Agent Side - Automatic Signing:**
```javascript
import { AgentAuth } from '@agentoauth/agent-express';

// Payment bot with $5000 limit
app.use('/payments', AgentAuth.payment({
  user: 'did:example:alice',
  agent: 'payment-bot-v1', 
  maxAmount: 5000
}));

// All requests to /payments/* get auto-signed tokens!
```

**Merchant Side - Smart Validation:**
```javascript
import { MerchantAuth } from '@agentoauth/merchant-express';

// Requires payment scope + validates amounts
app.post('/api/receive-payment', MerchantAuth.payment({ maxAmount: 10000 }), (req, res) => {
  // Token is already validated, payload available in req.agentoauth
  const { user, agent } = getUser(req);
  // Process payment...
});
```

### 2. Policy Presets

```javascript
import { buildPolicy } from '@agentoauth/sdk';

// Payment policy - $1000 limit, 1 hour expiry
const paymentPolicy = buildPolicy({ 
  preset: 'payment',
  limits: { amount: 1000, currency: 'USD' }
});

// Read-only policy - no amount limits, 24 hour expiry  
const readPolicy = buildPolicy({ preset: 'read' });

// Admin policy - restricted amount, 15 minute expiry
const adminPolicy = buildPolicy({ preset: 'admin' });
```

### 3. Ergonomic SDK Functions  

```javascript
import { issueConsent, verifyConsent, revokeConsent } from '@agentoauth/sdk';

// Issue with auto key generation
const { token, keyId, publicKey } = await issueConsent({
  user: 'did:example:alice',
  agent: 'payment-bot',
  scope: 'pay:merchant',
  limit: { amount: 1000, currency: 'USD' },
  expiresIn: '1h' // Human-friendly expiry
});

// Verify with clear error handling
const result = await verifyConsent(token, { publicKey });
if (!result.valid) {
  console.log(result.error.suggestion); // Helpful error messages
}

// Revoke by JTI
await revokeConsent(payload.jti);
```

## 📊 API Endpoints

### Agent Server (Port 3001)

| Endpoint | Method | Description | Auto-Signed |
|----------|---------|-------------|-------------|
| `/payments/send` | POST | Send payment to merchant | ✅ Payment scope |
| `/data/fetch` | GET | Fetch data from merchant | ✅ Read scope |
| `/custom/action` | POST | Custom action with policy | ✅ Custom scope |
| `/health` | GET | Agent health check | ❌ Public |

### Merchant Server (Port 3000)

| Endpoint | Method | Scope Required | Description |
|----------|---------|---------------|-------------|
| `/api/status` | GET | None (optional) | Public status, parses auth if present |
| `/api/receive-payment` | POST | `pay:merchant` | Process payment, validate amounts |
| `/api/data` | GET | `read:data` | Return data to authorized agents |
| `/api/admin/revoke` | POST | `admin:manage` | Admin token revocation |
| `/api/special` | GET | `read:special` OR `admin:manage` | Multi-scope endpoint |

## 🧪 Test Results

When you run `npm run demo`, you'll see:

```
🤖 Starting AgentOAuth Agent Server
🏪 Starting AgentOAuth Merchant Server
🧪 Testing AgentOAuth Express Flow

1️⃣ Testing Agent-to-Merchant Payment
✅ Payment successful!
   Transaction ID: txn_1699123456_abc123
   Amount: $250
   Authorized by: did:example:alice

2️⃣ Testing Data Access  
✅ Data access successful!
   Records: 3
   Accessed by: did:example:alice

3️⃣ Testing Direct Token Operations
✅ Token created
✅ Token verified
   User: did:example:test-user
   Scope: pay:merchant

4️⃣ Testing Policy Builder
✅ Policy builder working
   Payment policy: pay:merchant, $5000
   Read policy: read:data, expires in 24h

5️⃣ Testing Public API Status
✅ Status check successful

🎉 Test Flow Complete!
```

## 🔧 Manual Testing

### Test Payment Flow
```bash
# Start merchant server
npm run merchant

# In another terminal, start agent server
npm run agent

# In a third terminal, test the payment
curl -X POST http://localhost:3001/payments/send \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 150,
    "recipient": "merchant-123",
    "description": "Manual test payment"
  }'
```

### Test Direct Merchant API
```bash  
# This will fail - no token
curl http://localhost:3000/api/receive-payment

# This will work - public endpoint
curl http://localhost:3000/api/status
```

## 🎯 5-Minute Development Experience

This quickstart demonstrates the target developer experience:

1. **Install** - `npm install` (30 seconds)
2. **Run** - `npm run demo` (30 seconds)  
3. **Customize** - Edit agent/merchant logic (2 minutes)
4. **Test** - See end-to-end flow working (1 minute)
5. **Deploy** - Production-ready patterns (1 minute)

**Total: Under 5 minutes from zero to working agent-to-merchant authorization!**

## 📚 Next Steps

- **Production deployment**: Add key management, logging, metrics
- **Multiple agents**: Different agents with different policies
- **Advanced scopes**: Hierarchical scopes, dynamic policies
- **Key rotation**: Implement automatic key rotation
- **Rate limiting**: Add request rate limiting
- **Monitoring**: Add request/response logging

## 🔍 Code Structure

```
quickstarts/node-express/
├── package.json          # Dependencies and scripts
├── agent.js              # AI agent with auto-signing middleware
├── merchant.js           # Merchant with validation middleware  
├── test.js               # End-to-end test suite
└── README.md             # This file
```

## 💡 Key Learnings

This quickstart teaches:
- **Middleware patterns** for both agents and merchants
- **Policy-driven authorization** with safe defaults
- **Ergonomic SDK functions** that hide complexity
- **Comprehensive error handling** with helpful suggestions
- **Production-ready patterns** for real deployments

**Result: 5-minute DX from zero to verified agent-to-merchant flow! ✨**
