# Getting Started with AgentOAuth

## You Got a Module Not Found Error?

That's expected! The demo needs dependencies installed first. Here's how to fix it:

## Quick Fix (3 Commands)

```bash
# 1. Go to project root
cd /Users/prithvi/projects/agentoauth

# 2. Run setup script
bash setup-demo.sh

# 3. Run the demo
cd packages/demo-agent-to-merchant
bash demo.sh
```

## What the Setup Script Does

1. Installs all dependencies using npm
2. Builds the SDK (required for the demo)
3. Builds the verifier API
4. Tells you how to run the demo

**Time:** ~30-60 seconds

## After Setup

Once setup is complete, you can:

### Run the Automated Demo

```bash
cd packages/demo-agent-to-merchant
bash demo.sh
```

Shows 3 scenarios:
- ✅ Successful $150 payment
- ❌ $2000 payment exceeding $1000 limit
- ✅ Different user payment

### Run Manually

**Terminal 1: Start Merchant**
```bash
cd packages/demo-agent-to-merchant
node merchant.js
```

**Terminal 2: Make Payments**
```bash
cd packages/demo-agent-to-merchant

# Success
node agent.js --amount 150

# Failure  
node agent.js --amount 2000 --limit 1000

# Custom
node agent.js --user did:example:bob --amount 100
```

## Alternative: Manual Setup

If the setup script doesn't work:

```bash
# 1. Install dependencies
cd /Users/prithvi/projects/agentoauth
npm install

# 2. Build SDK
cd packages/sdk-js
npm install
npm run build

# 3. Build verifier API
cd ../verifier-api
npm install
npm run build

# 4. Run demo
cd ../demo-agent-to-merchant
bash demo.sh
```

## Verify Everything Works

```bash
# Check SDK is built
ls packages/sdk-js/dist/index.js
# Should exist

# Check node can find modules
cd packages/demo-agent-to-merchant
node -e "import('@agentoauth/sdk').then(() => console.log('✅ SDK found'))"
# Should print: ✅ SDK found
```

## Using pnpm Instead

If you want to use pnpm (faster):

```bash
# Fix npm permissions first
sudo chown -R $(whoami) ~/.npm

# Install pnpm
npm install -g pnpm

# Then use pnpm
cd /Users/prithvi/projects/agentoauth
pnpm install
pnpm build
```

## Quick Reference

| Command | What it does |
|---------|--------------|
| `bash setup-demo.sh` | One-time setup |
| `bash demo.sh` | Run automated demo |
| `node merchant.js` | Start merchant server |
| `node agent.js --amount 150` | Make payment |
| `npm run build` | Rebuild packages |
| `npm test` | Run tests |

## Next Steps

1. ✅ Run `bash setup-demo.sh`
2. ✅ Run `bash demo.sh` 
3. ✅ See the magic happen!

See [RUN_DEMO.md](RUN_DEMO.md) for more details.

