# Simplified Build Process

## The Problem

The complex tsup build was failing. I've simplified it to use plain TypeScript compiler.

## New Build Process

### For SDK (packages/sdk-js)

**Old (complex):**
```bash
tsup src/index.ts --format cjs,esm --dts --clean
```

**New (simple):**
```bash
tsc                      # Compile TypeScript to CommonJS
node scripts/build-esm.js  # Create ESM wrappers
```

**Benefits:**
- ✅ Uses standard TypeScript compiler
- ✅ No complex bundler configuration
- ✅ Works reliably
- ✅ Easier to debug

### Alternative: Skip the Build

If builds are still problematic, you can run the demo directly from TypeScript:

```bash
# Install tsx (TypeScript executor)
pnpm add -D tsx

# Run directly
tsx packages/demo-agent-to-merchant/agent.ts
```

## Quick Fix Commands

### Option 1: Use Simplified Build

```bash
cd /Users/prithvi/projects/agentoauth

# Install dependencies
pnpm install

# Build with new simple process
cd packages/sdk-js
pnpm build

# Should work now!
```

### Option 2: Use TypeScript Directly (No Build)

Convert scripts to TypeScript and run with tsx:

```bash
cd packages/demo-agent-to-merchant

# Install tsx
pnpm add -D tsx

# Run directly (no build needed)
npx tsx agent.js
npx tsx merchant.js
```

### Option 3: Use Plain JavaScript (No TypeScript)

Make the SDK pure JavaScript (no compilation needed):

```bash
# Copy src to dist as-is
cp -r packages/sdk-js/src packages/sdk-js/dist
```

## Recommended: Use the Simplified Build

I've updated the SDK to use a simpler build process. Try this:

```bash
cd /Users/prithvi/projects/agentoauth

# Clean start
rm -rf packages/sdk-js/dist

# Install
pnpm install

# Build SDK (now simpler)
cd packages/sdk-js
pnpm build

# Should see:
# - Compiling TypeScript...
# - Created index.mjs
# - Created index.d.mts
# - ✅ ESM build complete
```

## If Still Failing

Share the exact error and I'll create an even simpler version!

