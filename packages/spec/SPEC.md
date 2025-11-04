# AgentOAuth Protocol Specification v0.3

## Purpose

AgentOAuth provides portable proof of who authorized what for AI agent actions. It enables any agent to present verifiable credentials showing a user's consent for specific operations with defined limits, facilitating trust and accountability in automated systems.

**v0.3 Update**: This specification now includes time-bound human intent verification using WebAuthn/Passkeys, providing cryptographic proof that a real user explicitly approved a policy with a defined validity period.

## Token Type

Tokens use **JWS (JSON Web Signature)** in compact serialization format. The token consists of three base64url-encoded parts separated by dots: `header.payload.signature`.

### Header

The JWS header MUST include:

```json
{
  "alg": "EdDSA",
  "kid": "did:example:keys#ed25519-1",
  "typ": "JWT"
}
```

- `alg` (string, required): Signing algorithm. `EdDSA` is recommended, `ES256K` is optional.
- `kid` (string, required): Key identifier, typically a DID with fragment or key URL.
- `typ` (string, required): Must be `"JWT"` for compatibility.

## Payload Fields

### Core Fields (v0.2 and v0.3)

The JWS payload MUST be a JSON object containing the following fields:

- **`ver`** (string, required): Specification version. Must be `"act.v0.2"` or `"act.v0.3"`.
- **`jti`** (string, required): JWT ID - unique identifier for this token. Used for revocation and replay protection. Minimum length: 8 characters. Recommended: UUID v4.
- **`user`** (string, required): Identifier of the human or account that granted authorization. Should be a DID (e.g., `did:example:alice`) or stable identifier.
- **`agent`** (string, required): Identifier of the delegated actor/agent. Can be a service name (e.g., `freelance-bot@yourapp`) or DID.
- **`scope`** (string or array, required): OAuth-style scope string or array defining the authorized action (e.g., `"pay:merchant"` or `["payments.send"]`).
- **`policy`** (object, required in v0.2+): Structured policy defining actions, resources, limits, and constraints (see Policy Schema below).
- **`policy_hash`** (string, required in v0.2+): SHA-256 hash of the canonical policy JSON, prefixed with `"sha256:"`.
- **`aud`** (string, optional): Intended audience/verifier. If present, verifiers MUST reject tokens not addressed to them.
- **`exp`** (number, required): Expiration time as Unix timestamp in seconds. Tokens are invalid after this time.
- **`nonce`** (string, required): Unique value for replay protection. Should be cryptographically random (recommended length: 16+ characters).

### Intent Fields (v0.3 only)

When `ver` is `"act.v0.3"`, the payload MUST also include:

- **`intent`** (object, required): WebAuthn assertion proving human approval. Contains:
  - `type` (string): Must be `"webauthn.v0"`
  - `credential_id` (string): Base64url-encoded credential identifier
  - `signature` (string): Base64url-encoded WebAuthn signature
  - `client_data_json` (string): Base64url-encoded client data JSON
  - `authenticator_data` (string): Base64url-encoded authenticator data
  - `approved_at` (string): ISO 8601 timestamp when user approved
  - `valid_until` (string): ISO 8601 timestamp when approval expires
  - `challenge` (string): Base64url-encoded challenge (derived from policy_hash)
  - `rp_id` (string): Relying party identifier (domain)

### Example Payload (v0.2 - Policy Only)

```json
{
  "ver": "act.v0.2",
  "jti": "550e8400-e29b-41d4-a716-446655440000",
  "user": "did:example:alice",
  "agent": "did:agent:finance-assistant",
  "scope": ["payments.send"],
  "policy": {
    "version": "pol.v0.2",
    "id": "pol_travel_01",
    "actions": ["payments.send"],
    "resources": [
      {
        "type": "merchant",
        "match": { "ids": ["airbnb", "expedia"] }
      }
    ],
    "limits": {
      "per_txn": { "amount": 500, "currency": "USD" },
      "per_period": { "amount": 2000, "currency": "USD", "period": "week" }
    },
    "strict": true
  },
  "policy_hash": "sha256:3fd9a8c7e2b4f1d0...",
  "aud": "merchant.example",
  "exp": 1734220799,
  "nonce": "8b2d0c9b14a0a8c1"
}
```

### Example Payload (v0.3 - Policy + Intent)

