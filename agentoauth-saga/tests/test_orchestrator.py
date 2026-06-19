# SPDX-License-Identifier: MIT
"""Orchestrator CONFIRM handling (auto-approve in demo vs halt when disabled)."""

from __future__ import annotations

from agentoauth_saga.models import Action, Verdict
from agentoauth_saga.saga.orchestrator import Orchestrator, Step
from agentoauth_saga.systems.erp_stub import ErpStub


def _confirm_step(system):
    # 47000 sits inside the policy review band [45000, 50000] -> CONFIRM.
    action = Action(
        type="budget.allocate",
        entity="order:XYZ",
        params={"amount": 47000, "supplier": "acme"},
        limits={"max_amount": 50000, "supplier_allowlist": ["acme"]},
    )
    return Step(step_id="finance", agent_id="finance@demo", action=action,
                system=system, live_state={"budget_available": 60000})


def test_confirm_auto_approves_and_executes():
    erp = ErpStub()
    orch = Orchestrator("saga-confirm", auto_confirm=True)
    receipt = orch.run_step(_confirm_step(erp))

    assert receipt.verdict == Verdict.CONFIRM
    assert receipt.executed is True
    assert receipt.metadata.get("confirm_auto_approved") is True
    assert "note" in receipt.metadata
    # The invoice side effect actually ran.
    assert any(inv["status"] == "OPEN" for inv in erp.invoices.values())
    # A committed CONFIRM step reconciles as DONE -> COMPLETE.
    assert orch.reconcile().reconciled_status.value == "COMPLETE"


def test_confirm_halts_when_auto_confirm_disabled():
    erp = ErpStub()
    orch = Orchestrator("saga-confirm", auto_confirm=False)
    receipt = orch.run_step(_confirm_step(erp))

    assert receipt.verdict == Verdict.CONFIRM
    assert receipt.executed is False
    assert receipt.metadata.get("confirm_pending") is True
    assert erp.invoices == {}  # no side effect when the human gate is not bypassed
    # Authorized-but-not-executed -> IN_PROGRESS.
    assert orch.reconcile().reconciled_status.value == "IN_PROGRESS"
