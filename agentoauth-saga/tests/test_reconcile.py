# SPDX-License-Identifier: MIT
"""reconcile() produces COMPLETE / COMPENSATED / INCONSISTENT / IN_PROGRESS."""

from __future__ import annotations

from agentoauth_saga.consent.jwk import public_jwk_dict
from agentoauth_saga.consent.keys import KeyRing
from agentoauth_saga.consent.token import issue_token
from agentoauth_saga.models import Action, ReconciledStatus, Verdict
from agentoauth_saga.receipts.reconcile import reconcile
from agentoauth_saga.verifier.verifier import LocalVerifier


class _Harness:
    def __init__(self):
        self.ring = KeyRing(seed="recon")
        self.agent = self.ring.agent_key("agent@demo")
        self.verifier = LocalVerifier(self.ring.verifier_key())
        self.jwks = [public_jwk_dict(self.agent), self.verifier.public_jwk]
        self.parent = None
        self.receipts = []

    def step(self, step_id, amount=40000, supplier="acme", budget=100000,
             exec_status="OK", compensation_of=None, compensation_fails=False):
        action = Action(type="order.place", entity="order:XYZ",
                        params={"amount": amount, "supplier": supplier},
                        limits={"max_amount": 50000, "supplier_allowlist": ["acme"]})
        token = issue_token("saga", step_id, self.parent, "agent@demo", action, "reorder", self.agent)
        receipt = self.verifier.verify(token, {"budget_available": budget},
                                       public_jwk_dict(self.agent), compensation_of=compensation_of)
        # Execution outcome is recorded after the authorization decision is signed.
        if exec_status is not None and receipt.verdict != Verdict.DENY:
            receipt.executed = exec_status == "OK"
            exec_meta = {"status": exec_status}
            if compensation_fails:
                exec_meta["compensation_fails"] = True
            receipt.metadata = {**receipt.metadata, "exec": exec_meta}
        self.parent = receipt.receipt_id
        self.receipts.append(receipt)
        return receipt


def test_complete():
    h = _Harness()
    h.step("step-1")
    h.step("step-2")
    h.step("step-3")
    state = reconcile(h.receipts, h.jwks)
    assert state.reconciled_status == ReconciledStatus.COMPLETE
    assert all(s.status == "DONE" for s in state.steps)
    assert state.unrecovered_steps == []


def test_compensated():
    h = _Harness()
    r1 = h.step("step-1")
    r2 = h.step("step-2")
    h.step("step-3", amount=99000)  # over threshold -> DENY, no execution
    h.step("comp-2", compensation_of=r2.receipt_id)
    h.step("comp-1", compensation_of=r1.receipt_id)
    state = reconcile(h.receipts, h.jwks)
    assert state.reconciled_status == ReconciledStatus.COMPENSATED
    assert state.unrecovered_steps == []
    statuses = {s.step_id: s.status for s in state.steps}
    assert statuses["step-1"] == "COMPENSATED"
    assert statuses["step-2"] == "COMPENSATED"
    assert statuses["step-3"] == "DENIED"


def test_inconsistent_when_compensation_fails():
    h = _Harness()
    r1 = h.step("step-1")
    r2 = h.step("step-2")
    h.step("step-3", amount=99000)
    h.step("comp-2", compensation_of=r2.receipt_id, compensation_fails=True)
    h.step("comp-1", compensation_of=r1.receipt_id)
    state = reconcile(h.receipts, h.jwks)
    assert state.reconciled_status == ReconciledStatus.INCONSISTENT
    assert "step-2" in state.unrecovered_steps
    statuses = {s.step_id: s.status for s in state.steps}
    assert statuses["step-2"] == "COMPENSATION_FAILED"


def test_in_progress():
    h = _Harness()
    h.step("step-1")
    h.step("step-2", exec_status=None)  # authorized but execution not recorded
    state = reconcile(h.receipts, h.jwks)
    assert state.reconciled_status == ReconciledStatus.IN_PROGRESS


def test_broken_chain_is_inconsistent():
    h = _Harness()
    h.step("step-1")
    h.step("step-2")
    # Tamper: break the link by editing parent on the stored model.
    h.receipts[1].parent_receipt_id = "bogus"
    state = reconcile(h.receipts, h.jwks)
    assert state.reconciled_status == ReconciledStatus.INCONSISTENT
