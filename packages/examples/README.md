# AgentOAuth Examples

Example scripts demonstrating AgentOAuth token operations.

## Available Examples

### issue-token.js

Creates a complete authorization token with all steps shown.

**Usage:**
```bash
node issue-token.js
```

**Output:**
- Generated keypair
- Authorization payload
- Signed token (JWS compact)
- Decoded header and payload
- Token summary

### verify-token.js

Verifies a token by checking signature and claims.

**Usage:**
```bash
# Interactive mode
node verify-token.js
# Paste token when prompted

# Piped input
echo "eyJhbGc..." | node verify-token.js

# With custom JWKS URL
JWKS_URL=https://auth.example/.well-known/jwks.json node verify-token.js

# With audience check
AUDIENCE=merchant.example node verify-token.js
```

**Output:**
- Decoded token
- Verification result (✅ valid or ❌ invalid)
- Error details if invalid

### issue-with-policy.js (NEW in v0.2)

Creates an authorization token with structured policy rules (pol.v0.2).

**Usage:**
```bash
node issue-with-policy.js
```

**Output:**
- Generated keypair
- Policy created with fluent API
- Policy JSON
- Token with policy embedded
- Policy hash for integrity verification

**Policy Features:**
- Actions whitelist
- Resource matching (merchants, APIs, etc.)
- Per-transaction limits
- Per-period budgets (hour/day/week/month)
- Time constraints (days, hours, timezone)

### verify-with-policy.js (NEW in v0.2)

Verifies a token with policy evaluation.

**Usage:**
```bash
node verify-with-policy.js [token]
```

**Output:**
- Basic token verification
- Policy embedded in token
- Instructions for full policy evaluation via Verifier API

## Environment Variables

- `JWKS_URL` - JWKS endpoint (default: http://localhost:3000/.well-known/jwks.json)
- `AUDIENCE` - Expected audience for validation (optional)

## Complete Workflow

```bash
# 1. Issue a token
node issue-token.js > token.txt

# 2. Extract just the token
cat token.txt | grep "eyJ" > just-token.txt

# 3. Verify it
cat just-token.txt | node verify-token.js
```

## With Verifier API

Start the verifier API first:

```bash
# Terminal 1
cd ../verifier-api
pnpm dev

# Terminal 2 
cd ../examples
node issue-token.js
node verify-token.js  # paste token when prompted
```

## License

MIT AND Apache-2.0

