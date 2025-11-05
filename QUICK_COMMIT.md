# Quick Commit & Deploy

## 1. Commit All Changes

```bash
cd /Users/prithvi/projects/agentoauth

git add .

git commit -m "feat: Add demo token issuance to hosted playground

Enables complete demo flow (policy → token → verify) in hosted playground.
Server-signed tokens with demo issuer, signature verification, and clear
educational warnings. Removes localhost option from hosted playground.

See PLAYGROUND_DEMO_TOKENS_COMPLETE.md and GIT_COMMIT_GUIDE.md"

git push origin main
```

## 2. Deploy to Cloudflare

```bash
cd packages/hosted-verifier

# Set demo issuer key (one-time)
wrangler secret put DEMO_ISSUER_PRIVATE_KEY --env production
# Paste: eyJjcnYiOiJFZDI1NTE5IiwiZCI6Ilc5a2pFeVo5M05Qdkw4a0xyc3J5R0VraGFuMW5ueVNDNnF5VHotdGxlQ1EiLCJ4IjoiTWJHZFR2MXJOQXA2NExXbUF0WFBNTWdtSTZkcHdVc2pMeXdON1FxeG5hbyIsImt0eSI6Ik9LUCIsImtpZCI6ImRlbW8ta2V5LTIwMjUiLCJhbGciOiJFZERTQSIsInVzZSI6InNpZyJ9

# Deploy
wrangler deploy --env production

# Test
open https://verifier.agentoauth.org/play
```

## 3. Verify

- Build policy
- Issue demo token
- Verify (should show ALLOW)
- Tamper token → Should reject with INVALID_SIGNATURE

Done! 🎉

