# Debugging Guide: Using Error Logs

I've added comprehensive logging to both the **verifier API (server)** and **playground (client)** to help diagnose the "Failed to Fetch" 400 error.

## How to Use the Logs

### Step 1: Rebuild the Verifier API

Since we added new logging code, rebuild it:

```bash
cd /Users/prithvi/projects/agentoauth/packages/verifier-api
pnpm build
pnpm dev
```

### Step 2: Open Browser Console

1. Open the playground at http://localhost:8080
2. Press **F12** (or right-click → Inspect)
3. Go to the **Console** tab
4. Keep it open

### Step 3: Try Creating a Demo Token

Click "Create Demo Token" button and watch **both consoles**.

## What to Look For

### In Verifier API Terminal (Server Logs)

You'll see detailed logs like this:

#### ✅ Successful Request:
```
============================================================
📨 POST /demo/create-token
🕐 2025-10-21T12:34:56.789Z
📥 Received /demo/create-token request
✅ Keys available, kid: key-1234567890
📦 Request body: {
  "user": "did:example:alice",
  "agent": "demo-bot@playground",
  "scope": "pay:merchant",
  "limit": {
    "amount": 1000,
    "currency": "USD"
  },
  "aud": "merchant.example"
}
✅ All required fields present
📚 Importing SDK...
✅ SDK imported
🔐 Creating token with payload: { ... }
✅ Token created successfully
📤 Token preview: eyJhbGciOiJFZERTQSIsImtpZCI6ImtleS0xMj...
⏱️  Response time: 45ms
============================================================
```

#### ❌ Error - Keys Not Initialized:
```
❌ Keys not initialized
```
**Fix:** Restart the verifier API

#### ❌ Error - Missing Required Fields:
```
❌ Missing required fields. Received: {
  user: 'did:example:alice',
  agent: undefined,
  scope: 'pay:merchant'
}
```
**Fix:** Check the playground is sending all fields

#### ❌ Error - Cannot Import SDK:
```
📚 Importing SDK...
❌ Token creation error: Cannot find package '@agentoauth/sdk'
```
**Fix:** Build the SDK first: `cd packages/sdk-js && pnpm build`

#### ❌ Error - Invalid Payload:
```
✅ SDK imported
🔐 Creating token with payload: { ... }
❌ Token creation error: Invalid payload: /scope must match pattern
```
**Fix:** Payload doesn't match schema (check scope format)

### In Browser Console (Client Logs)

You'll see detailed logs like this:

#### ✅ Successful Request:
```
🚀 Creating demo token...
📡 API URL: http://localhost:3000
📦 Request body: {
  "user": "did:example:alice",
  "agent": "demo-bot@playground",
  "scope": "pay:merchant",
  "limit": { "amount": 1000, "currency": "USD" },
  "aud": "merchant.example"
}
📤 Sending request to: http://localhost:3000/demo/create-token
📥 Response status: 200 OK
📥 Response headers: {
  "content-type": "application/json; charset=UTF-8",
  "access-control-allow-origin": "*"
}
📦 Response body: {
  "token": "eyJhbGc...",
  "payload": { ... },
  "kid": "key-1234567890"
}
✅ Token received, length: 389
🔑 Key ID: key-1234567890
```

#### ❌ Error - Network Failure:
```
📤 Sending request to: http://localhost:3000/demo/create-token
❌ Network error: TypeError: Failed to fetch
Error details: {
  message: "Failed to fetch",
  name: "TypeError"
}
```

