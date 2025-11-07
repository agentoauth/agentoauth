# SDK Peer Dependencies Fix

## Problem Solved

External projects importing `@agentoauth/sdk` were experiencing runtime errors in serverless environments because:

1. The `jose` library (which uses `TextEncoder`) was being bundled into user deployments
2. Some serverless platforms don't provide `TextEncoder` in bundled contexts
3. Bundlers were including `jose` and `ajv` instead of treating them as external

## Solution Implemented

Converted `jose` and `ajv` from regular `dependencies` to `peerDependencies` in `packages/sdk-js/package.json`.

### Changes Made

**File: `packages/sdk-js/package.json`**
- Moved `jose` and `ajv` to `peerDependencies`
- Kept them in `devDependencies` so SDK tests and builds still work
- This tells bundlers: "Don't bundle these - the user will provide them"

**File: `packages/sdk-js/README.md`**
- Updated installation instructions to include `jose` and `ajv`
- Added note explaining they are peer dependencies

## Impact

### For SDK Users

**Before:**
```bash
npm install @agentoauth/sdk
```

**After:**
```bash
npm install @agentoauth/sdk jose ajv
```

Users will see a peer dependency warning if they install the SDK without `jose` and `ajv`, prompting them to install these separately.

### For Bundlers

Bundlers will now treat `jose` and `ajv` as external dependencies, avoiding:
- TextEncoder bundling issues
- Increased bundle sizes
- Runtime errors in serverless environments

### For Existing Projects

No breaking changes - projects that already have `jose` installed (like our examples and verifiers) continue to work without modification.

## Testing

✅ SDK builds successfully  
✅ SDK tests pass (18 tests)  
✅ Monorepo build works  
✅ Existing examples verified to have `jose` and `ajv` installed  

## Why This Works

**peerDependencies** is the standard npm/pnpm mechanism for:
- Libraries used across multiple environments (Node.js, browsers, serverless)
- Avoiding duplicate installations of shared dependencies
- Letting users control which versions they use
- Preventing bundlers from including transitive dependencies

This is a common pattern in the ecosystem (e.g., React libraries use React as a peer dependency).

## Migration Guide for Users

If you're already using the SDK, no action needed if you have `jose` installed.

If you're installing the SDK for the first time:

```bash
# Install SDK with peer dependencies
npm install @agentoauth/sdk jose ajv

# Or with pnpm
pnpm add @agentoauth/sdk jose ajv

# Or with yarn
yarn add @agentoauth/sdk jose ajv
```

Your bundler will now correctly externalize `jose` and `ajv`, avoiding runtime errors in serverless deployments.

