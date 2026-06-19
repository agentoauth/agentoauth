# SPDX-License-Identifier: MIT
"""Thin saga orchestrator (a demo harness — NOT the product).

The product is the authority+accountability core (consent + verifier + policy +
receipts). This module only *sequences*: for each consequential step it builds an
action, issues a consent token, asks the verifier for a decision, proceeds only on
ALLOW (CONFIRM auto-approves in demo with a logged note), and on DENY/failure
compensates prior committed steps in reverse — each compensation getting its own
token + receipt with ``compensation_of`` set.

It is intentionally framework-agnostic: it does NOT import LangGraph. The LangGraph
demo in ``agents/`` calls into this orchestrator and threads ``last_receipt_id``.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any, Optional

from jwcrypto import jwk

from ..consent.jwk import public_jwk_dict
from ..consent.keys import KeyRing
from ..consent.token import issue_token
from ..models import Action, ConsentReceipt, SagaState, Verdict
from ..receipts.reconcile import reconcile
from ..receipts.store import ReceiptStore
from ..systems.erp_stub import ExecutionError
from ..verifier.verifier import LocalVerifier

# Forward action type -> compensating action type (for receipt/audit clarity).
_COMPENSATION_TYPE = {
    "inventory.approve": "inventory.revert",
    "budget.allocate": "budget.void",
    "order.place": "order.cancel",
}


@dataclass
class Step:
    """One consequential saga step the orchestrator authorizes and executes."""

    step_id: str
    agent_id: str
    action: Action
    system: Any  # object exposing execute(action) / compensate(action)
    live_state: Optional[dict[str, Any]] = None
    policy_ref: str = "reorder"


@dataclass
class _Committed:
    step: Step
    receipt: ConsentReceipt


@dataclass
class Orchestrator:
    saga_id: str
    keyring: KeyRing = field(default_factory=lambda: KeyRing(os.environ.get("SAGA_KEY_SEED")))
    verifier: Optional[LocalVerifier] = None
    store: Optional[ReceiptStore] = None
    auto_confirm: bool = field(default_factory=lambda: os.environ.get("SAGA_AUTO_CONFIRM", "1") != "0")
    log: list[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        if self.verifier is None:
            self.verifier = LocalVerifier(self.keyring.verifier_key())
        if self.store is None:
            self.store = ReceiptStore()
        self._committed: list[_Committed] = []
        self._last_receipt_id: Optional[str] = None
        self.store.register_keys([self.verifier.public_jwk])

    # -- key helpers --------------------------------------------------------
    def _agent_key(self, agent_id: str) -> jwk.JWK:
        key = self.keyring.agent_key(agent_id)
        self.store.register_keys([public_jwk_dict(key)])
        return key

    # -- forward step -------------------------------------------------------
    def run_step(self, step: Step) -> ConsentReceipt:
        """Authorize and (on ALLOW/CONFIRM) execute one forward step.

        Returns the appended receipt. Updates ``last_receipt_id`` so the next step
        links to it. On DENY or execution failure, triggers compensation of all
        prior committed steps in reverse before returning.
        """
        agent_key = self._agent_key(step.agent_id)
        token = issue_token(
            self.saga_id, step.step_id, self._last_receipt_id,
            step.agent_id, step.action, step.policy_ref, agent_key,
        )
        receipt = self.verifier.verify(token, step.live_state, public_jwk_dict(agent_key))

        if receipt.verdict == Verdict.DENY:
            self.log.append(f"[{step.step_id}] DENY: {receipt.reason}")
            self._finish_receipt(receipt, executed=False)
            self._compensate_all()
            return receipt

        if receipt.verdict == Verdict.CONFIRM:
            if not self.auto_confirm:
                self.log.append(f"[{step.step_id}] CONFIRM required — halting (auto-confirm off)")
                receipt.metadata = {**receipt.metadata, "confirm_pending": True}
                self._finish_receipt(receipt, executed=False)
                return receipt
            note = "CONFIRM auto-approved in demo (human gate bypassed)"
            self.log.append(f"[{step.step_id}] {note}: {receipt.reason}")
            receipt.metadata = {**receipt.metadata, "confirm_auto_approved": True, "note": note}

        # ALLOW (or auto-approved CONFIRM): execute the side effect.
        try:
            result = step.system.execute(step.action)
            receipt.executed = True
            receipt.metadata = {**receipt.metadata, "exec": {"status": "OK"}, "result": result}
            self._committed.append(_Committed(step, receipt))
            self.log.append(f"[{step.step_id}] {receipt.verdict.value} -> executed: {result}")
            self._finish_receipt(receipt, executed=True)
            return receipt
        except ExecutionError as exc:
            receipt.executed = False
            receipt.metadata = {**receipt.metadata, "exec": {"status": "FAILED", "error": str(exc)}}
            self.log.append(f"[{step.step_id}] execution FAILED: {exc}")
            self._finish_receipt(receipt, executed=False)
            self._compensate_all()
            return receipt

    # -- compensation -------------------------------------------------------
    def _compensate_all(self) -> list[ConsentReceipt]:
        """Compensate every committed step in reverse order."""
        comp_receipts: list[ConsentReceipt] = []
        for committed in reversed(self._committed):
            comp_receipts.append(self._compensate(committed))
        self._committed.clear()
        return comp_receipts

    def _compensate(self, committed: _Committed) -> ConsentReceipt:
        step = committed.step
        comp_type = _COMPENSATION_TYPE.get(step.action.type, f"{step.action.type}.compensate")
        comp_action = Action(
            type=comp_type, entity=step.action.entity,
            params=dict(step.action.params), limits=dict(step.action.limits),
        )
        agent_key = self._agent_key(step.agent_id)
        token = issue_token(
            self.saga_id, f"{step.step_id}.compensate", self._last_receipt_id,
            step.agent_id, comp_action, step.policy_ref, agent_key,
        )
        # Compensations are reversals — evaluate without a budget constraint.
        receipt = self.verifier.verify(
            token, None, public_jwk_dict(agent_key),
            compensation_of=committed.receipt.receipt_id,
        )
        try:
            result = step.system.compensate(step.action)
            receipt.executed = True
            receipt.metadata = {**receipt.metadata, "exec": {"status": "OK"}, "result": result}
            self.log.append(f"[{step.step_id}.compensate] compensated: {result}")
        except ExecutionError as exc:
            receipt.executed = False
            receipt.metadata = {
                **receipt.metadata,
                "exec": {"status": "FAILED", "compensation_fails": True, "error": str(exc)},
            }
            self.log.append(f"[{step.step_id}.compensate] COMPENSATION FAILED: {exc}")
        self._finish_receipt(receipt, executed=receipt.executed)
        return receipt

    # -- bookkeeping --------------------------------------------------------
    def _finish_receipt(self, receipt: ConsentReceipt, executed: bool) -> None:
        receipt.executed = executed
        self.store.append(receipt)
        self._last_receipt_id = receipt.receipt_id

    @property
    def last_receipt_id(self) -> Optional[str]:
        return self._last_receipt_id

    # -- high-level convenience (used by demos/tests) -----------------------
    def run_saga(self, steps: list[Step]) -> SagaState:
        """Run forward steps until one is denied/fails, then reconcile."""
        for step in steps:
            receipt = self.run_step(step)
            if receipt.verdict == Verdict.DENY or (
                receipt.metadata.get("exec", {}).get("status") == "FAILED"
            ):
                break
        return self.reconcile()

    def reconcile(self) -> SagaState:
        chain = self.store.get_chain(self.saga_id)
        return reconcile(chain, self.store.jwks, self.saga_id)
