# SPDX-License-Identifier: MIT
"""Ed25519 / EdDSA compact-JWS helpers.

We reuse AgentOAuth's signing scheme — EdDSA over OKP/Ed25519 keys producing
**attached compact JWS** (``header.payload.signature``), mirroring the TS
``jose.SignJWT(...).sign(key)`` path in ``packages/sdk-js/src/request.ts`` and
``packages/verifier-api/src/receipts/index.ts``. No new crypto: jwcrypto wraps
``cryptography``'s Ed25519.

A signature is "self-verifying" because the JWS header carries a ``kid`` that
selects a *public* JWK embedded alongside the receipt chain (see the saga.json
dump), so signatures verify fully offline.
"""

from __future__ import annotations

import json
from typing import Any

from jwcrypto import jwk, jws
from jwcrypto.common import json_encode

ALG = "EdDSA"


def generate_okp_jwk(seed: bytes | None = None) -> jwk.JWK:
    """Generate (or deterministically derive) an Ed25519 OKP JWK.

    A ``seed`` (32 bytes) yields a reproducible key — used only for stable demo
    dumps when ``SAGA_KEY_SEED`` is set; production/default path uses random keys.
    """
    if seed is not None:
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

        priv = Ed25519PrivateKey.from_private_bytes(seed[:32].ljust(32, b"\0"))
        key = jwk.JWK.from_pyca(priv)
    else:
        key = jwk.JWK.generate(kty="OKP", crv="Ed25519")
    # Stamp a stable, content-addressed kid (RFC 7638 thumbprint) into the JWK.
    key["kid"] = key.thumbprint()
    return key


def public_jwk_dict(key: jwk.JWK) -> dict[str, Any]:
    """Export the public-only JWK as a dict (no private ``d``), with kid/alg/use."""
    pub = json.loads(key.export_public())
    pub.setdefault("kid", key.get("kid") or key.thumbprint())
    pub["alg"] = ALG
    pub["use"] = "sig"
    return pub


def jwk_from_dict(d: dict[str, Any]) -> jwk.JWK:
    """Import a JWK (public or private) from a plain dict."""
    return jwk.JWK.from_json(json.dumps(d))


def kid_of(key: jwk.JWK) -> str:
    return key.get("kid") or key.thumbprint()


def sign_compact(claims: dict[str, Any], private_key: jwk.JWK) -> str:
    """Sign ``claims`` and return an attached compact JWS string.

    Header mirrors AgentOAuth: ``{"alg":"EdDSA","kid":<kid>,"typ":"JWT"}``.
    """
    kid = kid_of(private_key)
    token = jws.JWS(json_encode(claims))
    token.add_signature(
        private_key,
        alg=ALG,
        protected=json_encode({"alg": ALG, "kid": kid, "typ": "JWT"}),
    )
    return token.serialize(compact=True)


def verify_compact(compact: str, public_key: jwk.JWK) -> dict[str, Any]:
    """Verify a compact JWS against a single key; return the decoded claims.

    Raises ``jwcrypto.jws.InvalidJWSSignature`` (or similar) on failure.
    """
    token = jws.JWS()
    token.deserialize(compact)
    token.verify(public_key)
    return json.loads(token.payload)


def verify_with_jwks(compact: str, jwks: list[dict[str, Any]]) -> dict[str, Any]:
    """Verify against an embedded public JWKS using verify-then-accept.

    Tries the kid-matching key first, then any remaining key. Tolerates duplicate
    kids (e.g. mixed Python-thumbprint and foreign ``key-<ms>`` kids). Raises
    ``ValueError`` if no embedded key verifies the signature.
    """
    header = _peek_header(compact)
    hdr_kid = header.get("kid")
    ordered = sorted(jwks, key=lambda k: 0 if k.get("kid") == hdr_kid else 1)
    last_err: Exception | None = None
    for k in ordered:
        try:
            return verify_compact(compact, jwk_from_dict(k))
        except Exception as exc:  # noqa: BLE001 - try the next candidate key
            last_err = exc
    raise ValueError(f"no embedded key verifies signature (kid={hdr_kid}): {last_err}")


def _peek_header(compact: str) -> dict[str, Any]:
    """Decode the protected header of a compact JWS without verifying."""
    import base64

    b64 = compact.split(".", 1)[0]
    pad = "=" * (-len(b64) % 4)
    return json.loads(base64.urlsafe_b64decode(b64 + pad))
