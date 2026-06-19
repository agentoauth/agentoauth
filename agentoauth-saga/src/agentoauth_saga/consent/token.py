# SPDX-License-Identifier: MIT
"""Consent Token issuance (Signature 1 — the agent's signature).

Builds a saga-scoped consent request, signs the explicit signed-claims subset
with the agent's Ed25519 key as an attached compact JWS, and returns a
:class:`ConsentToken`. The signed claims mirror AgentOAuth's payload shape
(``agent``/``scope``/``exp``/``nonce``) plus saga linkage.
"""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from jwcrypto import jwk

from ..models import Action, ConsentToken
from ..policy.engine import policy_hash_for
from .jwk import sign_compact

CONSENT_VER = "saga.consent.v0"
DEFAULT_TTL_SECONDS = 3600


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.replace(microsecond=0).isoformat()


def issue_token(
    saga_id: str,
    step_id: str,
    parent_receipt_id: Optional[str],
    agent_id: str,
    action: Action,
    policy_ref: str,
    agent_key: jwk.JWK,
    ttl_seconds: int = DEFAULT_TTL_SECONDS,
) -> ConsentToken:
    """Issue and agent-sign a :class:`ConsentToken` for one saga step."""
    issued = _now()
    expiry = issued + timedelta(seconds=ttl_seconds)
    policy_hash = policy_hash_for(policy_ref)
    jti = str(uuid.uuid4())
    nonce = uuid.uuid4().hex

    claims = {
        "ver": CONSENT_VER,
        "jti": jti,
        "saga_id": saga_id,
        "step_id": step_id,
        "parent_receipt_id": parent_receipt_id,
        "agent": agent_id,
        "action": action.model_dump(),
        "scope": action.type,
        "policy_ref": policy_ref,
        "policy_hash": policy_hash,
        "nonce": nonce,
        "iat": int(issued.timestamp()),
        "exp": int(expiry.timestamp()),
    }
    signature = sign_compact(claims, agent_key)

    return ConsentToken(
        saga_id=saga_id,
        step_id=step_id,
        parent_receipt_id=parent_receipt_id,
        agent_id=agent_id,
        action=action,
        policy_ref=policy_ref,
        policy_hash=policy_hash,
        issued_at=_iso(issued),
        expiry=_iso(expiry),
        signature=signature,
    )


def consent_token_hash(token: ConsentToken) -> str:
    """``"sha256:" + sha256(compact JWS string)`` — binds the exact signed bytes."""
    digest = hashlib.sha256(token.signature.encode("utf-8")).hexdigest()
    return f"sha256:{digest}"
