# Installing pnpm and Running AgentOAuth

## Quick Fix

You need pnpm to build and run this project. Here's how to install it:

### Step 1: Install pnpm

```bash
# Using npm (recommended)
npm install -g pnpm

# Or using Homebrew (if you have it)
brew install pnpm

# Or using curl
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

### Step 2: Verify pnpm is installed

```bash
pnpm --version
# Should show: 8.x.x or higher
```

### Step 3: Install dependencies and build

```bash
cd /Users/prithvi/projects/agentoauth

# Install all dependencies
pnpm install

# Build all packages
pnpm -r build
```

### Step 4: Run the demo

```bash
cd packages/demo-agent-to-merchant
bash demo.sh
```

## If npm install -g pnpm Fails

You might need to fix npm permissions first:

```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm

# Then install pnpm
npm install -g pnpm
```

## Alternative: Use npm Instead of pnpm

If you can't get pnpm working, you can use npm:

```bash
cd /Users/prithvi/projects/agentoauth

# Install
npm install

# Build
npm run build

# Run demo
cd packages/demo-agent-to-merchant
bash demo.sh
```

But pnpm is recommended for this project (faster and handles workspaces better).

## Expected Build Output

After `pnpm install && pnpm -r build`, you should see:

```
packages/sdk-js:
> @agentoauth/sdk@0.1.0 build
> tsup src/index.ts --format cjs,esm --dts --clean

CLI Building entry: src/index.ts
CLI Building entry: src/index.ts
✓ Built in XXXms

packages/verifier-api:
> @agentoauth/verifier-api@0.1.0 build
> tsup src/index.ts --format esm --clean

CLI Building entry: src/index.ts
✓ Built in XXXms
```

## Troubleshooting

### "tsup: command not found" during build

Dependencies not installed. Run:
```bash
pnpm install
```

### Build fails with TypeScript errors

Check Node.js version:
```bash
node --version  # Should be 18+
```

### Still having issues?

Delete everything and start fresh:
```bash
cd /Users/prithvi/projects/agentoauth
rm -rf node_modules packages/*/node_modules packages/*/dist
pnpm install
pnpm -r build
```

## Quick Reference

| Task | Command |
|------|---------|
| Install pnpm | `npm install -g pnpm` |
| Install deps | `pnpm install` |
| Build all | `pnpm -r build` |
| Build SDK | `cd packages/sdk-js && pnpm build` |
| Run tests | `pnpm -r test` |
| Run demo | `cd packages/demo-agent-to-merchant && bash demo.sh` |

## Success Check

After installing pnpm and running `pnpm install && pnpm -r build`:

```bash
# Check 1: pnpm is installed
pnpm --version
# ✅ Should show version number

# Check 2: SDK is built
ls packages/sdk-js/dist/index.js
# ✅ Should exist

# Check 3: Verifier API is built  
ls packages/verifier-api/dist/index.js
# ✅ Should exist

# Check 4: Demo runs
cd packages/demo-agent-to-merchant
node merchant.js
# ✅ Should start server
```

If all checks pass, you're ready to go! 🎉

