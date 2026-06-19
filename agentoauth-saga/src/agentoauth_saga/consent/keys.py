# SPDX-License-Identifier: MIT
"""Key management for the demo: ephemeral by default, env-configurable.

No secrets in code. Private keys are loaded from ``SAGA_*`` env JWK JSON when
present, otherwise generated ephemerally in process memory. Only *public* JWKs
are ever exported into a saga.json dump. Set ``SAGA_KEY_SEED`` for reproducible
(diffable) demo dumps.
"""

from __future__ import annotations

import hashlib
import json
import os
from typing import Any

from jwcrypto import jwk

from .jwk import generate_okp_jwk, public_jwk_dict, jwk_from_dict

VERIFIER_KEY_ID = "__verifier__"


class KeyRing:
    """Holds private signing keys (verifier + agents) and exports a public JWKS.

    Keys are resolved in this order per identity:
      1. env JWK JSON  — ``SAGA_VERIFIER_PRIVATE_JWK`` / ``SAGA_AGENT_PRIVATE_JWK_<ID>``
      2. ``SAGA_KEY_SEED``-derived deterministic key (stable demo dumps)
      3. random ephemeral key
    """

    def __init__(self, seed: str | None = None) -> None:
        self._seed = seed if seed is not None else os.environ.get("SAGA_KEY_SEED")
        self._keys: dict[str, jwk.JWK] = {}

    # -- private key access -------------------------------------------------
    def verifier_key(self) -> jwk.JWK:
        return self._resolve(VERIFIER_KEY_ID, "SAGA_VERIFIER_PRIVATE_JWK")

    def agent_key(self, agent_id: str) -> jwk.JWK:
        env = f"SAGA_AGENT_PRIVATE_JWK_{_env_token(agent_id)}"
        return self._resolve(agent_id, env)

    def _resolve(self, identity: str, env_var: str) -> jwk.JWK:
        if identity in self._keys:
            return self._keys[identity]
        raw = os.environ.get(env_var)
        if raw:
            key = jwk_from_dict(json.loads(raw))
            key["kid"] = key.get("kid") or key.thumbprint()
        elif self._seed is not None:
            derived = hashlib.sha256(f"{self._seed}:{identity}".encode()).digest()
            key = generate_okp_jwk(seed=derived)
        else:
            key = generate_okp_jwk()
        self._keys[identity] = key
        return key

    # -- public material ----------------------------------------------------
    def public_jwks(self) -> list[dict[str, Any]]:
        """Public-only JWKS for every key materialised so far (for saga.json)."""
        return [public_jwk_dict(k) for k in self._keys.values()]


def _env_token(agent_id: str) -> str:
    return "".join(c if c.isalnum() else "_" for c in agent_id).upper()
