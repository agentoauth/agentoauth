# SPDX-License-Identifier: MIT
"""Verifier issues correctly-signed, linked, self-verifying receipts."""

from __future__ import annotations

from agentoauth_saga.consent.jwk import public_jwk_dict
from agentoauth_saga.consent.keys import KeyRing
from agentoauth_saga.consent.token import consent_token_hash, issue_token
from agentoauth_saga.models import Action, Verdict
from agentoauth_saga.receipts.verify_chain import verify_receipt_signature
from agentoauth_saga.verifier.verifier import LocalVerifier


def _setup():
    ring = KeyRing(seed="test")
    agent_key = ring.agent_key("analyst@demo")
    verifier = LocalVerifier(ring.verifier_key())
    jwks = [public_jwk_dict(agent_key), verifier.public_jwk]
    return ring, agent_key, verifier, jwks


def _order(amount=40000, supplier="acme"):
    return Action(
        type="order.place",
        entity="order:XYZ",
        params={"amount": amount, "supplier": supplier},
        limits={"max_amount": 50000, "supplier_allowlist": ["acme"]},
    )


def test_allow_receipt_is_self_verifying():
    _, agent_key, verifier, jwks = _setup()
    token = issue_token("s1", "step-1", None, "analyst@demo", _order(), "reorder", agent_key)
    receipt = verifier.verify(token, {"budget_available": 60000}, public_jwk_dict(agent_key))

    assert receipt.verdict == Verdict.ALLOW
    assert receipt.consent_token_hash == consent_token_hash(token)
    assert receipt.parent_receipt_id is None
    # Self-verifying offline, no verifier instance needed — just the public JWKS.
    assert verify_receipt_signature(receipt, jwks)


def test_deny_over_threshold():
    _, agent_key, verifier, jwks = _setup()
    token = issue_token("s1", "step-3", "receipt_prev", "buyer@demo", _order(amount=99000), "reorder", agent_key)
    receipt = verifier.verify(token, {"budget_available": 200000})
    assert receipt.verdict == Verdict.DENY
    assert receipt.parent_receipt_id == "receipt_prev"
    assert verify_receipt_signature(receipt, jwks)


def test_bad_agent_signature_denied():
    ring, agent_key, verifier, jwks = _setup()
    token = issue_token("s1", "step-1", None, "analyst@demo", _order(), "reorder", agent_key)
    # Present a DIFFERENT agent's public key -> signature check must fail -> DENY.
    other = ring.agent_key("someone-else@demo")
    receipt = verifier.verify(token, {"budget_available": 60000}, public_jwk_dict(other))
    assert receipt.verdict == Verdict.DENY
    assert any("agent_signature_invalid" in b for b in receipt.decision_basis)


def test_tamper_detected():
    _, agent_key, verifier, jwks = _setup()
    token = issue_token("s1", "step-1", None, "analyst@demo", _order(), "reorder", agent_key)
    receipt = verifier.verify(token, {"budget_available": 60000})
    # Flip the verdict on the stored model without re-signing -> binding check fails.
    receipt.verdict = Verdict.DENY
    assert not verify_receipt_signature(receipt, jwks)
