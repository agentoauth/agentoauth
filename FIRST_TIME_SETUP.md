# First Time Setup - Complete Guide

## You're Getting Build Errors?

That's normal! This project uses **pnpm** (not npm) for package management. Here's the complete setup:

---

## 🚀 Complete First-Time Setup

### Step 1: Install pnpm

```bash
npm install -g pnpm
```

**Verify it worked:**
```bash
pnpm --version
# Should show: 8.x.x or 9.x.x
```

**If you get permission errors:**
```bash
# Fix npm permissions first
sudo chown -R $(whoami) ~/.npm

# Then install pnpm
npm install -g pnpm
```

### Step 2: Install Project Dependencies

```bash
cd /Users/prithvi/projects/agentoauth

# Install all dependencies for all packages
pnpm install
```

**Time:** ~30-60 seconds

**Expected output:**
```
Progress: resolved XXX, reused YYY, downloaded ZZZ
Packages: +NNN
+++++++++++++++++++++
Done in Xs
```

### Step 3: Build All Packages

```bash
# Build SDK and verifier API
pnpm -r build
```

**Expected output:**
```
packages/sdk-js:
> @agentoauth/sdk@0.1.0 build
✓ Built in XXXms

packages/verifier-api:
> @agentoauth/verifier-api@0.1.0 build
✓ Built in XXXms
```

**Verify build succeeded:**
```bash
# Check SDK built
ls packages/sdk-js/dist/index.js
# ✅ Should exist

# Check Verifier API built
ls packages/verifier-api/dist/index.js
# ✅ Should exist
```

### Step 4: Run the Demo!

```bash
cd packages/demo-agent-to-merchant
bash demo.sh
```

**Expected:** See colorful output with successful and failed payment scenarios!

---

## 🎯 One-Command Setup

If you want to do it all at once:

```bash
cd /Users/prithvi/projects/agentoauth

# Install pnpm (if not already installed)
npm install -g pnpm

# Install dependencies and build
pnpm install && pnpm -r build

# Run the demo
cd packages/demo-agent-to-merchant && bash demo.sh
```

---

## ❌ Common Errors & Fixes

### Error: "pnpm: command not found"

**Fix:** Install pnpm
```bash
npm install -g pnpm
```

### Error: "tsup: command not found" during build

**Fix:** Install dependencies first
```bash
pnpm install
```

### Error: "Cannot find module '@agentoauth/sdk'"

**Fix:** Build the SDK
```bash
cd packages/sdk-js
pnpm build
```

### Error: "ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL"

This means one of the builds failed. Usually it's because:

1. **Dependencies not installed** → Run `pnpm install`
2. **TypeScript error** → Check the error message
3. **Node version too old** → Need Node 18+

**Check Node version:**
```bash
node --version
# Should be v18.0.0 or higher
```

### Error: Permission denied when installing pnpm globally

**Fix:**
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm

# Or install pnpm locally
npm install -D pnpm
npx pnpm install
npx pnpm -r build
```

---

## ✅ Verification Checklist

After setup, verify everything works:

```bash
# 1. pnpm is installed
pnpm --version
# ✅ Shows version number

# 2. Node is 18+
node --version
# ✅ Shows v18.x.x or higher

# 3. Dependencies installed
ls node_modules/@agentoauth
# ✅ Shows sdk/

# 4. SDK is built
ls packages/sdk-js/dist/index.js
# ✅ File exists

# 5. Verifier API is built
ls packages/verifier-api/dist/index.js
# ✅ File exists

# 6. Demo package has dependencies
ls packages/demo-agent-to-merchant/node_modules
# ✅ Directory exists

# 7. Merchant starts
cd packages/demo-agent-to-merchant
node merchant.js
# ✅ Server starts on port 4000

# 8. Agent works (in another terminal)
node agent.js --amount 150
# ✅ Payment successful
```

If all 8 checks pass: ✅ **You're ready to go!**

---

## 🎬 After Setup

Once setup is complete, you can:

### Run the Automated Demo

```bash
cd packages/demo-agent-to-merchant
bash demo.sh
```

### Run Tests

```bash
cd /Users/prithvi/projects/agentoauth
pnpm -r test
```

### Start the Playground

```bash
# Terminal 1
cd packages/verifier-api
pnpm dev

# Terminal 2
cd packages/playground
pnpm dev

# Open http://localhost:8080
```

---

## 📚 Why pnpm?

The project uses pnpm because:
- ✅ **Faster** than npm (saves disk space)
- ✅ **Better for monorepos** (workspace support)
- ✅ **Strict dependency resolution** (fewer bugs)
- ✅ **Industry standard** for modern monorepos

---

## 🆘 Still Having Issues?

### Option 1: Use npm instead

See [RUN_WITH_NPM.md](RUN_WITH_NPM.md) for complete npm-based setup.

### Option 2: Clean reinstall

```bash
cd /Users/prithvi/projects/agentoauth

# Remove everything
rm -rf node_modules packages/*/node_modules packages/*/dist

# Reinstall with pnpm
pnpm install
pnpm -r build
```

### Option 3: Ask for help

Share the complete error message, including:
- The full pnpm build output
- Your Node.js version (`node --version`)
- Your pnpm version (`pnpm --version`)

---

## Quick Commands Reference

```bash
# Install pnpm
npm install -g pnpm

# Install dependencies
pnpm install

# Build all packages
pnpm -r build

# Run all tests
pnpm -r test

# Run demo
cd packages/demo-agent-to-merchant && bash demo.sh
```

That's it! The project should work perfectly with pnpm now. 🎉