```json
{
  "ver": "act.v0.3",
  "jti": "550e8400-e29b-41d4-a716-446655440000",
  "user": "did:example:alice",
  "agent": "did:agent:finance-assistant",
  "scope": ["payments.send"],
  "policy": {
    "version": "pol.v0.2",
    "id": "pol_travel_01",
    "actions": ["payments.send"],
    "resources": [
      {
        "type": "merchant",
        "match": { "ids": ["airbnb", "expedia"] }
      }
    ],
    "limits": {
      "per_txn": { "amount": 500, "currency": "USD" },
      "per_period": { "amount": 2000, "currency": "USD", "period": "week" }
    },
    "strict": true
  },
  "policy_hash": "sha256:3fd9a8c7e2b4f1d0...",
  "intent": {
    "type": "webauthn.v0",
    "credential_id": "cGFzc2tleV9jcmVkZW50aWFs",
    "signature": "U2lnbmF0dXJlRGF0YUhlcmU...",
    "client_data_json": "eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoiLi4uIn0",
    "authenticator_data": "SZYN5YgOjGh0NBcPZHZgW4...",
    "approved_at": "2025-11-05T19:02:11Z",
    "valid_until": "2025-12-05T19:02:11Z",
    "challenge": "sha256:3fd9a8c7e2b4f1d0...",
    "rp_id": "example.com"
  },
  "aud": "merchant.example",
  "exp": 1734220799,
  "nonce": "8b2d0c9b14a0a8c1"
}
```

## Signing

### Algorithms

- **EdDSA (Ed25519)**: RECOMMENDED. Provides strong security with compact signatures.
- **ES256K (secp256k1)**: OPTIONAL. May be used for blockchain compatibility.

Implementers MUST support EdDSA. Other algorithms MAY be supported but are not guaranteed to be interoperable.

### Key Format

Private keys used for signing and public keys used for verification SHOULD be distributed in JWK (JSON Web Key) format. Public keys SHOULD be published via JWKS (JWK Set) at `/.well-known/jwks.json`.

## Verification Rules

Verifiers MUST perform the following checks in order:

1. **Signature Validation**: Verify the JWS signature using the public key identified by `kid` in the header.
2. **Expiration Check**: Ensure `exp` is in the future. Allow clock skew of ±60 seconds.
3. **Revocation Check** (v0.2+): Verify token has not been revoked by checking `jti` against revocation list.
4. **Replay Check** (v0.2+): Verify token has not been used before by checking `jti` against replay cache.
5. **Audience Validation** (if `aud` present): Verify `aud` matches the verifier's configured audience identifier.
6. **Version Check**: Ensure `ver` field matches supported specification version (`"act.v0.2"` or `"act.v0.3"`).
7. **Policy Hash Validation** (v0.2+): Recompute `policy_hash` from canonical policy JSON and verify it matches the value in the token.
8. **Intent Validation** (v0.3 only): If `ver` is `"act.v0.3"` and `intent` is present, verify:
   - WebAuthn signature is valid using the authenticator's public key
   - Challenge in `intent.client_data_json` matches `policy_hash`
   - Current time is before `intent.valid_until` (intent not expired)
   - `intent.rp_id` matches expected relying party identifier
   - If any intent check fails, reject with error code `INTENT_EXPIRED` or `INTENT_INVALID`
9. **Policy Evaluation** (v0.2+): Evaluate structured policy against request context:
   - Check `actions` match requested operation
   - Check `resources` match target resource
   - Check `limits.per_txn` for transaction amount
   - Check `limits.per_period` for budget tracking (requires stateful storage)
   - Evaluate `constraints` (time windows, location, etc.)

If any check fails, the token MUST be rejected.

### Backward Compatibility

Verifiers supporting v0.3 MUST also accept v0.2 tokens (without intent). When processing v0.2 tokens, skip step 8 (Intent Validation).

## Intent Block Specification (webauthn.v0)

The `intent` block provides cryptographic proof of human approval with time-bound validity.

### Intent Generation

1. **Challenge Derivation**: The challenge MUST be derived from the `policy_hash` to cryptographically bind the WebAuthn assertion to the specific policy.

2. **WebAuthn Ceremony**: Call `navigator.credentials.get()` with:
   - `challenge`: Buffer derived from `policy_hash`
   - `rpId`: Domain of the application
   - `userVerification`: Set to `"required"` to ensure biometric/PIN authentication

3. **Expiry Calculation**: 
   - `approved_at`: Current timestamp (ISO 8601)
   - `valid_until`: `approved_at` + duration (7/30/90 days recommended)

### Intent Validation Algorithm

Verifiers MUST perform these checks for v0.3 tokens:

