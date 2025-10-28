# Changelog

All notable changes to the AgentOAuth protocol will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

