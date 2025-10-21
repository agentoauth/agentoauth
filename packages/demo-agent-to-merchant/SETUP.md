# Setup Instructions for Agent-to-Merchant Demo

## Quick Fix for Module Not Found Error

The error you're seeing means dependencies aren't installed yet. Here's how to fix it:

## Option 1: Use npm (If pnpm has issues)

```bash
cd /Users/prithvi/projects/agentoauth

# Install dependencies using npm
npm install

# Build the SDK (required for demo)
cd packages/sdk-js
npm run build

# Go to demo directory
cd ../demo-agent-to-merchant

# Install demo dependencies
npm install

# Build is done, now run the demo!
bash demo.sh
```

## Option 2: Fix pnpm permissions (Recommended)

```bash
# Fix npm cache permissions (run this once)
sudo chown -R $(whoami) ~/.npm

# Then install pnpm
npm install -g pnpm

# Install and build
cd /Users/prithvi/projects/agentoauth
pnpm install
pnpm build

# Run the demo
cd packages/demo-agent-to-merchant
bash demo.sh
```

## Option 3: Quick Test Without Full Install

If you just want to test the scripts work, I can create a standalone version:

```bash
cd /Users/prithvi/projects/agentoauth/packages/demo-agent-to-merchant

# Install just this package's dependencies
npm install @agentoauth/sdk@npm:@agentoauth/sdk hono @hono/node-server chalk jose

# But you'll still need the SDK built first
cd ../sdk-js
npm install
npm run build

# Then back to demo
cd ../demo-agent-to-merchant
node merchant.js
```

## Simplest Path (Recommended)

```bash
# 1. From project root
cd /Users/prithvi/projects/agentoauth

# 2. Install with npm (works without pnpm)
npm install

# 3. Build SDK
npm run build

# 4. Go to demo
cd packages/demo-agent-to-merchant

# 5. Run it!
bash demo.sh
```

## What Each Step Does

1. **npm install** - Installs all dependencies for all packages
2. **npm run build** - Builds the SDK (required for the demo to work)
3. **bash demo.sh** - Runs the automated demo

## Verify It Worked

After setup, you should be able to run:

```bash
# Test merchant server
node merchant.js
# Should see: "✅ Merchant server listening on http://localhost:4000"

# In another terminal, test agent
node agent.js --amount 150
# Should see: "✅ Payment Successful!"
```

## Still Having Issues?

The most common issue is that the **SDK isn't built yet**. The demo imports `@agentoauth/sdk`, which needs to be compiled first.

**Quick check:**
```bash
ls /Users/prithvi/projects/agentoauth/packages/sdk-js/dist/
```

Should see: `index.js`, `index.mjs`, `index.d.ts`

If not, build it:
```bash
cd /Users/prithvi/projects/agentoauth/packages/sdk-js
npm install
npm run build
```

Then try running the demo again!

