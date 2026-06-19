# SPDX-License-Identifier: MIT
"""Finance agent node — allocates budget and writes an invoice.

Builds the ``budget.allocate`` step; ``live_state`` carries the available budget
so the policy can DENY when funds are insufficient.
"""

from __future__ import annotations

from typing import Any

from ..models import Action
from ..saga.orchestrator import Step

AGENT_ID = "finance@demo"


def make_step(
    entity: str, amount: int, supplier: str, limits: dict[str, Any],
    system: Any, budget_available: int,
) -> Step:
    action = Action(
        type="budget.allocate",
        entity=entity,
        params={"amount": amount, "supplier": supplier},
        limits=limits,
    )
    return Step(
        step_id="finance", agent_id=AGENT_ID, action=action, system=system,
        live_state={"budget_available": budget_available},
    )
