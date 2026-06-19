# SPDX-License-Identifier: MIT
"""Store round-trip + offline chain verification (signatures + parent links)."""

from __future__ import annotations

from agentoauth_saga.consent.jwk import public_jwk_dict
from agentoauth_saga.consent.keys import KeyRing
from agentoauth_saga.consent.token import issue_token
from agentoauth_saga.models import Action
from agentoauth_saga.receipts.store import ReceiptStore
from agentoauth_saga.receipts.verify_chain import verify_chain
from agentoauth_saga.verifier.verifier import LocalVerifier


def _action(t="inventory.approve"):
    return Action(type=t, entity="order:XYZ", params={"amount": 40000, "supplier": "acme"},
                  limits={"max_amount": 50000, "supplier_allowlist": ["acme"]})


def _build_chain(store: ReceiptStore, verifier, agent_key, n=3):
    parent = None
    ids = []
    for i in range(n):
        token = issue_token("saga-A", f"step-{i}", parent, "agent@demo", _action(), "reorder", agent_key)
        receipt = verifier.verify(token, {"budget_available": 100000}, public_jwk_dict(agent_key))
        store.append(receipt)
        parent = receipt.receipt_id
        ids.append(receipt.receipt_id)
    return ids


def test_chain_round_trip_and_verify():
    ring = KeyRing(seed="chain")
    agent_key = ring.agent_key("agent@demo")
    verifier = LocalVerifier(ring.verifier_key())
    store = ReceiptStore()
    store.register_keys([public_jwk_dict(agent_key), verifier.public_jwk])

    ids = _build_chain(store, verifier, agent_key, n=3)
    chain = store.get_chain("saga-A")

    assert [r.receipt_id for r in chain] == ids
    assert chain[0].parent_receipt_id is None
    assert chain[1].parent_receipt_id == ids[0]
    assert chain[2].parent_receipt_id == ids[1]

    ok, problems = verify_chain(chain, store.jwks)
    assert ok, problems


def test_broken_link_detected():
    ring = KeyRing(seed="chain")
    agent_key = ring.agent_key("agent@demo")
    verifier = LocalVerifier(ring.verifier_key())
    store = ReceiptStore()
    store.register_keys([public_jwk_dict(agent_key), verifier.public_jwk])
    _build_chain(store, verifier, agent_key, n=3)

    chain = store.get_chain("saga-A")
    # Drop the middle receipt -> link from index 2 no longer points at index 0.
    broken = [chain[0], chain[2]]
    ok, problems = verify_chain(broken, store.jwks)
    assert not ok
    assert any("broken link" in p for p in problems)


def test_dump_contains_public_keys_only():
    ring = KeyRing(seed="chain")
    agent_key = ring.agent_key("agent@demo")
    verifier = LocalVerifier(ring.verifier_key())
    store = ReceiptStore()
    store.register_keys([public_jwk_dict(agent_key), verifier.public_jwk])
    _build_chain(store, verifier, agent_key, n=2)

    dump = store.dump("saga-A")
    assert dump["saga_id"] == "saga-A"
    assert len(dump["receipts"]) == 2
    assert dump["keys"]
    for k in dump["keys"]:
        assert "d" not in k  # never leak private key material
