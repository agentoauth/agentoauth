# SPDX-License-Identifier: MIT
"""Buyer agent node — places the order with the external supplier.

Builds the ``order.place`` step. Before authorization it asks the supplier stub
for a quote and surfaces it to the verifier via ``live_state["quoted_amount"]``,
so a hallucinated price that violates ``limits`` is caught as a verify-time DENY
(no side effect) — distinct from ``out_of_stock``/``timeout`` execution failures.
"""

from __future__ import annotations

from typing import Any

from ..models import Action
from ..saga.orchestrator import Step

AGENT_ID = "buyer@demo"


def make_step(
    entity: str, amount: int, supplier: str, limits: dict[str, Any],
    system: Any, budget_available: int,
) -> Step:
    action = Action(
        type="order.place",
        entity=entity,
        params={"amount": amount, "supplier": supplier},
        limits=limits,
    )
    quoted = system.quote(action)
    live_state: dict[str, Any] = {"budget_available": budget_available, "quoted_amount": quoted}
    return Step(
        step_id="buyer", agent_id=AGENT_ID, action=action, system=system, live_state=live_state,
    )
