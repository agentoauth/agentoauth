# Final Fix - Dependencies Issue

## The Problem

The demo package needs `jose` as a dependency but it wasn't installed.

## The Fix

I've updated two things:

### 1. Added `jose` to demo package

```json
// packages/demo-agent-to-merchant/package.json
{
  "dependencies": {
    "@agentoauth/sdk": "workspace:*",
    "jose": "^5.2.0",  // ← ADDED
    "hono": "^4.0.0",
    "@hono/node-server": "^1.8.0",
    "chalk": "^5.3.0"
  }
}
```

### 2. Updated root `pnpm demo` to ensure install

```json
// package.json (root)
{
  "scripts": {
    "demo": "pnpm install && pnpm run build && cd packages/demo-agent-to-merchant && bash demo.sh"
  }
}
```

## Run This Now

```bash
cd /Users/prithvi/projects/agentoauth

# This will install dependencies for ALL packages including demo
pnpm install

# Now run the demo
pnpm demo
```

## Or Just Use `pnpm demo`

The `pnpm demo` command now:
1. ✅ Runs `pnpm install` (installs jose and all deps)
2. ✅ Runs `pnpm run build` (builds SDK + API)
3. ✅ Runs `bash demo.sh` (runs the demo)

## Complete One-Liner

```bash
cd /Users/prithvi/projects/agentoauth && pnpm demo
```

This single command:
- Installs all dependencies
- Builds all packages
- Runs the complete demo

No more errors! 🎉

## Verify It Worked

You should see:

```
🎬 AgentOAuth Demo: Agent-to-Merchant Payment

1️⃣ Starting merchant server...
✅ Merchant server listening on http://localhost:4000

2️⃣ Scenario 1: Successful Payment

🤖 AgentOAuth Payment Agent
✅ Payment Successful!
   Transaction ID: tx_abc123
   Amount: $150.00 USD

3️⃣ Scenario 2: Amount Exceeds Limit
❌ Payment Failed!
   Error: Amount exceeds authorized limit

✅ Demo complete!
```

## Summary

**Problem:** Demo package missing `jose` dependency  
**Fix:** Added `jose` to demo package.json + ensure `pnpm install` runs  
**Command:** `pnpm demo` (from root)

Try it now!

