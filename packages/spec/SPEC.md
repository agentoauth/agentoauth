# AgentOAuth Protocol Specification v0.2

## Purpose

AgentOAuth provides portable proof of who authorized what for AI agent actions. It enables any agent to present verifiable credentials showing a user's consent for specific operations with defined limits, facilitating trust and accountability in automated systems.

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

## Payload Fields (v0.2)

The JWS payload MUST be a JSON object containing the following fields:

- **`ver`** (string, required): Specification version. Must be `"0.2"` for this version.
- **`jti`** (string, required): JWT ID - unique identifier for this token. Used for revocation and replay protection. Minimum length: 8 characters. Recommended: UUID v4.
- **`user`** (string, required): Identifier of the human or account that granted authorization. Should be a DID (e.g., `did:example:alice`) or stable identifier.
- **`agent`** (string, required): Identifier of the delegated actor/agent. Can be a service name (e.g., `freelance-bot@yourapp`) or DID.
- **`scope`** (string, required): OAuth-style scope string defining the authorized action (e.g., `pay:merchant`, `data:calendar.read`).
- **`limit`** (object, required): Constraints on the authorization. Must contain:
  - `amount` (number): Maximum amount allowed
  - `currency` (string): Currency code (e.g., `USD`, `EUR`)
- **`aud`** (string, optional): Intended audience/verifier. If present, verifiers MUST reject tokens not addressed to them.
- **`exp`** (number, required): Expiration time as Unix timestamp in seconds. Tokens are invalid after this time.
- **`nonce`** (string, required): Unique value for replay protection. Should be cryptographically random (recommended length: 16+ characters).

### Example Payload

```json
{
  "ver": "0.2",
  "jti": "550e8400-e29b-41d4-a716-446655440000",
  "user": "did:example:alice",
  "agent": "freelance-bot@yourapp",
  "scope": "pay:freelancer",
  "limit": {
    "amount": 1500,
    "currency": "USD"
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
6. **Version Check**: Ensure `ver` field matches supported specification version (`"0.2"`).
7. **Limit Validation**: Application-specific. Verify requested amount/currency is within the `limit`. This is policy-dependent and not enforced by the protocol itself.

If any check fails, the token MUST be rejected.

## Security Considerations

### Key Rotation

Use the `kid` field to support multiple active keys. Verifiers should fetch current keys from the issuer's JWKS endpoint. Rotate keys regularly and deprecate old keys gracefully.

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

**v0.1** (Initial Release)
- Core 8-field payload structure
- EdDSA and ES256K support
- Basic verification rules
- Security considerations

