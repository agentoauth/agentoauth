# Git Commit Guide - Playground Demo Tokens

## Files Changed (10 total)

### New Files (3):
- `PLAYGROUND_DEMO_TOKENS_COMPLETE.md` - Implementation summary
- `packages/hosted-verifier/scripts/generate-demo-key.js` - Key generation utility
- `packages/hosted-verifier/src/demo-issuer.ts` - Demo issuer key management

### Modified Files (7):
- `packages/hosted-verifier/src/index.ts` - 3 new endpoints + demo token verification
- `packages/hosted-verifier/public/play/index.html` - Removed localhost, added demo UI
- `packages/hosted-verifier/public/play/app.js` - Demo token logic, hardcoded API URL
- `packages/hosted-verifier/public/play/style.css` - Button styling improvements
- `packages/hosted-verifier/public/docs/index.html` - Demo token documentation
- `packages/hosted-verifier/public/docs/style.css` - Warning box styles
- `packages/hosted-verifier/wrangler.toml` - Demo issuer key documentation

---

## Pre-Commit Checklist

- [x] All TypeScript errors addressed
- [x] JavaScript errors fixed
- [x] Rate limiting works
- [x] Signature verification works
- [x] Tampered tokens rejected
- [x] Button styling improved
- [x] Documentation updated
- [x] Demo key generated
- [x] .dev.vars created (git-ignored)

---

## Git Commands

```bash
cd /Users/prithvi/projects/agentoauth

# 1. Stage all changes
git add .

# 2. Commit with detailed message
git commit -m "feat: Add demo token issuance to hosted playground

Enables end-to-end demo flow in the hosted playground by adding server-side
demo token issuance with a dedicated demo issuer identity. Users can now
experience the complete AgentOAuth flow without SDK setup.

Features:
- POST /playground/issue-demo-token - Server-signed demo tokens
- GET /playground/.well-known/jwks.json - Demo issuer public key
- Demo token signature verification in /verify endpoint
- Token mode toggle: Demo vs. External
- Removed localhost option from hosted playground (hardcoded to hosted)
- Rate limiting: 10/min, 100/hour per IP
- Clear educational warnings throughout UI

Security:
- Demo issuer private key stored in Cloudflare secrets
- Full signature verification using jose library
- Tampered tokens properly rejected
- Demo tokens clearly marked in responses

UI/UX:
- Progressive button flow: Build (blue) → Issue (green) → Verify (blue)
- Token display with copy, show full, and verify buttons
- Auto-fills Policy Tester from demo token
- Improved button visibility and styling

Demo Issuer:
- ID: https://demo.agentoauth.org
- Key ID: demo-key-2025
- Algorithm: EdDSA (Ed25519)
- JWKS: /playground/.well-known/jwks.json

Documentation:
- Added demo token section to docs
- curl examples
- Demo vs. production comparison
- Key generation script

Breaking: None
Browser: All modern browsers
Rate Limit: 100 tokens/hour per IP"

# 3. Check the commit
git log -1 --stat

# 4. Push to GitHub
git push origin main
```

---

## Post-Deployment Steps

### 1. Set Cloudflare Secret

```bash
cd packages/hosted-verifier

# Set the demo issuer private key
wrangler secret put DEMO_ISSUER_PRIVATE_KEY --env production

# When prompted, paste:
eyJjcnYiOiJFZDI1NTE5IiwiZCI6Ilc5a2pFeVo5M05Qdkw4a0xyc3J5R0VraGFuMW5ueVNDNnF5VHotdGxlQ1EiLCJ4IjoiTWJHZFR2MXJOQXA2NExXbUF0WFBNTWdtSTZkcHdVc2pMeXdON1FxeG5hbyIsImt0eSI6Ik9LUCIsImtpZCI6ImRlbW8ta2V5LTIwMjUiLCJhbGciOiJFZERTQSIsInVzZSI6InNpZyJ9
```

### 2. Deploy to Cloudflare

```bash
cd packages/hosted-verifier
wrangler deploy --env production
```

### 3. Verify Deployment

```bash
# Check health
curl https://verifier.agentoauth.org/health

# Test demo JWKS
curl https://verifier.agentoauth.org/playground/.well-known/jwks.json

# Issue demo token
curl -X POST https://verifier.agentoauth.org/playground/issue-demo-token \
  -H "Content-Type: application/json" \
  -d '{
    "policy": {
      "version": "pol.v0.2",
      "id": "pol_test",
      "actions": ["payments.send"],
      "resources": [],
      "limits": {"per_txn": {"amount": 100, "currency": "USD"}}
    }
  }'

# Open playground
open https://verifier.agentoauth.org/play
```

### 4. Manual Testing Checklist

In the playground:
- [ ] Build policy (Travel template)
- [ ] Issue demo token
- [ ] Copy token (green button works)
- [ ] Show full token (indigo button works)
- [ ] Verify token → Shows ALLOW
- [ ] Tamper with token (delete chars) → Shows DENY with INVALID_SIGNATURE
- [ ] Check demo warning appears
- [ ] Try external token mode
- [ ] Check docs page has demo section

---

## Files Summary

**Backend (4 files):**
- `src/demo-issuer.ts` - Key management module
- `src/index.ts` - 3 new endpoints, demo verification
- `scripts/generate-demo-key.js` - Key generator
- `wrangler.toml` - Secret docs

**Frontend (5 files):**
- `public/play/index.html` - New UI, no localhost option
- `public/play/app.js` - Demo token logic
- `public/play/style.css` - Button styles
- `public/docs/index.html` - Demo docs
- `public/docs/style.css` - Warning styles

**Docs (1 file):**
- `PLAYGROUND_DEMO_TOKENS_COMPLETE.md` - Implementation summary

---

## Key Security Fixes Included

1. ✅ Signature verification properly enforced
2. ✅ Tampered tokens rejected
3. ✅ Missing `await` on `hashPolicy()` fixed
4. ✅ Demo token verification flow corrected
5. ✅ Rate limiting in place

---

## Ready to Commit! 🚀

Run the commands above to commit and deploy.

