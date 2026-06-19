# SPDX-License-Identifier: MIT
"""Analyst agent node — detects low inventory and requests approval.

Builds the ``inventory.approve`` step. Demo logic only; the authority+receipt
work happens in the orchestrator/verifier it hands the step to.
"""

from __future__ import annotations

from typing import Any

from ..models import Action
from ..saga.orchestrator import Step

AGENT_ID = "analyst@demo"


def make_step(entity: str, amount: int, supplier: str, limits: dict[str, Any], system: Any) -> Step:
    action = Action(
        type="inventory.approve",
        entity=entity,
        params={"amount": amount, "supplier": supplier},
        limits=limits,
    )
    # No live_state needed: approving a reorder has no budget constraint.
    return Step(step_id="analyst", agent_id=AGENT_ID, action=action, system=system)
