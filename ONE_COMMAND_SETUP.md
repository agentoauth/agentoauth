# One-Command Setup & Demo

## 🚀 Single Command to Run Everything

From the project root, you can now do everything with simple commands:

### First Time Setup

```bash
cd /Users/prithvi/projects/agentoauth

# One command: install dependencies AND build everything
pnpm setup
```

This runs:
1. `pnpm install` - Installs all dependencies
2. `pnpm run build` - Builds SDK and verifier-api

**Time:** ~1 minute

### Run the Demo

```bash
# One command: build (if needed) AND run demo
pnpm demo
```

This runs:
1. `pnpm run build` - Ensures packages are built
2. `bash demo.sh` - Runs the automated demo

**Time:** ~10 seconds

### Or Do It All at Once

```bash
cd /Users/prithvi/projects/agentoauth

# Install, build, AND run demo in one command
pnpm setup && pnpm demo
```

---

## 📋 New Root Commands (All From Project Root)

| Command | What it does | When to use |
|---------|--------------|-------------|
| `pnpm setup` | Install deps + build | First time only |
| `pnpm build` | Build SDK + verifier-api | After code changes |
| `pnpm demo` | Build + run automated demo | Anytime |
| `pnpm test` | Run all tests | Check everything works |
| `pnpm demo:merchant` | Start merchant server | Manual testing |
| `pnpm demo:agent` | Run agent (needs merchant running) | Manual testing |

---

## 🎯 Complete Workflow

### First Time

```bash
cd /Users/prithvi/projects/agentoauth
pnpm setup
pnpm demo
```

### After Making Changes

```bash
# Rebuild and run demo
pnpm demo
```

### Manual Testing

```bash
# Terminal 1: Merchant
pnpm demo:merchant

# Terminal 2: Agent
pnpm demo:agent --amount 150
```

---

## 🔧 What Changed

**Before (complex):**
```bash
cd /Users/prithvi/projects/agentoauth
pnpm install
cd packages/sdk-js
pnpm build
cd ../verifier-api  
pnpm build
cd ../demo-agent-to-merchant
bash demo.sh
```

**After (simple):**
```bash
cd /Users/prithvi/projects/agentoauth
pnpm setup    # First time
pnpm demo     # Anytime
```

---

## 💡 How It Works

The root `package.json` now has smart scripts:

```json
{
  "scripts": {
    "setup": "pnpm install && pnpm run build",
    "build": "pnpm --filter @agentoauth/sdk build && pnpm --filter @agentoauth/verifier-api build",
    "demo": "pnpm run build && cd packages/demo-agent-to-merchant && bash demo.sh"
  }
}
```

- `pnpm --filter` builds specific packages only (faster than `-r`)
- Everything runs from the root directory
- No need to `cd` into subdirectories

---

## ✅ Quick Test

After setup, verify it works:

```bash
# From project root
cd /Users/prithvi/projects/agentoauth

# Run setup
pnpm setup

# Run demo
pnpm demo

# Should see:
# 🎬 AgentOAuth Demo: Agent-to-Merchant Payment
# ✅ Payment Successful!
# ❌ Payment Failed! (exceeds limit)
# ✅ Demo complete!
```

---

## 🎓 Benefits

✅ **No directory juggling** - Everything from root
✅ **One command** - `pnpm setup` or `pnpm demo`
✅ **Faster** - Only builds what's needed
✅ **Simpler** - Clear what each command does
✅ **Reliable** - Handles dependencies automatically

---

## 🆘 Still Having Issues?

If `pnpm setup` fails, you might not have pnpm installed:

```bash
# Install pnpm first
npm install -g pnpm

# Then setup
cd /Users/prithvi/projects/agentoauth
pnpm setup
```

If build still fails, see [BUILD_INSTRUCTIONS.md](BUILD_INSTRUCTIONS.md) or [SIMPLIFIED_BUILD.md](SIMPLIFIED_BUILD.md).

---

## TL;DR

**Old way:** 5+ commands from different directories  
**New way:** 2 commands from root

```bash
pnpm setup  # Once
pnpm demo   # Anytime
```

Try it now! 🎉

