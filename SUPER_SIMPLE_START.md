# Super Simple Start - 2 Commands Total

## The Absolute Simplest Way to Run AgentOAuth

### Step 1: Install pnpm (if needed)

```bash
npm install -g pnpm
```

### Step 2: Run Everything

```bash
cd /Users/prithvi/projects/agentoauth
pnpm setup && pnpm demo
```

**That's it!** The demo will run automatically.

---

## What These Commands Do

### `pnpm setup`
- Installs all dependencies
- Builds the SDK
- Builds the verifier API
- **Time:** ~1 minute (first time only)

### `pnpm demo`
- Ensures packages are built
- Runs the automated agent-to-merchant demo
- Shows 3 scenarios (success, failure, different user)
- **Time:** ~10 seconds

---

## Expected Output

```
🎬 AgentOAuth Demo: Agent-to-Merchant Payment
==============================================

1️⃣ Starting merchant server...
✅ Merchant server listening on http://localhost:4000

2️⃣ Scenario 1: Successful Payment
   User Alice authorizes payment bot for up to $1000
   Agent requests $150 payment

✅ Payment Successful!
   Transaction ID: tx_1729512345_a1b2c3d4
   Authorized by: did:example:alice
   Amount: $150.00 USD
   Remaining limit: $850.00

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3️⃣ Scenario 2: Amount Exceeds Limit
   Agent attempts $2000 payment with $1000 limit

❌ Payment Failed!
   Error: Amount exceeds authorized limit
   Code: LIMIT_EXCEEDED

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Demo complete!

Key takeaways:
  ✅ Agents create cryptographically signed authorization tokens
  ✅ Merchants verify signatures and check authorization limits
  ✅ Payments are rejected if they exceed authorized limits
  ✅ Full audit trail with user, agent, and transaction details
```

---

## All From Root Directory

**No more `cd` into different directories!** All commands run from `/Users/prithvi/projects/agentoauth`:

```bash
pnpm setup        # Setup everything
pnpm demo         # Run demo
pnpm test         # Run tests
pnpm build        # Rebuild if needed
pnpm demo:merchant # Start merchant (manual)
pnpm demo:agent   # Run agent (manual)
```

---

## Troubleshooting

### "pnpm: command not found"

Install it:
```bash
npm install -g pnpm
```

### Build errors

The simplified build should work. If not:
```bash
cd /Users/prithvi/projects/agentoauth
rm -rf node_modules packages/*/node_modules packages/*/dist
pnpm setup
```

### Demo can't find modules

Make sure build completed:
```bash
ls packages/sdk-js/dist/index.js
# Should exist

# If not, rebuild
pnpm build
```

---

## That's Really It!

Two commands from the root directory:

```bash
pnpm setup && pnpm demo
```

Everything else is automatic! 🎉

