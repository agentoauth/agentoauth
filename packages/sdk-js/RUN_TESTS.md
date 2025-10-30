# Running SDK Tests

## Comprehensive Unit Tests

I've created comprehensive unit tests for the AgentOAuth SDK covering all the scenarios you requested:

### Test Coverage

1. **✅ Valid token → `valid: true`**
   - Creates and verifies a properly signed token
   - Checks all payload fields are preserved

2. **❌ Expired token → `EXPIRED`**
   - Token with `exp` in the past
   - Verifies error code is `EXPIRED`

3. **❌ Audience mismatch → `INVALID_AUDIENCE`**
   - Token with `aud: "merchant-a.example"`
   - Verified with `audience: "merchant-b.example"`
   - Confirms error code is `INVALID_AUDIENCE`

4. **❌ Tampered payload → `INVALID_SIGNATURE`**
   - Token with modified amount (9999999 instead of 1000)
   - Signature no longer matches
   - Returns `INVALID_SIGNATURE` error code

### Additional Tests

- Clock skew tolerance (±60s)
- Invalid version rejection
- Payload validation (scope format, currency format, nonce length)
- Malformed token handling
- Missing required fields
- Matching audience acceptance

## Running the Tests

### Option 1: Using pnpm (recommended)

```bash
cd /Users/prithvi/projects/agentoauth/packages/sdk-js
pnpm test
```

### Option 2: Using npm

```bash
cd /Users/prithvi/projects/agentoauth/packages/sdk-js
npm test
```

### Option 3: Watch mode (for development)

```bash
cd /Users/prithvi/projects/agentoauth/packages/sdk-js
pnpm test:watch
# or
npm run test:watch
```

## Expected Output

You should see output like:

```
✓ AgentOAuth SDK > Token Creation (request) > should create a valid token
✓ AgentOAuth SDK > Token Verification (verify) > should verify a valid token → valid: true
✓ AgentOAuth SDK > Token Verification (verify) > should reject expired token → EXPIRED
✓ AgentOAuth SDK > Token Verification (verify) > should reject token with audience mismatch → INVALID_AUDIENCE
✓ AgentOAuth SDK > Token Verification (verify) > should reject tampered token → INVALID_SIGNATURE

Test Files  1 passed (1)
     Tests  18 passed (18)
```

## Test Structure

All tests are in `/packages/sdk-js/src/index.test.ts`:

- **Token Creation**: 6 tests for payload validation
- **Token Verification**: 10 tests for signature, expiry, audience, tampering
- **Payload Validation**: 2 additional validation tests

## CI Integration

These tests run automatically in GitHub Actions CI on every push and PR.

## Troubleshooting

### "pnpm: command not found"

Install pnpm:
```bash
npm install -g pnpm
```

### Tests fail with network errors

The tests mock the JWKS endpoint using `global.fetch`, so no actual network calls are made.

### Need to update tests?

Edit `/packages/sdk-js/src/index.test.ts` and re-run the tests.

