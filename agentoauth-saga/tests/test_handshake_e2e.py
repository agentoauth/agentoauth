# SPDX-License-Identifier: MIT
"""WS2 e2e: the cross-framework handshake over REAL A2A (separate processes).

Launches the CrewAI supplier as a subprocess and drives it with the LangGraph-side
A2A client. No in-process shortcut — the A<->B leg crosses an HTTP wire.
"""

from __future__ import annotations

import asyncio

from agentoauth_saga.consent.keys import KeyRing
from agentoauth_saga.models import Action, Verdict
from agentoauth_saga.receipts.verify_chain import verify_receipt_signature

from demos._a2a_harness import supplier_process
from orgs.buyer.client import place_order_via_a2a

PORT = 9971


def _action(amount=40000, supplier="acme"):
    return Action(type="order.place", entity="order:XYZ",
                  params={"amount": amount, "supplier": supplier, "currency": "USD"},
                  limits={"max_amount": 50000, "supplier_allowlist": ["acme"]})


def _run(mode: str, action: Action):
    with supplier_process(mode=mode, port=PORT, seed="test-org-b") as url:
        keyring = KeyRing(seed="test-org-a")
        return asyncio.run(place_order_via_a2a(
            supplier_url=url, saga_id="t", step_id="buyer",
            parent_receipt_id=None, action=action, keyring=keyring,
        ))


def test_available_completes_with_valid_receipt():
    out = _run("available", _action())
    assert out.state == "completed"
    assert out.receipt is not None and out.receipt.verdict == Verdict.ALLOW
    assert out.receipt.executed is True
    # Receipt verifies offline against the supplier's verifier key (carried with it).
    assert out.receipt_valid
    assert verify_receipt_signature(out.receipt, [out.verifier_jwk])


def test_out_of_stock_fails_but_receipt_still_signed():
    out = _run("out_of_stock", _action())
    assert out.state == "failed"
    assert out.receipt.verdict == Verdict.ALLOW and out.receipt.executed is False
    assert out.receipt_valid  # accountability even on failure


def test_price_violation_is_authority_denied():
    out = _run("price_violation", _action())
    assert out.state == "rejected"
    assert out.receipt.verdict == Verdict.DENY
    assert out.receipt_valid


def test_missing_token_yields_auth_required():
    # Send straight through the A2A client without a consent token.
    import uuid
    import httpx
    from a2a.client import A2ACardResolver, A2AClient
    from a2a.types import MessageSendParams, SendMessageRequest

    async def _bare():
        with supplier_process(mode="available", port=PORT, seed="test-org-b") as url:
            async with httpx.AsyncClient(timeout=30) as hc:
                card = await A2ACardResolver(httpx_client=hc, base_url=url).get_agent_card()
                client = A2AClient(httpx_client=hc, agent_card=card)
                msg = {"message": {"role": "user",
                                   "parts": [{"kind": "text", "text": "place an order"}],
                                   "messageId": uuid.uuid4().hex}}
                resp = await client.send_message(
                    SendMessageRequest(id=uuid.uuid4().hex, params=MessageSendParams(**msg)))
                return resp.root.result

    result = asyncio.run(_bare())
    state = result.status.state.value
    assert state == "auth-required", state
