# SPDX-License-Identifier: MIT
"""Reconciliation — walk a verified receipt chain to a single reconciled status.

Pairs each committed forward step with any later ``compensation_of`` receipt and
classifies it, then rolls up to COMPLETE / COMPENSATED / INCONSISTENT / IN_PROGRESS.
Execution outcomes are read from ``receipt.metadata["exec"]`` which the
orchestrator writes after calling a system's ``execute`` / ``compensate`` handler:

    metadata["exec"] = {"status": "OK" | "FAILED", "compensation_fails": bool?}
"""

from __future__ import annotations

from typing import Any

from ..models import ConsentReceipt, ReconciledStatus, SagaState, StepState, Verdict
from .verify_chain import verify_chain


def _exec_status(receipt: ConsentReceipt) -> str | None:
    exec_meta = receipt.metadata.get("exec")
    if not isinstance(exec_meta, dict):
        return None
    return exec_meta.get("status")


def reconcile(
    receipts: list[ConsentReceipt],
    jwks: list[dict[str, Any]],
    saga_id: str | None = None,
) -> SagaState:
    """Reconcile an ordered receipt chain into a :class:`SagaState`."""
    sid = saga_id or (receipts[0].saga_id if receipts else "")

    ok, problems = verify_chain(receipts, jwks)
    if not ok:
        return SagaState(
            saga_id=sid,
            steps=[],
            reconciled_status=ReconciledStatus.INCONSISTENT,
            reason="chain integrity broken: " + "; ".join(problems),
        )

    forwards = [r for r in receipts if r.compensation_of is None]
    comps = [r for r in receipts if r.compensation_of is not None]
    comp_by_target: dict[str, ConsentReceipt] = {c.compensation_of: c for c in comps}  # type: ignore[misc]

    steps: list[StepState] = []
    any_in_progress = False
    any_unrecovered = False

    for r in forwards:
        exec_status = _exec_status(r)
        status: str
        unrecovered = False
        compensated = False
        executed = exec_status == "OK"

        if r.verdict == Verdict.DENY:
            # Denied before execution: nothing committed, nothing to undo.
            status = "DENIED"
        elif exec_status is None:
            status = "IN_PROGRESS"
            any_in_progress = True
        elif r.receipt_id in comp_by_target:
            comp = comp_by_target[r.receipt_id]
            comp_exec = comp.metadata.get("exec", {}) if isinstance(comp.metadata.get("exec"), dict) else {}
            comp_ok = comp_exec.get("status") == "OK" and not comp_exec.get("compensation_fails")
            if comp_ok:
                status = "COMPENSATED"
                compensated = True
            else:
                status = "COMPENSATION_FAILED"
                unrecovered = True
                any_unrecovered = True
        elif exec_status == "OK":
            status = "DONE"
        else:
            # Execution raised before committing a side effect (the stub failed
            # cleanly), so there is nothing dangling for THIS step — the prior
            # committed steps are what get compensated. A clean failure does not
            # by itself make the saga inconsistent.
            status = "FAILED"

        steps.append(
            StepState(
                step_id=r.step_id,
                receipt_id=r.receipt_id,
                action=None,
                verdict=r.verdict,
                executed=executed,
                compensated=compensated,
                status=status,
                unrecovered=unrecovered,
            )
        )

    # Roll up to one of the four reconciled statuses.
    if any_unrecovered:
        rolled = ReconciledStatus.INCONSISTENT
    elif any_in_progress:
        rolled = ReconciledStatus.IN_PROGRESS
    elif comps:
        rolled = ReconciledStatus.COMPENSATED
    else:
        all_done = all(s.status in ("DONE", "DENIED") for s in steps)
        rolled = ReconciledStatus.COMPLETE if all_done else ReconciledStatus.INCONSISTENT

    return SagaState(
        saga_id=sid,
        steps=steps,
        reconciled_status=rolled,
        unrecovered_steps=[s.step_id for s in steps if s.unrecovered],
    )
