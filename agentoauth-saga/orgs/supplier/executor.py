# SPDX-License-Identifier: MIT
"""Supplier A2A AgentExecutor: verify authority BEFORE acting, then return a receipt.

Flow per incoming ``place_order`` task:
  1. Extract the AgentOAuth consent token from the A2A message (orgs.common bridge).
     Missing  -> A2A ``auth_required`` state, no receipt (nothing was authorized).
  2. Compute the supplier's private quote and VERIFY the token with the AgentOAuth
     ``LocalVerifier`` (agent signature + policy + quoted price vs the authorized
     limit). DENY -> A2A ``rejected`` state, carrying a signed denial receipt.
  3. On ALLOW, ask the CrewAI crew to fulfil (reasoning over private inventory):
       fulfilled          -> A2A ``completed`` + signed receipt (executed=True)
       fulfilment failure -> A2A ``failed``    + signed receipt (executed=False)

Every authorized outcome returns a signed, self-verifying Consent Receipt as the
A2A artifact — that is the accountability the transport leaves to implementers.
"""

from __future__ import annotations

from a2a.server.agent_execution import AgentExecutor, RequestContext
from a2a.server.events import EventQueue
from a2a.server.tasks import TaskUpdater
from a2a.types import TaskState

from agentoauth_saga.models import Verdict
from agentoauth_saga.verifier.verifier import LocalVerifier

from orgs.common.a2a_consent import (
    extract_consent,
    note_parts,
    receipt_artifact_parts,
)
from orgs.supplier.crew import SupplierCrew
from orgs.supplier.inventory import OrderRequest, SupplierInventory


class SupplierExecutor(AgentExecutor):
    def __init__(self, verifier: LocalVerifier, inventory: SupplierInventory) -> None:
        self._verifier = verifier
        self._inventory = inventory
        self._crew = SupplierCrew(inventory)
        self._verifier_jwk = verifier.public_jwk

    async def execute(self, context: RequestContext, event_queue: EventQueue) -> None:
        updater = TaskUpdater(event_queue, context.task_id, context.context_id)
        if not context.current_task:
            await updater.submit()
        await updater.start_work()

        token, agent_jwk = extract_consent(context.message)
        if token is None:
            await updater.requires_auth(
                updater.new_agent_message(note_parts("consent token required to place an order")),
                final=True,
            )
            return

        # Build the order request from the token's action and compute a private quote.
        action = token.action
        request = OrderRequest(
            sku=action.entity,
            requested_amount=float(action.params.get("amount", 0) or 0),
            currency=str(action.params.get("currency", "USD")),
            max_amount=action.limits.get("max_amount"),
            supplier_name=str(action.params.get("supplier", self._inventory.name)),
        )
        quote = self._inventory.quote_for(request)

        # Verify authority BEFORE acting: signature + policy + quoted price vs limit.
        receipt = self._verifier.verify(
            token, live_state={"quoted_amount": quote}, agent_public_jwk=agent_jwk
        )

        if receipt.verdict == Verdict.DENY:
            decision = {"category": "authority_denied", "reason": receipt.reason,
                        "quoted_price": quote, "used_llm": False}
            await updater.add_artifact(
                receipt_artifact_parts(receipt, self._verifier_jwk, decision),
                name="consent-receipt",
            )
            await updater.reject()
            return

        # ALLOW: ask the CrewAI agent to fulfil (reasoning over private inventory).
        crew_decision = self._crew.decide(request)
        d = crew_decision.decision
        decision = {"category": d.category, "reason": crew_decision.reasoning,
                    "quoted_price": d.quoted_price, "order_id": d.order_id,
                    "used_llm": crew_decision.used_llm}

        if d.category == "fulfilled":
            receipt.executed = True
            receipt.metadata = {**receipt.metadata, "exec": {"status": "OK"},
                                "order_id": d.order_id, "supplier_reasoning": crew_decision.reasoning}
            await updater.add_artifact(
                receipt_artifact_parts(receipt, self._verifier_jwk, decision), name="consent-receipt")
            await updater.complete()
        else:  # fulfillment_failed
            receipt.executed = False
            receipt.metadata = {**receipt.metadata,
                                "exec": {"status": "FAILED", "error": d.reason},
                                "supplier_reasoning": crew_decision.reasoning}
            await updater.add_artifact(
                receipt_artifact_parts(receipt, self._verifier_jwk, decision), name="consent-receipt")
            await updater.update_status(
                TaskState.failed,
                updater.new_agent_message(note_parts(d.reason)),
                final=True,
            )

    async def cancel(self, context: RequestContext, event_queue: EventQueue) -> None:
        raise NotImplementedError("supplier does not support task cancellation")
