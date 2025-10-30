# 🔐 Set Up Hosted Verifier Secrets

Your hosted verifier is deployed but needs the secrets to function. Here are the commands to set them up:

## 1. Set API Key Public Key

```bash
cd packages/hosted-verifier
wrangler secret put API_KEY_PUBLIC_KEY --env production
```

When prompted, paste this exact JSON (from your key generation):
```json
{"crv":"Ed25519","x":"vZPQp5P9jLVAhgES8lP26JYmBDJDH1gxw2kgnIkglkI","kty":"OKP"}
```

## 2. Set Audit Salt

```bash
wrangler secret put AUDIT_SALT --env production
```

When prompted, enter any random string like:
```
agentoauth-audit-salt-2025-super-secret-random-string
```

## 3. Test After Setting Secrets

After setting both secrets, test the endpoints:

```bash
# Test health (should still work)
curl https://verifier.agentoauth.org/health

# Test verify with demo API key (⚠️ DEMO KEY ONLY - For testing purposes)
# This is a demo/test key for "demo-org-001" with free tier quotas
# For production use, generate your own API key
curl -X POST https://verifier.agentoauth.org/verify \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ak_eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJkZW1vLW9yZy0wMDEiLCJuYW1lIjoiRGVtbyBPcmdhbml6YXRpb24iLCJ0aWVyIjoiZnJlZSIsInF1b3RhcyI6eyJkYWlseSI6MTAwMCwibW9udGhseSI6MTAwMDB9LCJpc3MiOiJhZ2VudG9hdXRoLm9yZyIsImV4cCI6MTc5MzIxNTI5NCwiaWF0IjoxNzYxNjc5Mjk0fQ.yEmUn7k5yurX2XR0Tu7PbPcbhJW5NHWW32hQNJjUTCr8hiLrQe-LKGd6o3bp0yo21duE8d3hFoXvz5j6Jx6fCg" \
  -d '{"token": "test-token", "audience": "merchant.example"}'

# Test usage endpoint
curl -X GET https://verifier.agentoauth.org/usage \
  -H "X-API-Key: ak_eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJkZW1vLW9yZy0wMDEiLCJuYW1lIjoiRGVtbyBPcmdhbml6YXRpb24iLCJ0aWVyIjoiZnJlZSIsInF1b3RhcyI6eyJkYWlseSI6MTAwMCwibW9udGhseSI6MTAwMDB9LCJpc3MiOiJhZ2VudG9hdXRoLm9yZyIsImV4cCI6MTc5MzIxNTI5NCwiaWF0IjoxNzYxNjc5Mjk0fQ.yEmUn7k5yurX2XR0Tu7PbPcbhJW5NHWW32hQNJjUTCr8hiLrQe-LKGd6o3bp0yo21duE8d3hFoXvz5j6Jx6fCg"
```

## 4. Test with Demo Merchant

Once the secrets are set and the verify endpoint works, test with your demo:

```bash
# Navigate back to project root
cd ../..

# Set environment variables for hosted verifier
# ⚠️ Using demo API key - Replace with your production key for real use
export USE_HOSTED_VERIFIER=true
export AGENTOAUTH_API_KEY="ak_eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJkZW1vLW9yZy0wMDEiLCJuYW1lIjoiRGVtbyBPcmdhbml6YXRpb24iLCJ0aWVyIjoiZnJlZSIsInF1b3RhcyI6eyJkYWlseSI6MTAwMCwibW9udGhseSI6MTAwMDB9LCJpc3MiOiJhZ2VudG9hdXRoLm9yZyIsImV4cCI6MTc5MzIxNTI5NCwiaWF0IjoxNzYxNjc5Mjk0fQ.yEmUn7k5yurX2XR0Tu7PbPcbhJW5NHWW32hQNJjUTCr8hiLrQe-LKGd6o3bp0yo21duE8d3hFoXvz5j6Jx6fCg"

# Run demo with hosted verification
pnpm demo
```

## Notes

- The hosted verifier is deployed and working
- It just needs the secrets for API key verification
- Once secrets are set, all endpoints should work properly
- The demo merchant will be able to use the hosted verifier for token verification
