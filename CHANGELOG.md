# Changelog

All notable changes to AgentOAuth will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.0] - 2025-11-04

### Added - Phase 2B: Intent Layer (Passkey-Backed Human Approval)

**Protocol v0.3 - Time-Bound Human Intent**
- WebAuthn/Passkey-backed cryptographic proof of user approval
- Automatic expiry with configurable duration (7/30/90 days)
- Challenge cryptographically bound to policy hash (prevents tampering)
- New consent token version: `act.v0.3` with `intent` block
- Backward compatible with `act.v0.2` tokens (no intent required)

**SDK Updates**
- `requestIntent()` - Browser function for passkey approval ceremony
- `isWebAuthnSupported()` - Feature detection for WebAuthn/Passkeys
- `isIntentExpired()`, `getIntentRemainingDays()` - Intent utilities
- `issueConsent()` updated to accept optional `intent` parameter
- New types: `IntentV0`, `AgentOAuthPayloadV3`, `IntentDuration`
- Browser-safe entry point: `@agentoauth/sdk/browser` (no Node.js deps)
- Separate type-only exports for browser compatibility

**Verifier Updates**
- Intent validation in both local and hosted verifiers
- `validateIntentBasic()` using `@simplewebauthn/server`
- Intent expiry enforcement with `INTENT_EXPIRED` error code
- Policy hash binding verification with `INTENT_POLICY_MISMATCH` error
- Receipt fields: `intent_verified`, `intent_valid_until`, `intent_approved_at`
- `/health` endpoint advertises `act.v0.3` support
- Demo token creation endpoint supports intent parameter

**UI Components (LangChain Invoice Demo)**
- `IntentApprover` component with duration selector and passkey UI
- Updated `FlowProgressBar` to 6-step flow (added User Approval)
- Integrated passkey workflow into demo page
- Expiry simulation checkbox for testing
- Browser fallback warning for unsupported WebAuthn

**Testing & CI**
- E2E intent tests (`test-intent-e2e.js`) with 4 test scenarios
- Tests for valid intent, expired intent, policy mismatch, backward compat
- Updated CI workflow with intent test step
- UI linting step added to GitHub Actions

**Documentation**
- Updated `SPEC.md` with `act.v0.3` specification
- Passkey approval section in README
- Comprehensive deployment guide (`PHASE_2B_DEPLOYMENT.md`)
- Testing instructions (`PHASE_2B_TEST_INSTRUCTIONS.md`)

### Changed

- Token version support: now accepts `act.v0.2` and `act.v0.3`
- `issueConsent()` signature expanded with optional `intent` parameter
- Schema validation supports both string and array `scope` formats
- SDK package exports configured for browser vs. Node.js entry points
- Hosted verifier uses local `decode()` to avoid ajv dependency (Workers compat)

### Security

- Cryptographic proof of human approval via WebAuthn signature
- Challenge bound to `policy_hash` prevents policy tampering after approval
- Automatic expiry reduces attack window (no manual revocation needed)
- `residentKey: 'discouraged'` prevents passkey storage (one-time attestation)
- `userVerification: 'required'` ensures biometric/PIN confirmation

### Fixed

- Browser compatibility issues with Node.js crypto imports
- SDK now provides browser-safe entry point without fs/crypto dependencies
- WebAuthn uses `credentials.create()` instead of `credentials.get()`
- Policy hashing in browser using Web Crypto API (SHA-256)
- Hosted verifier no longer uses ajv (incompatible with Cloudflare Workers)

### Compatibility

- **Fully backward compatible** with `act.v0.2` tokens
- Verifiers automatically skip intent validation for v0.2 tokens
- Graceful degradation for browsers without WebAuthn support
- UI falls back to v0.2 mode if passkeys unavailable

### Browser Support

- Chrome/Edge 90+
- Safari 16+
- Firefox 119+
- Requires HTTPS or localhost
- WebAuthn with Touch ID, Face ID, Windows Hello, or FIDO2 keys

