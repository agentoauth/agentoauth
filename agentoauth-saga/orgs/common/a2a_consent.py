# SPDX-License-Identifier: MIT
"""Bridge between A2A transport and the AgentOAuth authority layer.

This is the ONLY place A2A and AgentOAuth meet. It defines:
  * how a buyer attaches a policy-bound Consent Token to an outgoing A2A message,
  * how the supplier extracts and reconstructs it server-side,
  * how the supplier returns a signed Consent Receipt as an A2A data artifact,
  * how the buyer reads + verifies that receipt.

Key distribution (demo): each signed object travels with the signer's *public*
JWK so the other org can verify offline — the buyer's agent public key rides with
the token, the supplier's verifier public key rides with the receipt. This mirrors
the repo's "embed public JWKS" pattern. In production these would be resolved from
each org's published JWKS endpoint / Agent Card rather than trusted on first use.

The AgentOAuth CORE stays transport-agnostic; this module imports both ``a2a`` and
``agentoauth_saga`` but lives under ``orgs/`` so the core never depends on A2A.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any, Optional

from a2a.types import DataPart, Message, Part

from agentoauth_saga.models import ConsentReceipt, ConsentToken

# A2A skill the supplier exposes and the security scheme the card advertises.
PLACE_ORDER_SKILL = "place_order"
CONSENT_SECURITY_SCHEME = "agentoauth_consent"

# Metadata / data-part keys.
_META_KEY = "agentoauth"
_RECEIPT_KEY = "agentoauth_receipt"


# --- buyer side: attach token / read receipt ------------------------------
def build_order_message(
    text: str,
    token: ConsentToken,
    agent_public_jwk: dict[str, Any],
) -> dict[str, Any]:
    """Build the A2A ``message`` payload carrying the consent token in metadata."""
    return {
        "role": "user",
        "parts": [{"kind": "text", "text": text}],
        "messageId": uuid.uuid4().hex,
        "metadata": {
            _META_KEY: {
                "consent_token": token.model_dump(mode="json"),
                "agent_jwk": agent_public_jwk,
            }
        },
    }


@dataclass
class ReceiptResult:
    receipt: Optional[ConsentReceipt]
    verifier_jwk: Optional[dict[str, Any]]
    decision: dict[str, Any]
    state: str  # the A2A task state: completed | rejected | failed | auth_required | ...


def _scan_parts_for_receipt(parts) -> Optional[dict[str, Any]]:
    for part in parts or []:
        root = getattr(part, "root", part)
        data = getattr(root, "data", None)
        if isinstance(data, dict) and _RECEIPT_KEY in data:
            return data
    return None


def extract_receipt(result: Any) -> ReceiptResult:
    """Parse the supplier's A2A result (Task with artifacts, or a Message).

    Returns the signed receipt, the supplier's verifier public JWK, the decision
    summary, and the A2A task state.
    """
    state = getattr(getattr(getattr(result, "status", None), "state", None), "value", "") or ""
    # Task path: look through artifacts' parts.
    data = None
    for artifact in getattr(result, "artifacts", None) or []:
        data = _scan_parts_for_receipt(getattr(artifact, "parts", None))
        if data:
            break
    # Message path: look through message parts.
    if data is None:
        data = _scan_parts_for_receipt(getattr(result, "parts", None))
    if data is None:
        return ReceiptResult(None, None, {}, state)
    receipt = ConsentReceipt.model_validate(data[_RECEIPT_KEY])
    return ReceiptResult(receipt, data.get("verifier_jwk"), data.get("decision", {}), state)


# --- supplier side: read token / return receipt ---------------------------
def extract_consent(message: Message) -> tuple[Optional[ConsentToken], Optional[dict[str, Any]]]:
    """Server-side: reconstruct the consent token + buyer agent JWK from metadata."""
    meta = (getattr(message, "metadata", None) or {})
    payload = meta.get(_META_KEY)
    if not isinstance(payload, dict) or "consent_token" not in payload:
        return None, None
    token = ConsentToken.model_validate(payload["consent_token"])
    return token, payload.get("agent_jwk")


def receipt_artifact_parts(
    receipt: ConsentReceipt,
    verifier_public_jwk: dict[str, Any],
    decision: dict[str, Any],
) -> list[Part]:
    """Build the A2A artifact parts carrying the signed receipt + verifier key."""
    data = {
        _RECEIPT_KEY: receipt.model_dump(mode="json"),
        "verifier_jwk": verifier_public_jwk,
        "decision": decision,
    }
    return [Part(root=DataPart(data=data))]


def note_parts(text: str) -> list[Part]:
    """A small data part for non-receipt notes (e.g. auth-required)."""
    return [Part(root=DataPart(data={"note": text}))]
