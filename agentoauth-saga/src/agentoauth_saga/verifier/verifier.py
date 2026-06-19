# SPDX-License-Identifier: MIT
"""Local in-process Verifier (Signature 2 — the verifier's signature).

Validates a :class:`ConsentToken` against policy + optional live state and issues
a signed, linked :class:`ConsentReceipt`. This is the default, offline path; an
optional hosted adapter lives in ``hosted_adapter.py``.

The verifier is framework-agnostic — it never imports LangGraph.
"""

from __future__ import annotations

import os
import secrets
from datetime import datetime, timezone
from typing import Any, Optional

from jwcrypto import jwk

from ..consent.jwk import sign_compact, verify_compact, public_jwk_dict
from ..consent.token import consent_token_hash
from ..models import ConsentReceipt, ConsentToken, Verdict
from .policy_eval import evaluate_for_verifier

RECEIPT_VER = "receipt.saga.v0"


def _new_receipt_id() -> str:
    return f"receipt_{secrets.token_hex(16)}"


class LocalVerifier:
    """Verifies tokens and issues signed receipts with one verifier key."""

    def __init__(self, verifier_key: jwk.JWK) -> None:
        self._key = verifier_key

    @property
    def public_jwk(self) -> dict[str, Any]:
        return public_jwk_dict(self._key)

    def verify(
        self,
        token: ConsentToken,
        live_state: Optional[dict[str, Any]] = None,
        agent_public_jwk: Optional[dict[str, Any]] = None,
        compensation_of: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> ConsentReceipt:
        """Validate ``token`` and return a signed, linked :class:`ConsentReceipt`.

        If ``agent_public_jwk`` is supplied the token's agent signature is checked;
        a bad signature yields a DENY receipt (the failure is itself recorded).
        """
        meta: dict[str, Any] = dict(metadata or {})
        basis: list[str]

        # 1. Verify the agent's signature on the token (when we have its key).
        if agent_public_jwk is not None:
            try:
                from ..consent.jwk import jwk_from_dict

                verify_compact(token.signature, jwk_from_dict(agent_public_jwk))
            except Exception as exc:  # noqa: BLE001
                return self._issue(
                    token,
                    Verdict.DENY,
                    [f"agent_signature_invalid: {exc}"],
                    token.policy_ref,
                    token.policy_hash,
                    reason="invalid agent signature",
                    remaining={},
                    compensation_of=compensation_of,
                    metadata=meta,
                )

        # 2. Evaluate policy.
        verdict, basis, policy_id, policy_hash = evaluate_for_verifier(
            token.action, live_state, token.policy_ref
        )
        reason = "; ".join(basis)

        remaining: dict[str, Any] = {}
        if live_state and live_state.get("budget_available") is not None:
            amount = token.action.params.get("amount", 0) or 0
            if verdict != Verdict.DENY:
                remaining = {
                    "amount": live_state["budget_available"] - amount,
                    "currency": token.action.params.get("currency", "USD"),
                }

        return self._issue(
            token,
            verdict,
            basis,
            policy_id,
            policy_hash,
            reason=reason,
            remaining=remaining,
            compensation_of=compensation_of,
            metadata=meta,
        )

    # -- internal -----------------------------------------------------------
    def _issue(
        self,
        token: ConsentToken,
        verdict: Verdict,
        basis: list[str],
        policy_id: str,
        policy_hash: str,
        reason: str,
        remaining: dict[str, Any],
        compensation_of: Optional[str],
        metadata: dict[str, Any],
    ) -> ConsentReceipt:
        receipt_id = _new_receipt_id()
        ts = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
        token_hash = consent_token_hash(token)

        claims = {
            "version": RECEIPT_VER,
            "id": receipt_id,
            "saga_id": token.saga_id,
            "step_id": token.step_id,
            "consent_token_hash": token_hash,
            "parent_receipt_id": token.parent_receipt_id,
            "compensation_of": compensation_of,
            "policy_id": policy_id,
            "policy_hash": policy_hash,
            "decision": verdict.value,
            "reason": reason,
            "decision_basis": basis,
            "timestamp": int(datetime.now(timezone.utc).timestamp()),
            "remaining": remaining,
            "metadata": metadata,
            "iat": int(datetime.now(timezone.utc).timestamp()),
        }
        signature = sign_compact(claims, self._key)

        return ConsentReceipt(
            receipt_id=receipt_id,
            saga_id=token.saga_id,
            step_id=token.step_id,
            parent_receipt_id=token.parent_receipt_id,
            consent_token_hash=token_hash,
            verdict=verdict,
            decision_basis=basis,
            executed=False,
            compensation_of=compensation_of,
            policy_id=policy_id,
            policy_hash=policy_hash,
            reason=reason,
            remaining=remaining,
            metadata=metadata,
            ts=ts,
            verifier_signature=signature,
        )


def default_verifier() -> LocalVerifier:
    """Construct a verifier with an ephemeral (or env/seed) verifier key."""
    from ..consent.keys import KeyRing

    seed = os.environ.get("SAGA_KEY_SEED")
    return LocalVerifier(KeyRing(seed=seed).verifier_key())
