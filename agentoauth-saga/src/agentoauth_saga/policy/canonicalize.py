# SPDX-License-Identifier: MIT
"""Policy canonicalization — byte-compatible with AgentOAuth's TS implementation.

Mirrors ``packages/verifier-api/src/policy/canonicalize.ts``:
  1. recursively sort object keys alphabetically,
  2. preserve array order,
  3. compact JSON (no whitespace),
  4. ``"sha256:" + hex``.

Number handling: JS ``JSON.stringify`` renders integral numbers without a
decimal point (``1000`` not ``1000.0``). YAML/JSON loading in Python may yield
``float`` for the same value, so we coerce integral floats to ``int`` before
serializing. Policies here use integer amounts, so this fully matches the TS hash.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any


def _normalize(obj: Any) -> Any:
    if isinstance(obj, bool):
        return obj
    if isinstance(obj, float) and obj.is_integer():
        return int(obj)
    if isinstance(obj, dict):
        return {k: _normalize(obj[k]) for k in sorted(obj.keys())}
    if isinstance(obj, list):
        return [_normalize(v) for v in obj]
    return obj


def canonicalize_policy(policy: dict[str, Any]) -> str:
    """Return the canonical compact-JSON string for a policy dict."""
    return json.dumps(_normalize(policy), separators=(",", ":"), ensure_ascii=False)


def hash_policy(policy: dict[str, Any]) -> str:
    """Return ``"sha256:" + hex`` of the canonicalized policy."""
    canonical = canonicalize_policy(policy)
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return f"sha256:{digest}"


def verify_policy_hash(policy: dict[str, Any], policy_hash: str) -> bool:
    if not policy_hash.startswith("sha256:"):
        return False
    return hash_policy(policy) == policy_hash