**Possible Causes:**
- API is not running (check terminal)
- Wrong API URL (should be http://localhost:3000)
- CORS issue (unlikely with our setup)
- Firewall blocking localhost

#### ❌ Error - 400 Bad Request:
```
📥 Response status: 400 Bad Request
📦 Response body: {
  "error": "Missing required fields: user, agent, scope",
  "received": { "user": true, "agent": false, "scope": true }
}
❌ No token in response: { error: "...", received: {...} }
```

**Fix:** The request body is malformed (check what's being sent)

#### ❌ Error - 500 Server Error:
```
📥 Response status: 500 Internal Server Error
📦 Response body: {
  "error": "Cannot find package '@agentoauth/sdk'",
  "details": "Error: Cannot find package ...",
  "type": "Error"
}
```

**Fix:** SDK not built - run `pnpm build` in root

## Common Error Patterns

### Pattern 1: "Failed to fetch" (Network Error)

**Browser Console:**
```
❌ Network error: TypeError: Failed to fetch
```

**Server Console:**
```
(no logs - request never reached server)
```

**Diagnosis:** API is not running or unreachable

**Fix:**
```bash
# Check if API is running
curl http://localhost:3000/health

# If not, start it
cd packages/verifier-api && pnpm dev
```

### Pattern 2: 400 Bad Request (Missing Fields)

**Browser Console:**
```
📥 Response status: 400 Bad Request
📦 Response body: { "error": "Missing required fields..." }
```

**Server Console:**
```
❌ Missing required fields. Received: { user: ..., agent: undefined, ... }
```

**Diagnosis:** Request body is malformed

**Fix:** Check what the browser is sending (look at "Request body" in console)

### Pattern 3: 500 Server Error (SDK Not Found)

**Browser Console:**
```
📥 Response status: 500 Internal Server Error
📦 Response body: { "error": "Cannot find package '@agentoauth/sdk'" }
```

**Server Console:**
```
📚 Importing SDK...
❌ Token creation error: Cannot find package '@agentoauth/sdk'
Stack trace: Error: Cannot find package '@agentoauth/sdk'
    at ...
```

**Diagnosis:** SDK not built

**Fix:**
```bash
cd /Users/prithvi/projects/agentoauth
pnpm build
# Restart verifier API
cd packages/verifier-api && pnpm dev
```

### Pattern 4: 500 Server Error (Invalid Payload)

**Server Console:**
```
✅ SDK imported
🔐 Creating token with payload: { ... }
❌ Token creation error: Invalid payload: /scope must match pattern ^[a-zA-Z0-9_:.\\-]+$
```

**Diagnosis:** Payload doesn't match JSON schema (e.g., invalid scope format)

**Fix:** Check the payload being created - scope must match pattern

## Debug Checklist

Run through this when you get an error:

### Client Side (Browser)
- [ ] Open browser console (F12)
- [ ] Look for "🚀 Creating demo token..." log
- [ ] Check "📡 API URL" - is it correct?
- [ ] Check "📦 Request body" - all fields present?
- [ ] Check "📥 Response status" - what code?
- [ ] Check "📦 Response body" - what error?

### Server Side (Terminal)
- [ ] Verifier API is running
- [ ] See "📨 POST /demo/create-token" log
- [ ] See "📥 Received /demo/create-token request"
- [ ] Any ❌ errors in the logs?
- [ ] Check error message and stack trace

## Quick Diagnostic Commands

```bash
# 1. Check if API is running
curl http://localhost:3000/health

# 2. Check if JWKS works
curl http://localhost:3000/.well-known/jwks.json

# 3. Try creating token via cURL (bypasses browser)
curl -X POST http://localhost:3000/demo/create-token \
  -H "Content-Type: application/json" \
  -d '{
    "user": "did:example:alice",
    "agent": "test-bot",
    "scope": "pay:merchant"
  }' | jq

# 4. Check SDK is built
ls -la packages/sdk-js/dist/

# 5. Check verifier API is built
ls -la packages/verifier-api/dist/
```

## Still Getting 400 Error?

If you still get a 400 error after checking everything:

1. **Copy the exact logs** from both browser console and server terminal
2. **Note the exact error message** from the response body
3. **Check the request body** that was sent
4. **Verify all three fields** are present: user, agent, scope

The enhanced logging will tell you **exactly** what went wrong and where!

## Example Debug Session

Here's what a typical debug session looks like:

```
# Terminal 1: Start API with logs
cd packages/verifier-api
pnpm dev

# Browser: Open http://localhost:8080 with console (F12)
# Click "Create Demo Token"

# Terminal 1 shows:
============================================================
📨 POST /demo/create-token
📥 Received /demo/create-token request
❌ Token creation error: Cannot find package '@agentoauth/sdk'
============================================================

# Diagnosis: SDK not built!

# Terminal 2: Build SDK
cd packages/sdk-js
pnpm build

# Terminal 1: Restart API (Ctrl+C, then)
pnpm dev

# Browser: Try again
# ✅ Success! Token created
```

The logs make it obvious what's wrong! 🎯