---

## [0.7.0] - 2025-11-02

### Added - Phase 2A: Policy Layer

**Structured Policy Support (pol.v0.2)**
- JSON-based policy schema with actions, resources, limits, and constraints
- Canonical JSON hashing algorithm for policy integrity
- Policy evaluation engine with budget tracking
- JWS-signed receipts with policy decisions
- Token and policy revocation endpoints

**SDK Features**
- `buildPolicyV2()` fluent API for policy creation
- `hashPolicy()` for SHA-256 policy hashing
- `issueConsent()` updated to accept policy parameter
- Policy validation and testing utilities

**Verifier API**
- `/verify` endpoint with policy evaluation
- `/simulate` endpoint for policy testing
- `/revoke` endpoint (by jti or policy.id)
- `/receipts/:id` endpoint for receipt retrieval
- `/lint/policy` and `/lint/token` validation endpoints
- Redis integration for stateful budget tracking

**Hosted Verifier (Cloudflare Workers)**
- Keyless free tier (1K verifications/day per issuer)
- IP-based rate limiting for free tier
- Durable Objects for policy state tracking
- Static docs and playground hosting
- Browser-compatible policy engine

**UI & Demos**
- Policy Builder playground with form interface
- Policy Tester with verification visualization
- LangChain Invoice Demo with AI policy generation
- Next.js UI with real-time agent logs and SSE

### Changed

- Consent token version: `0.2` → `act.v0.2`
- Added `policy` and `policy_hash` to token payload
- X-API-Key now optional in hosted verifier

---

## [0.6.0] - 2025-10-28

### Added

- Initial protocol specification (v0.1, v0.2)
- Basic consent token structure
- EdDSA signature support
- JWKS endpoint for public key distribution
- Simple scope-based authorization

### Security

- JWS signature validation
- Expiration time checking
- Audience validation
- Nonce for replay protection

---

## Release Notes

### v0.8.0 - Key Highlights

**🔐 Passkey-Backed Approval**
Time-bound human intent verification using Touch ID, Face ID, or Windows Hello. Cryptographically proves a real user approved a policy for a specific time period.

**⏰ Automatic Expiry**
No manual revocation needed - approvals automatically expire after 7/30/90 days.

**🔒 Policy Binding**
WebAuthn challenge is the policy hash - approval is cryptographically bound to the exact policy, preventing tampering.

**🌐 Production Ready**
Fully tested with E2E tests, browser compatibility checks, and CI integration. Deployed to Cloudflare Workers with global edge network.

**🔄 Backward Compatible**
All v0.2 tokens continue to work - no breaking changes.

---

## Migration Guide

### Upgrading to v0.8.0

**For Agent Developers:**

```typescript
// v0.2 (still works)
import { issueConsent } from '@agentoauth/sdk';
const { token } = await issueConsent({ policy });

// v0.3 (with passkey approval)
import { requestIntent, issueConsent } from '@agentoauth/sdk';
const intent = await requestIntent(policy, 30, 'yourdomain.com');
const { token } = await issueConsent({ policy, intent });
```

**For Browser/UI Developers:**

```typescript
// Import from browser-safe entry point
import { requestIntent, isWebAuthnSupported } from '@agentoauth/sdk/browser';

if (isWebAuthnSupported()) {
  const intent = await requestIntent(policy, 30, window.location.hostname);
  // Send intent to server for token issuance
}
```

**For Verifier Operators:**

No changes needed! The verifier automatically:
- ✅ Validates intent for v0.3 tokens
- ✅ Skips intent validation for v0.2 tokens  
- ✅ Returns receipts with intent fields when present

---

## Links

- [Specification](packages/spec/SPEC.md)
- [SDK Documentation](packages/sdk-js/README.md)
- [Deployment Guide](PHASE_2B_DEPLOYMENT.md)
- [Testing Instructions](PHASE_2B_TEST_INSTRUCTIONS.md)
- [Contributing](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)
