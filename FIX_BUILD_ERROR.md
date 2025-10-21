# Fix: pnpm Build Error

## The Error

```
ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @agentoauth/sdk@0.1.0 build: `tsup src/index.ts --format cjs,esm --dts --clean`
```

This means the SDK build failed. Here's how to fix it:

## Solution: Install Dependencies First

The error happens because you're trying to build before installing dependencies.

### Step-by-Step Fix

```bash
cd /Users/prithvi/projects/agentoauth

# Step 1: Install pnpm (if you haven't)
npm install -g pnpm

# Step 2: Install ALL dependencies first (this is what's missing!)
pnpm install

# Step 3: Now build
pnpm -r build
```

## Why This Happens

When you run `pnpm -r build` without running `pnpm install` first:
- ❌ `tsup` is not installed (it's a dev dependency)
- ❌ `typescript` is not installed
- ❌ Other build tools are missing

After `pnpm install`:
- ✅ All dependencies are installed
- ✅ `tsup` is available
- ✅ Build works

## Complete Setup Commands

Copy and paste this entire block:

```bash
# 1. Install pnpm globally
npm install -g pnpm

# 2. Go to project root
cd /Users/prithvi/projects/agentoauth

# 3. Install dependencies (IMPORTANT!)
pnpm install

# 4. Build all packages
pnpm -r build

# 5. Verify build succeeded
ls packages/sdk-js/dist/index.js && echo "✅ SDK built successfully"
ls packages/verifier-api/dist/index.js && echo "✅ Verifier API built successfully"

# 6. Run the demo
cd packages/demo-agent-to-merchant
bash demo.sh
```

## Expected Output

### After `pnpm install`:

```
Packages: +300 (approximate)
+++++++++++++++++++++
Packages are hard linked from the content-addressable store to the virtual store.
  Content-addressable store is at: /Users/prithvi/Library/pnpm/store/v3
  Virtual store is at:             node_modules/.pnpm

dependencies:
+ @agentoauth/sdk workspace:*
...

Done in 30s
```

### After `pnpm -r build`:

```
packages/spec:
> @agentoauth/spec@0.1.0 build
> echo 'No build needed for spec'

packages/sdk-js:
> @agentoauth/sdk@0.1.0 build
> tsup src/index.ts --format cjs,esm --dts --clean

CLI Building entry: src/index.ts
CLI Building entry: src/index.ts
✓ Built in 1.2s

packages/verifier-api:
> @agentoauth/verifier-api@0.1.0 build
> tsup src/index.ts --format esm --clean

CLI Building entry: src/index.ts
✓ Built in 800ms

packages/playground:
> @agentoauth/playground@0.1.0 build
> echo 'No build needed for static site'

packages/demo-agent-to-merchant:
> @agentoauth/demo-agent-to-merchant@0.1.0 build
> echo 'No build needed for demo'
```

All packages should build successfully!

## Still Getting Errors?

If you still get build errors after `pnpm install`, please share:

1. **The complete error message** (scroll up to see the full output)
2. **Your Node.js version**: `node --version`
3. **Your pnpm version**: `pnpm --version`

Common issues:

### Node.js version too old

```bash
node --version
# Should be v18.0.0 or higher

# If lower, update Node.js:
# - Download from nodejs.org
# - Or use nvm: nvm install 18
```

### pnpm cache issues

```bash
# Clear pnpm cache
pnpm store prune

# Reinstall
rm -rf node_modules packages/*/node_modules
pnpm install
pnpm -r build
```

### TypeScript errors in code

If you see actual TypeScript compilation errors (not missing dependencies), share them and I can help fix the code.

## Quick Test

After setup, test if everything works:

```bash
# Test SDK
cd packages/sdk-js
pnpm test
# Should show: ✓ 26 tests passing

# Test demo
cd ../demo-agent-to-merchant  
node merchant.js
# Should show: ✅ Merchant server listening
```

## TL;DR - The Fix

**You skipped this step:**
```bash
pnpm install
```

**Do this:**
```bash
cd /Users/prithvi/projects/agentoauth
pnpm install    # ← This installs tsup and other build tools
pnpm -r build   # ← Now this will work
```

That's it! 🎉

