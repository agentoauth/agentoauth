# Quick Debug Reference Card

## Getting 400 Error? Follow These Steps:

### 1️⃣ Check Server Is Running
```bash
curl http://localhost:3000/health
```
✅ Should return JSON with "status":"ok"  
❌ Connection refused? → Start API: `cd packages/verifier-api && pnpm dev`

### 2️⃣ Check SDK Is Built
```bash
ls packages/sdk-js/dist/
```
✅ Should see: `index.js`, `index.mjs`, `index.d.ts`  
❌ Directory empty? → Build: `cd packages/sdk-js && pnpm build`

### 3️⃣ Open Browser Console (F12)

Click "Create Demo Token" and check logs:

**Look for:** 
- 📡 API URL (should be `http://localhost:3000`)
- 📥 Response status (tells you the error code)
- 📦 Response body (shows the actual error)

### 4️⃣ Check Server Terminal

**Look for:**
- ✅ "Generated Ed25519 key pair" on startup
- 📨 "POST /demo/create-token" when you click button
- ❌ Any error messages with details

## Common Errors & Fixes

| Error | Fix |
|-------|-----|
| `Failed to fetch` | API not running → `cd packages/verifier-api && pnpm dev` |
| `Cannot find package '@agentoauth/sdk'` | SDK not built → `pnpm build` from root |
| `Keys not initialized` | Restart API |
| `Missing required fields` | Check request body in browser console |
| `Connection refused` | Wrong port or API not started |

## Emergency Reset

```bash
cd /Users/prithvi/projects/agentoauth
pnpm install
pnpm build
cd packages/verifier-api
pnpm dev
```

## Test Without Browser

```bash
# This should work if API is running correctly
curl -X POST http://localhost:3000/demo/create-token \
  -H "Content-Type: application/json" \
  -d '{"user":"did:example:alice","agent":"test-bot","scope":"pay:merchant"}'
```

✅ Returns JSON with "token" field → API works, browser issue  
❌ Returns error → Check error message in response

## Where to Look

1. **Browser Console (F12)** → Client-side errors, network issues
2. **Server Terminal** → Server-side errors, SDK issues, validation errors
3. **Network Tab (F12)** → See actual HTTP request/response

## Need More Details?

See `DEBUG_LOGS_GUIDE.md` for comprehensive debugging info.

