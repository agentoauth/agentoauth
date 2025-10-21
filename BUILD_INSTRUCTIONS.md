# Simplified Build Instructions

## The Issue

Complex build configurations were causing failures. I've simplified everything.

## New Simplified Build Process

### Step 1: Install pnpm and dependencies

```bash
cd /Users/prithvi/projects/agentoauth

# Install pnpm if you don't have it
npm install -g pnpm

# Install all dependencies
pnpm install
```

### Step 2: Build SDK (simplified)

```bash
cd packages/sdk-js

# Simple TypeScript compilation
pnpm build

# Or manually
npx tsc
```

This just runs the TypeScript compiler - no complex bundling.

### Step 3: Build Verifier API

```bash
cd ../verifier-api
pnpm build
```

### Step 4: Run the Demo

```bash
cd ../demo-agent-to-merchant
node merchant.js
```

## Even Simpler: Skip tsup Entirely

I've updated the SDK to use simple `tsc` compilation instead of the complex `tsup` bundler.

**New build command:**
```bash
cd packages/sdk-js
npx tsc
```

That's it! Just compiles TypeScript to JavaScript.

## Troubleshooting

### If `pnpm build` still fails

Try building manually with TypeScript directly:

```bash
cd packages/sdk-js

# Install TypeScript if needed
pnpm add -D typescript

# Compile
npx tsc

# Verify output
ls dist/
# Should see: index.js, index.d.ts, and other .js files
```

### If the demo still can't find the module

The workspace might not be linked correctly. Try:

```bash
# From project root
pnpm install --force

# Then build
cd packages/sdk-js && pnpm build
cd ../verifier-api && pnpm build
```

### Nuclear Option: Install Dependencies Directly in Demo

```bash
cd packages/demo-agent-to-merchant

# Install SDK from workspace
pnpm add ../sdk-js

# Or install dependencies it needs
pnpm add jose hono @hono/node-server chalk
```

## Verification

After building, verify:

```bash
# Check SDK built
ls packages/sdk-js/dist/index.js
# ✅ Should exist

# Check module can be imported
cd packages/demo-agent-to-merchant
node -e "require('../sdk-js/dist/index.js'); console.log('✅ SDK loads')"
# ✅ Should print: SDK loads
```

## Success Checklist

- [ ] `pnpm install` completed without errors
- [ ] `cd packages/sdk-js && pnpm build` completed
- [ ] `ls packages/sdk-js/dist/index.js` shows the file
- [ ] `cd packages/verifier-api && pnpm build` completed
- [ ] `cd packages/demo-agent-to-merchant && node merchant.js` starts server

If all checked: ✅ Ready to run!

## Quick Commands

```bash
# Complete setup
cd /Users/prithvi/projects/agentoauth && \
pnpm install && \
cd packages/sdk-js && pnpm build && \
cd ../verifier-api && pnpm build && \
cd ../demo-agent-to-merchant && \
node merchant.js
```

The simplified build should work much better!

