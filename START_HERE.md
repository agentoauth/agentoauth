# 🚀 START HERE - Quick Setup

## The Problem
`pnpm dev` wasn't actually starting an HTTP server. I've fixed this!

## The Fix - Follow These Steps

### Step 1: Install the New Dependency

```bash
cd /Users/prithvi/projects/agentoauth/packages/verifier-api
pnpm install
```

This installs `@hono/node-server` which actually starts the HTTP server.

### Step 2: Start the Verifier API

```bash
cd /Users/prithvi/projects/agentoauth/packages/verifier-api
pnpm dev
```

You should now see:
```
🔑 Generating Ed25519 key pair...
✅ Generated Ed25519 key pair
   Key ID: key-1234567890
   Public key type: OKP
   Algorithm: EdDSA
🚀 AgentOAuth Verifier API starting on port 3000...
   JWKS: http://localhost:3000/.well-known/jwks.json
   Verify: POST http://localhost:3000/verify
   Demo: POST http://localhost:3000/demo/create-token
✅ Server listening on http://localhost:3000
```

### Step 3: Test It Works

In a **new terminal**:

```bash
curl http://localhost:3000/health
```

You should get:
```json
{"status":"ok","service":"agentoauth-verifier","version":"0.1.0","keyId":"key-..."}
```

✅ **If you see this, the server is running!**

### Step 4: Try the Playground

1. Keep the API running (don't close that terminal!)
2. Open http://localhost:8080 in your browser
3. Press F12 to open browser console
4. Click "Create Demo Token"
5. Watch the detailed logs in:
   - Browser console (client side)
   - Server terminal (server side)

## What Changed?

I added `@hono/node-server` which provides the actual HTTP server functionality for Hono in Node.js. Before, the code was just defining routes but never actually listening on a port!

## Quick Troubleshooting

### Port 3000 in use?

```bash
# Find what's using it
lsof -i :3000

# Or use a different port
PORT=3001 pnpm dev
```

### Still not working?

Check:
1. Did you run `pnpm install` in packages/verifier-api?
2. Is port 3000 available?
3. Any error messages in the terminal?

Post the error messages and I can help debug further!

