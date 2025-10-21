# Sanity Check - Full Test Run

Run this complete suite to verify everything works:

## Full Sanity Run

```bash
cd /Users/prithvi/projects/agentoauth

# Clean start
rm -rf node_modules packages/*/node_modules packages/*/dist

# Install all dependencies
pnpm install

# Build all packages
pnpm -r build

# Run all tests
pnpm -r test
```

## Expected Results

### ✅ pnpm install
```
Progress: resolved X, reused Y, downloaded Z
Packages: +N
++++++++++++++++++
Done in Xs
```

### ✅ pnpm -r build
```
packages/sdk-js:
> @agentoauth/sdk@0.1.0 build
> tsup src/index.ts --format cjs,esm --dts --clean
CLI Building entry: src/index.ts
...
Build success

packages/verifier-api:
> @agentoauth/verifier-api@0.1.0 build
> tsup src/index.ts --format esm --clean
...
Build success
```

### ✅ pnpm -r test
```
packages/spec:
No tests for spec

packages/sdk-js:
> @agentoauth/sdk@0.1.0 test
> vitest run

 ✓ src/index.test.ts (18 tests) 450ms
   ✓ AgentOAuth SDK (18 tests)
     ✓ Token Creation (request) (6 tests)
     ✓ Token Verification (verify) (10 tests)
     ✓ Payload Validation (2 tests)

 Test Files  1 passed (1)
      Tests  18 passed (18)

packages/verifier-api:
No tests configured

packages/playground:
No tests for playground
```

## Common Issues

### Issue: "command not found: pnpm"
```bash
npm install -g pnpm
```

### Issue: Build fails with "Cannot find module '@agentoauth/sdk'"
This means the SDK hasn't been built yet. Build order matters:
```bash
cd packages/sdk-js && pnpm build
cd ../verifier-api && pnpm build
```

### Issue: Tests fail with "global.fetch is not a function"
The tests mock fetch. Make sure you're using Node.js 18+ or install `node-fetch` polyfill.

### Issue: TypeScript errors during build
```bash
# Check TypeScript version
pnpm -r exec tsc --version  # Should be 5.3.3+

# Reinstall if needed
rm -rf node_modules packages/*/node_modules
pnpm install
```

## Quick Verification

After the full suite passes, do a quick manual test:

```bash
# Terminal 1: Start API
cd packages/verifier-api
pnpm dev

# Terminal 2: Test it
curl http://localhost:3000/health
# Should return: {"status":"ok",...}

curl -X POST http://localhost:3000/demo/create-token \
  -H "Content-Type: application/json" \
  -d '{"user":"did:example:alice","agent":"test","scope":"pay:merchant"}'
# Should return: {"token":"eyJ...","payload":{...},"kid":"key-..."}
```

## Success Criteria

All of these should pass:
- [x] `pnpm install` - No errors
- [x] `pnpm -r build` - All packages build successfully
- [x] `pnpm -r test` - 18 tests pass in sdk-js
- [x] `pnpm -r lint` - No linting errors
- [x] Verifier API starts on port 3000
- [x] Health endpoint returns 200 OK
- [x] Demo token creation works

If all pass: ✅ **Project is production-ready!**

## Performance Benchmarks

Expected times on modern hardware:
- Install: ~30-60 seconds
- Build: ~5-10 seconds
- Tests: ~1-2 seconds
- Total: < 2 minutes

## CI Simulation

To simulate what CI will run:

```bash
#!/bin/bash
set -e  # Exit on any error

echo "🔍 Installing dependencies..."
pnpm install

echo "🔨 Building packages..."
pnpm -r build

echo "🧪 Running tests..."
pnpm -r test

echo "📝 Linting code..."
pnpm -r lint

echo "✅ All checks passed!"
```

Save as `ci-local.sh`, make executable, and run:
```bash
chmod +x ci-local.sh
./ci-local.sh
```

