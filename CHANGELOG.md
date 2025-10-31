# Changelog

All notable changes to the AgentOAuth protocol will be documented in this file.

## [0.7.0] - 2025-10-31

### Added - Phase 2A: Policy Support (Programmable Consent) 🎯
- **Policy Schema (pol.v0.2)**: Structured JSON schema for machine-readable authorization rules
- **Token Schema (act.v0.2)**: Extended token payload with `policy` and `policy_hash` fields
- **Canonical JSON Hashing**: Deterministic serialization and SHA-256 hashing for policy integrity
- **Policy Builder SDK**: Fluent API for creating policies with chainable methods
- **Policy Evaluation Engine**: Stateless evaluation logic for actions, resources, limits, and constraints
- **JWS-Signed Receipts**: Verifiable receipts generated after policy evaluation
- **Budget Tracking**: Stateful per-period limits with memory and Redis storage adapters
- **Policy Revocation**: Extended revocation to support both JTI and policy ID
- **Playground Enhancements**: Intent Builder and Policy Tester UI tabs
- **New Examples**: `issue-with-policy.js` and `verify-with-policy.js`

### Enhanced 🔧
- Verifier API `/verify` endpoint now evaluates policies and returns signed receipts
- New `/receipts/:id` endpoint to retrieve signed policy evaluation receipts
- Extended `/revoke` endpoint to support policy-level revocation
- SDK `issueConsent()` accepts optional `policy` parameter
- Health check includes policy revocation statistics

### Policy Features
- Per-transaction limits with amount and currency validation
- Per-period budgets (hour, day, week, month) with stateful tracking
- Resource whitelisting (merchants, APIs, etc.)
- Time-based constraints (day of week, time windows, timezone)
- Strict mode for unknown field handling
- Action-based authorization rules

### Documentation
- Policy schema specification and examples
- Updated Verifier API README with policy evaluation flow
- Policy Builder usage examples
- Phase 2A implementation summary

### Version Updates
- All packages bumped to v0.7.0
- New policy schema files: `pol.v0.2.schema.json`, `act.v0.2.schema.json`
- Playground updated with Policy Builder and Policy Tester tabs

## [0.6.0] - 2025-01-15

### Added 🚀
- **Hosted Verifier (Alpha)**: Production-ready hosted verifier at `verifier.agentoauth.org`
- **API Key Authentication**: JWT-based API keys with organization quotas and tier management
- **Rate Limiting**: Per-organization daily/monthly limits with KV-based storage
- **Privacy-First Audit Logging**: Hash PII, store only necessary data for analytics
- **Global Edge Deployment**: Cloudflare Workers for <50ms verification worldwide
- **Usage Analytics**: Real-time quota monitoring and usage tracking
- **Terms of Service**: Alpha service terms with privacy policy
- **Demo Integration**: Hosted verifier support in demo merchant (`USE_HOSTED_VERIFIER=true`)

### Enhanced 🔧
- Remove self-hosting friction - no need to run your own verifier
- Production deployment tools: `pnpm hosted:generate-keys`, `pnpm hosted:deploy`
- Three-tier quota system: Free (1K/day), Pro (50K/day), Enterprise (500K/day)
- CORS support for browser usage
- Comprehensive error codes and suggestions
- Real-time rate limit headers (`X-RateLimit-*`)

### Security & Privacy 🔒
- PII hashing with salted SHA-256
- Amount ranges instead of exact values
- No complete token storage
- Minimal audit data collection
- API key revocation support

### Version Updates
- All packages bumped to v0.6.0
- `@agentoauth/hosted-verifier` new package
- Documentation updated with deployment guides

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2025-10-28

