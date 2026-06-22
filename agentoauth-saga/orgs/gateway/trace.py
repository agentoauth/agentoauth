# SPDX-License-Identifier: MIT
"""Build the visual trace from a real handshake outcome.

Every field here is a genuine artifact produced by the actual buyer→supplier A2A
handshake — the frontend only choreographs the timing. The two signatures
(``token.signature`` = Sig 1, ``receipt.verifier_signature`` = Sig 2) and the
``consent_token_hash`` binding are re-verified in the browser.
"""

from __future__ import annotations

import base64
import json
from typing import Any

from agentoauth_saga.models import Action
from orgs.buyer.client import OrderOutcome


def _decode_jws(compact: str | None) -> dict[str, Any]:
    """Decode a compact JWS header + payload for display (no verification)."""
    if not compact or compact.count(".") != 2:
        return {}
    head_b64, payload_b64, _ = compact.split(".")

    def _seg(b64: str) -> Any:
        pad = "=" * (-len(b64) % 4)
        return json.loads(base64.urlsafe_b64decode(b64 + pad))

    try:
        return {"header": _seg(head_b64), "payload": _seg(payload_b64)}
    except Exception:
        return {}


def build_trace(scenario: str, action: Action, outcome: OrderOutcome) -> dict[str, Any]:
    token = outcome.token
    receipt = outcome.receipt
    decision = outcome.decision or {}

    return {
        "scenario": scenario,
        "buyer": {"org": "Org A", "framework": "LangGraph", "agent_id": token.agent_id if token else None},
        "supplier": {"org": "Org B", "framework": "CrewAI"},
        "request": {
            "sku": action.entity,
            "amount": action.params.get("amount"),
            "currency": action.params.get("currency", "USD"),
            "supplier": action.params.get("supplier"),
            "max_amount": action.limits.get("max_amount"),
        },
        # Signature 1 — the agent-issued Consent Token.
        "token": {
            "model": token.model_dump(mode="json") if token else None,
            "signature": token.signature if token else None,
            "decoded": _decode_jws(token.signature if token else None),
            "agent_jwk": outcome.agent_jwk,
        },
        # The on-the-wire A2A envelope: the token rides in message metadata.
        "wire": {
            "transport": "A2A",
            "metadata_key": "agentoauth",
            "skill": "place_order",
        },
        # The verifier's pre-act decision (real policy evaluation).
        "verify": {
            "agent_signature_checked": True,
            "verdict": receipt.verdict.value if receipt else None,
            "decision_basis": receipt.decision_basis if receipt else [],
            "reason": receipt.reason if receipt else None,
            "quoted_price": decision.get("quoted_price"),
            "max_amount": action.limits.get("max_amount"),
        },
        # The CrewAI supplier's reasoning over its private inventory.
        "crew": {
            "used_llm": decision.get("used_llm"),
            "category": decision.get("category"),
            "reasoning": decision.get("reason"),
            "order_id": decision.get("order_id"),
        },
        # Signature 2 — the verifier-issued Consent Receipt.
        "receipt": {
            "model": receipt.model_dump(mode="json") if receipt else None,
            "signature": receipt.verifier_signature if receipt else None,
            "decoded": _decode_jws(receipt.verifier_signature if receipt else None),
            "verifier_jwk": outcome.verifier_jwk,
            "consent_token_hash": receipt.consent_token_hash if receipt else None,
            "executed": receipt.executed if receipt else None,
        },
        "a2a_state": outcome.state,
        "receipt_valid_server": outcome.receipt_valid,
    }
