# Troubleshooting Guide

## "Error on creating demo token"

This error typically occurs when the SDK hasn't been built or dependencies aren't properly installed.

### Solution 1: Build Everything First

```bash
# From project root
cd /Users/prithvi/projects/agentoauth

# Install all dependencies
pnpm install

# Build SDK (required for verifier-api to work)
pnpm build

# Now start the verifier API
cd packages/verifier-api
pnpm dev
```

**Why this happens:** The verifier-api imports `@agentoauth/sdk`, which must be built first to create the `dist/` folder.

### Solution 2: Check for Specific Error Messages

Open browser console (F12) when clicking "Create Demo Token" and check for:

#### Error: "Cannot find module '@agentoauth/sdk'"
```bash
# Build the SDK first
cd packages/sdk-js
pnpm build
```

#### Error: "Server keys not initialized"
- Restart the verifier API
- Check that you see "✅ Generated Ed25519 key pair" in the console

#### Error: "Missing required fields"
- This means the request body is missing user, agent, or scope
- Check the playground is sending the correct data

### Solution 3: Manual Test

Test the API directly with cURL:

```bash
# 1. Check if API is running
curl http://localhost:3000/health

# Expected response:
# {"status":"ok","service":"agentoauth-verifier","version":"0.1.0","keyId":"key-..."}

# 2. Try creating a token via cURL
curl -X POST http://localhost:3000/demo/create-token \
  -H "Content-Type: application/json" \
  -d '{
    "user": "did:example:alice",
    "agent": "test-bot",
    "scope": "pay:merchant"
  }'
```

If cURL works but playground doesn't:
- Check CORS (should be enabled)
- Check browser console for network errors
- Verify API URL is `http://localhost:3000` (not https)

### Solution 4: Complete Clean Rebuild

```bash
# From project root
cd /Users/prithvi/projects/agentoauth

# Clean everything
rm -rf node_modules packages/*/node_modules packages/*/dist

# Reinstall and rebuild
pnpm install
pnpm build

# Start verifier API
cd packages/verifier-api
pnpm dev
```

## Common Issues

### Port Already in Use

**Error:** `EADDRINUSE: address already in use :::3000`

**Solution:**
```bash
# Find process using port 3000
lsof -i :3000

# Kill it
kill -9 <PID>

# Or use a different port
PORT=3001 pnpm dev
```

### pnpm Not Found

**Error:** `command not found: pnpm`

**Solution:**
```bash
npm install -g pnpm
```

### TypeScript Errors During Build

**Error:** Type errors in packages/sdk-js or packages/verifier-api

**Solution:**
```bash
# Check TypeScript version
cd packages/sdk-js
pnpm exec tsc --version

# Should be 5.3.3 or higher
# If not, reinstall dependencies
pnpm install
```

### Playground Can't Connect to API

**Symptoms:**
- "Failed to create demo token: Failed to fetch"
- Network error in browser console

**Solution:**
1. Verify API is running: `curl http://localhost:3000/health`
2. Check API URL in playground is correct (http://localhost:3000)
3. Check for CORS errors in browser console
4. Make sure you're not using HTTPS (should be HTTP for local dev)

### SDK Import Error in Verifier API

**Error in terminal:**
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@agentoauth/sdk'
```

**Solution:**
```bash
# Build SDK first
cd /Users/prithvi/projects/agentoauth/packages/sdk-js
pnpm build

# Verify dist folder was created
ls -la dist/

# Should see: index.js, index.mjs, index.d.ts

# Restart verifier API
cd ../verifier-api
pnpm dev
```

## Debugging Checklist

Run through this checklist:

- [ ] pnpm is installed (`pnpm --version`)
- [ ] Dependencies installed (`node_modules` exists in root and packages)
- [ ] SDK built (`packages/sdk-js/dist` folder exists)
- [ ] Verifier API running (`curl http://localhost:3000/health` works)
- [ ] Browser console has no errors (F12 → Console tab)
- [ ] Correct API URL in playground (`http://localhost:3000`)
- [ ] No CORS errors in browser
- [ ] Port 3000 is not already in use

## Getting Detailed Error Information

### From Verifier API Terminal

Look for error messages like:
```
Token creation error: <error message>
```

### From Browser Console

1. Open browser DevTools (F12)
2. Go to Console tab
3. Click "Create Demo Token"
4. Look for red error messages
5. If you see "Failed to fetch", check Network tab

### From Network Tab (Browser)

1. Open browser DevTools (F12)
2. Go to Network tab
3. Click "Create Demo Token"
4. Look for the `/demo/create-token` request
5. Click it and check:
   - Status code (should be 200)
   - Response body (shows actual error)
   - Request payload (shows what was sent)

## Still Having Issues?

If none of these solutions work:

1. **Capture the exact error:**
   ```bash
   # Terminal output from verifier API
   cd packages/verifier-api
   pnpm dev 2>&1 | tee verifier-error.log
   ```

2. **Browser console errors:**
   - Open DevTools (F12)
   - Console tab → copy all red errors
   - Network tab → check failed requests

3. **System info:**
   ```bash
   node --version    # Should be 18+
   pnpm --version    # Should be 8+
   which pnpm
   pwd              # Current directory
   ```

4. **Check file structure:**
   ```bash
   cd /Users/prithvi/projects/agentoauth
   tree -L 3 -I node_modules
   ```

Include all this information when asking for help!