### Added - SDK Ergonomics & Adapters (5-Minute DX)
- **Ergonomic SDK Functions**: `issueConsent()`, `verifyConsent()`, `revokeConsent()`, `rotateKeys()` with auto key management
- **Policy Builder**: `buildPolicy()` with configurable presets (payment, read, admin, custom)
- **Key Management**: Auto-detection key loading from env vars, files, or JWKS URLs
- **Agent Express Middleware**: `@agentoauth/agent-express` for automatic request signing
- **Merchant Express Middleware**: `@agentoauth/merchant-express` for token validation
- **Pre-configured Middleware**: `AgentAuth.payment()`, `MerchantAuth.payment()` with safe defaults
- **Node/Express Quickstart**: Complete 5-minute quickstart with agent and merchant examples
- **Cloudflare Workers Quickstart**: Edge deployment examples for global scale
- **Comprehensive Documentation**: Step-by-step guides and production patterns

### Enhanced
- **SDK API Surface**: Expanded from 3 to 15+ functions for complete DX
- **Error Handling**: Clear error messages with actionable suggestions
- **Developer Experience**: Zero-config key generation and policy management
- **Express Integration**: Seamless middleware patterns for both agents and merchants
- **Production Readiness**: Error handling, logging, and monitoring examples

### Developer Experience
- **5-Minute Setup**: From zero to verified agent-to-merchant flow in under 5 minutes
- **Copy-Paste Ready**: Production-ready code examples for common patterns
- **Multiple Platforms**: Express, Cloudflare Workers, with more coming
- **Clear Migration Path**: Backward compatible with existing v0.4 implementations

## [0.4.0] - 2025-10-28

### Added
- Formal OpenAPI 3.0 specification for all endpoints (`packages/spec/openapi.yaml`)
- Comprehensive conformance test suite (`@agentoauth/conformance`)
- Cross-language test vectors for JSON canonicalization
- Automated badge generation for conformance results
- CLI commands: `test:conformance`, `test:conformance:remote`
- 23+ test fixtures covering all error scenarios
- JSON canonicalization validation for cross-language implementations
- Detailed conformance reporting with CONFORMANCE.md generation

### Changed
- API specification formalized in OpenAPI 3.0 format
- Conformance testing integrated into development workflow

### Documentation
- Added comprehensive conformance testing documentation
- OpenAPI spec available for integration testing
- Test vector documentation for cross-language compatibility

## [0.2.0] - 2025-10-21

### Added

- **Token Revocation**: New `jti` (JWT ID) field in payload for unique token identification
- **Anti-Replay Protection**: Replay cache tracks used tokens to prevent reuse
- **Revocation Endpoint**: `POST /revoke` endpoint to revoke tokens by jti
- **Revocation List**: In-memory revocation storage in verifier API
- **Auto-generation**: SDK automatically generates jti if not provided
- **Examples Package**: 
  - `issue-token.js` - Create and display token
  - `verify-token.js` - Verify token from stdin
- **Postman Collection**: Complete API collection for testing
- **Playground Enhancements**:
  - Pretty-printed JSON output
  - Copy buttons for token, header, and payload
  - Sample token dropdown with pre-loaded examples
  - Revoke token functionality
  - JTI display in results
- **5-Minute Quickstart**: Complete walkthrough including revocation

### Changed

- **Payload Structure**: Now includes required `jti` field (9 fields total)
- **Protocol Version**: Updated from `0.1` to `0.2`
- **Verification Flow**: Now checks revocation list and replay cache
- **Error Codes**: Added `REVOKED` and `REPLAY` error codes
- **JSON Schema**: Updated to include jti validation

### Security

- **Replay Protection**: Tokens can only be used once (tracked by jti)
- **Revocation**: Compromised tokens can be immediately invalidated
- **Audit Trail**: All revocations and replays are logged

## [0.1.0] - 2025-10-21

### Added

- Initial release of AgentOAuth protocol
- Complete protocol specification (SPEC.md)
- JavaScript/TypeScript SDK with `request()` and `verify()` functions
- Verifier API with JWKS endpoint
- Interactive playground for token validation
- Agent-to-merchant payment demo
- 16 unit tests
- GitHub Actions CI/CD workflow
- Comprehensive documentation (26+ files)
- Dual MIT/Apache 2.0 license

### Features

- EdDSA (Ed25519) cryptographic signatures
- JWS compact token format
- OAuth-style scopes
- Amount and currency limits
- Token expiration with clock skew tolerance
- Audience validation
- Complete input validation
- Consistent error handling

