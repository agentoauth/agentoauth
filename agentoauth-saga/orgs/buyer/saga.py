# SPDX-License-Identifier: MIT
"""Cross-org saga wiring for Org A (buyer).

Builds the Analyst -> Finance -> Buyer steps where the Buyer leg is delegated to
the CrewAI supplier over A2A. The orchestrator stays A2A-agnostic: it receives a
``remote_handler`` callable (built here) that returns the supplier's signed receipt.
"""

from __future__ import annotations

import asyncio
from typing import Any, Optional

from agentoauth_saga.consent.keys import KeyRing
from agentoauth_saga.models import Action
from agentoauth_saga.saga.orchestrator import RemoteResult, Step
from agentoauth_saga.systems.erp_stub import ErpStub
from agentoauth_saga.systems.mongo_stub import MongoStub

from orgs.buyer.client import place_order_via_a2a

_LIMITS = {"max_amount": 50000, "supplier_allowlist": ["acme", "globex", "initech"]}
_AMOUNT = 40000


def a2a_buyer_handler(supplier_url: str, keyring: KeyRing):
    """Build the orchestrator ``remote_handler`` that runs the A2A handshake."""

    def handler(saga_id: str, step: Step, parent_receipt_id: Optional[str]) -> RemoteResult:
        outcome = asyncio.run(
            place_order_via_a2a(
                supplier_url=supplier_url, saga_id=saga_id, step_id=step.step_id,
                parent_receipt_id=parent_receipt_id, action=step.action, keyring=keyring,
            )
        )
        if outcome.receipt is None:
            raise RuntimeError(f"supplier returned no receipt (state={outcome.state})")
        return RemoteResult(receipt=outcome.receipt, verifier_jwk=outcome.verifier_jwk)

    return handler


def build_saga_steps(
    supplier_url: str,
    keyring: KeyRing,
    mongo: Optional[MongoStub] = None,
    erp: Optional[ErpStub] = None,
    entity: str = "order:XYZ",
    amount: int = _AMOUNT,
    supplier: str = "acme",
    limits: Optional[dict[str, Any]] = None,
) -> list[Step]:
    """Analyst (mongo) -> Finance (erp) local; Buyer over A2A to the supplier."""
    mongo = mongo or MongoStub()
    erp = erp or ErpStub()
    limits = limits or _LIMITS

    analyst = Step(
        step_id="analyst", agent_id="analyst@org-a",
        action=Action(type="inventory.approve", entity=entity,
                      params={"amount": amount, "supplier": supplier}, limits=limits),
        system=mongo,
    )
    finance = Step(
        step_id="finance", agent_id="finance@org-a",
        action=Action(type="budget.allocate", entity=entity,
                      params={"amount": amount, "supplier": supplier}, limits=limits),
        system=erp, live_state={"budget_available": 60000},
    )
    buyer = Step(
        step_id="buyer", agent_id="buyer@org-a",
        action=Action(type="order.place", entity=entity,
                      params={"amount": amount, "supplier": supplier, "currency": "USD"}, limits=limits),
        remote_handler=a2a_buyer_handler(supplier_url, keyring),
    )
    return [analyst, finance, buyer]
