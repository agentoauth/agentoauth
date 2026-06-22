# SPDX-License-Identifier: MIT
"""Org A — the buyer's A2A client (initiator).

Issues a policy-bound AgentOAuth consent token, delegates ``place_order`` to the
supplier over A2A with the token attached, then verifies the returned signed
receipt offline. Framework-agnostic transport glue; the LangGraph buyer node
(``orgs/buyer/graph.py``) calls into this.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any, Optional

import httpx
from a2a.client import A2ACardResolver, A2AClient
from a2a.types import MessageSendParams, SendMessageRequest

from agentoauth_saga.consent.jwk import public_jwk_dict
from agentoauth_saga.consent.keys import KeyRing
from agentoauth_saga.consent.token import issue_token
from agentoauth_saga.models import Action, ConsentReceipt, ConsentToken
from agentoauth_saga.receipts.verify_chain import verify_receipt_signature

from orgs.common.a2a_consent import build_order_message, extract_receipt

BUYER_AGENT_ID = "buyer@org-a"


@dataclass
class OrderOutcome:
    state: str                                  # A2A task state: completed|rejected|failed|auth_required
    receipt: Optional[ConsentReceipt]
    receipt_valid: bool                         # signature verified offline against the supplier's JWK
    verifier_jwk: Optional[dict[str, Any]]
    decision: dict[str, Any]
    token: Optional[ConsentToken] = None        # the agent-signed Consent Token (Signature 1)
    agent_jwk: Optional[dict[str, Any]] = None  # buyer's public key, to verify Signature 1 offline


async def place_order_via_a2a(
    supplier_url: str,
    saga_id: str,
    step_id: str,
    parent_receipt_id: Optional[str],
    action: Action,
    keyring: KeyRing,
    policy_ref: str = "reorder",
    timeout: float = 60.0,
) -> OrderOutcome:
    """Delegate one ``order.place`` to the supplier over A2A and verify the receipt."""
    agent_key = keyring.agent_key(BUYER_AGENT_ID)
    token = issue_token(saga_id, step_id, parent_receipt_id, BUYER_AGENT_ID,
                        action, policy_ref, agent_key)

    message = build_order_message(
        text=f"Place order for {action.entity} (supplier={action.params.get('supplier')}, "
             f"amount={action.params.get('amount')} {action.params.get('currency', 'USD')})",
        token=token,
        agent_public_jwk=public_jwk_dict(agent_key),
    )

    async with httpx.AsyncClient(timeout=timeout) as hc:
        card = await A2ACardResolver(httpx_client=hc, base_url=supplier_url).get_agent_card()
        client = A2AClient(httpx_client=hc, agent_card=card)
        req = SendMessageRequest(id=uuid.uuid4().hex, params=MessageSendParams(**{"message": message}))
        resp = await client.send_message(req)

    result = resp.root.result  # Task (or Message)
    parsed = extract_receipt(result)

    receipt_valid = False
    if parsed.receipt is not None and parsed.verifier_jwk is not None:
        receipt_valid = verify_receipt_signature(parsed.receipt, [parsed.verifier_jwk])

    return OrderOutcome(
        state=parsed.state,
        receipt=parsed.receipt,
        receipt_valid=receipt_valid,
        verifier_jwk=parsed.verifier_jwk,
        decision=parsed.decision,
        token=token,
        agent_jwk=public_jwk_dict(agent_key),
    )
