# Fix: "Error on creating demo token"

## Quick Fix (Most Common)

The demo token error usually happens because the SDK hasn't been built yet. Follow these steps:

### Step 1: Stop the Verifier API

If it's running, press `Ctrl+C` in the terminal where verifier-api is running.

### Step 2: Build Everything

```bash
cd /Users/prithvi/projects/agentoauth

# Install dependencies (if not done already)
pnpm install

# Build all packages (SDK must be built first!)
pnpm build
```

You should see output like:
```
packages/sdk-js:
- Building src/index.ts
- Built successfully

packages/verifier-api:
- Building src/index.ts
- Built successfully
```

### Step 3: Start Verifier API

```bash
cd packages/verifier-api
pnpm dev
```

You should see:
```
✅ Generated Ed25519 key pair
   Key ID: key-1234567890
🚀 AgentOAuth Verifier API running on port 3000
   JWKS: http://localhost:3000/.well-known/jwks.json
   Verify: POST http://localhost:3000/verify
   Demo: POST http://localhost:3000/demo/create-token
```

### Step 4: Try Demo Token Again

In the playground (http://localhost:8080), click "Create Demo Token" - it should work now!

## Alternative: Use the Startup Script

```bash
cd /Users/prithvi/projects/agentoauth

# Make script executable
chmod +x start-demo.sh

# Run it
./start-demo.sh
```

This will automatically:
1. ✅ Check pnpm is installed
2. ✅ Install dependencies
3. ✅ Build SDK
4. ✅ Build verifier API
5. ✅ Give you next steps

## Test Without Playground

If you want to verify the API works without the playground:

```bash
# Test 1: Health check
curl http://localhost:3000/health

# Should return:
# {"status":"ok","service":"agentoauth-verifier","version":"0.1.0","keyId":"key-..."}

# Test 2: Create demo token
curl -X POST http://localhost:3000/demo/create-token \
  -H "Content-Type: application/json" \
  -d '{
    "user": "did:example:alice",
    "agent": "test-bot",
    "scope": "pay:merchant"
  }'

# Should return:
# {"token":"eyJhbGc...","payload":{...},"kid":"key-..."}
```

If the cURL works, the API is fine. The issue is in the playground connection.

## Still Not Working?

### Check 1: Is the SDK built?

```bash
ls -la packages/sdk-js/dist/
```

You should see:
- `index.js` (CommonJS)
- `index.mjs` (ES Module)  
- `index.d.ts` (TypeScript definitions)

If the `dist/` folder is missing or empty:
```bash
cd packages/sdk-js
pnpm build
```

### Check 2: Check verifier API logs

When you click "Create Demo Token", look at the verifier API terminal. You should see:
- Nothing (success) or
- Error message like "Token creation error: ..."

If you see an error, it will tell you what's wrong.

### Check 3: Browser Console Errors

1. Open browser (where playground is)
2. Press F12 to open DevTools
3. Go to Console tab
4. Click "Create Demo Token"
5. Look for error messages in red

Common errors:
- **"Failed to fetch"**: API isn't running or wrong URL
- **"CORS error"**: CORS issue (shouldn't happen, but restart API)
- **"Failed to create demo token: <message>"**: Check the message

### Check 4: Network Tab

1. Open browser DevTools (F12)
2. Go to Network tab
3. Click "Create Demo Token"
4. Look for `/demo/create-token` request
5. Click it to see:
   - Request: What was sent
   - Response: What came back (error message will be here)

## Complete Reset (Nuclear Option)

If nothing else works:

```bash
cd /Users/prithvi/projects/agentoauth

# Delete everything
rm -rf node_modules
rm -rf packages/*/node_modules
rm -rf packages/*/dist

# Reinstall from scratch
pnpm install
pnpm build

# Start verifier API
cd packages/verifier-api
pnpm dev
```

## What This Error Means

The "Error on creating demo token" happens when:

1. **SDK not built** → Verifier API can't import `@agentoauth/sdk`
2. **Dependencies not installed** → Missing `jose` or `ajv` packages
3. **Keys not initialized** → Server didn't generate Ed25519 keypair
4. **Network issue** → Playground can't reach API (wrong URL, CORS, etc.)

The most common cause is #1 - forgetting to build the SDK before starting the API.

## Success Checklist

After following the fix, you should:
- [ ] See "✅ Generated Ed25519 key pair" in verifier API terminal
- [ ] `curl http://localhost:3000/health` returns JSON
- [ ] Browser console has no errors
- [ ] "Create Demo Token" button creates a token
- [ ] Token appears in the textarea
- [ ] "Verify Token" shows ✅ Valid

If all checked, the demo is working correctly! 🎉