```
1. Extract intent from token payload
2. Check type === "webauthn.v0"
3. Verify current_time <= parse_iso8601(intent.valid_until)
   If expired: return DENY with code "INTENT_EXPIRED"
4. Decode intent.client_data_json from base64url
5. Parse clientData as JSON
6. Verify clientData.challenge === intent.challenge
7. Verify intent.challenge === token.policy_hash
   If mismatch: return DENY with code "INTENT_POLICY_MISMATCH"
8. Verify WebAuthn signature using @simplewebauthn/server or equivalent:
   - authenticatorData: base64url_decode(intent.authenticator_data)
   - clientDataJSON: base64url_decode(intent.client_data_json)
   - signature: base64url_decode(intent.signature)
   - credentialID: base64url_decode(intent.credential_id)
   If signature invalid: return DENY with code "INTENT_INVALID"
9. Verify intent.rp_id matches expected relying party
10. If all checks pass: include intent verification details in receipt
```

### Intent Expiry Semantics

- **Automatic Expiry**: Tokens with expired intent MUST be rejected, even if the token's `exp` is in the future.
- **No Extension**: Intent validity cannot be extended; user must re-approve with a new passkey ceremony.
- **Grace Period**: No grace period. Expiry is enforced at the exact `valid_until` timestamp.

### Error Codes

- `INTENT_EXPIRED`: Current time is past `valid_until`
- `INTENT_INVALID`: WebAuthn signature verification failed
- `INTENT_POLICY_MISMATCH`: Challenge doesn't match policy_hash

## Security Considerations

### Key Rotation

Use the `kid` field to support multiple active keys. Verifiers should fetch current keys from the issuer's JWKS endpoint. Rotate keys regularly and deprecate old keys gracefully.

### Intent Security (v0.3)

**Passkey Binding**: The WebAuthn challenge is derived from `policy_hash`, ensuring the passkey approval is cryptographically bound to the specific policy. Users cannot sign a different policy with the same intent.

**Time-Bound Consent**: `valid_until` provides automatic expiry. Even if an agent's key is compromised, the attacker can only act within the approval window.

**User Verification**: Setting `userVerification: "required"` ensures biometric or PIN authentication, providing strong proof that the approval came from the actual user, not just someone with access to the device.

### Clock Skew

Allow ±60 seconds of clock skew when checking `exp` to accommodate minor time synchronization differences. For high-security applications, reduce this window or use time synchronization protocols.

### Replay Protection

The `nonce` field provides anti-replay protection. Verifiers in sensitive contexts SHOULD track used nonces within the token validity period and reject duplicates.

### Audience Pinning

Always include `aud` when tokens are intended for a specific recipient. This prevents token theft and reuse against unintended targets.

### Storage

Tokens are bearer credentials. Store them securely (encrypted at rest). Never log tokens in plaintext. Rotate tokens before expiration when possible.

### Transport

Always transmit tokens over HTTPS/TLS. Consider additional encryption for highly sensitive operations.

### Limit Enforcement

The protocol specifies `limit` structure but does not enforce business logic. Applications MUST implement appropriate limit checks based on their requirements.

## Interoperability

### Field Mapping for x402/AP2

For compatibility with emerging standards:

- Reserve the claim name `agent_oauth_token` when embedding AgentOAuth tokens in other protocols.
- The `scope` field aligns with OAuth 2.0 scope semantics.
- DIDs in `user` and `agent` fields support decentralized identity systems.

### Extensibility

Future versions may add optional fields. Verifiers MUST ignore unknown fields to maintain forward compatibility.

## Examples

See the `examples/` directory for:

- `valid-token.json`: A complete valid payload
- `invalid-expired.json`: An expired token example
- `invalid-aud.json`: A token with mismatched audience

## Changelog

**v0.3** (Intent Layer - November 2025)
- Added `intent` block for WebAuthn/Passkey-backed human approval
- Time-bound consent with `approved_at` and `valid_until`
- Cryptographic binding of intent to policy via challenge
- New error codes: `INTENT_EXPIRED`, `INTENT_INVALID`, `INTENT_POLICY_MISMATCH`
- Backward compatible with v0.2 tokens
- Updated verification algorithm with intent validation step
- Intent expiry semantics and security considerations

**v0.2** (Policy Layer - October 2025)
- Added structured `policy` object (pol.v0.2 schema)
- Added `policy_hash` for integrity verification
- Support for actions, resources, limits, and constraints
- Canonical JSON hashing for deterministic policy verification
- JWS-signed receipts from verifiers
- Token and policy revocation support
- Updated token version format to `"act.v0.2"`

**v0.1** (Initial Release)
- Core 8-field payload structure
- EdDSA and ES256K support
- Basic verification rules
- Security considerations

