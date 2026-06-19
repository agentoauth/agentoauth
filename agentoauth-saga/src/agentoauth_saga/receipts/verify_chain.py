# SPDX-License-Identifier: MIT
"""Offline verification of a receipt chain.

``verify_chain`` confirms, using only the embedded public JWKS (no network, no
verifier call), that for a saga:
  1. every receipt's ``verifier_signature`` is a valid EdDSA JWS,
  2. the signed payload still matches the stored receipt fields (no tampering),
  3. the receipts form an intact single linked list via ``parent_receipt_id``,
  4. each ``compensation_of`` points at an earlier receipt in the chain.
"""

from __future__ import annotations

from typing import Any

from ..consent.jwk import verify_with_jwks
from ..models import ConsentReceipt

# Maps model field -> signed-JWS claim key. A mismatch on any of these => tamper.
_BOUND_FIELDS = {
    "receipt_id": "id",
    "saga_id": "saga_id",
    "step_id": "step_id",
    "consent_token_hash": "consent_token_hash",
    "parent_receipt_id": "parent_receipt_id",
    "compensation_of": "compensation_of",
    "verdict": "decision",
}


def verify_receipt_signature(receipt: ConsentReceipt, jwks: list[dict[str, Any]]) -> bool:
    """Verify a single receipt's signature and field binding against the JWKS."""
    if not receipt.verifier_signature:
        return False
    try:
        claims = verify_with_jwks(receipt.verifier_signature, jwks)
    except Exception:
        return False
    model = receipt.model_dump(mode="json")
    for field, claim_key in _BOUND_FIELDS.items():
        if claims.get(claim_key) != model.get(field):
            return False
    return True


def verify_chain(
    receipts: list[ConsentReceipt],
    jwks: list[dict[str, Any]],
) -> tuple[bool, list[str]]:
    """Return ``(ok, problems)`` for an ordered receipt chain."""
    problems: list[str] = []
    seen: set[str] = set()
    prev_id: str | None = None

    for i, r in enumerate(receipts):
        if not verify_receipt_signature(r, jwks):
            problems.append(f"{r.receipt_id}: invalid signature or tampered fields")
        if r.parent_receipt_id != prev_id:
            problems.append(
                f"{r.receipt_id}: broken link (parent={r.parent_receipt_id}, expected={prev_id})"
            )
        if r.compensation_of is not None and r.compensation_of not in seen:
            problems.append(
                f"{r.receipt_id}: compensation_of '{r.compensation_of}' not an earlier receipt"
            )
        seen.add(r.receipt_id)
        prev_id = r.receipt_id

    return (len(problems) == 0, problems)
