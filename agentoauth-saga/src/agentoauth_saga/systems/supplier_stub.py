# SPDX-License-Identifier: MIT
"""In-memory external supplier agent stub with configurable failure modes.

Failure modes (set via the constructor):
  * ``out_of_stock`` / ``timeout`` -> EXECUTION failures: ``execute`` raises, so a
    prior-committed step must be compensated.
  * ``price_hallucination`` -> a VERIFY-TIME DENY: the supplier quotes a price that
    violates the action ``limits``. The orchestrator surfaces this quote to the
    verifier via ``live_state["quoted_amount"]`` so policy returns DENY *before*
    ``order.place`` executes — no side effect, nothing to compensate.

``cancel-order`` is the compensation; ``compensation_fails`` makes it raise.
"""

from __future__ import annotations

from typing import Any, Optional

from .erp_stub import ExecutionError


class SupplierStub:
    def __init__(self, failure_mode: Optional[str] = None, compensation_fails: bool = False) -> None:
        self.failure_mode = failure_mode
        self.compensation_fails = compensation_fails
        self.orders: dict[str, dict[str, Any]] = {}

    def quote(self, action) -> Optional[float]:
        """Return a supplier-quoted price the verifier should check, if relevant.

        Under ``price_hallucination`` the supplier hallucinates a price far above
        the requested amount/limit; otherwise it honours the requested amount.
        """
        if self.failure_mode == "price_hallucination":
            limit = action.limits.get("max_amount", 50000)
            return float(limit) * 2 + 9000  # deliberately over the limit
        return action.params.get("amount")

    def execute(self, action) -> dict[str, Any]:
        """order.place -> place the order with the external supplier."""
        if self.failure_mode == "out_of_stock":
            raise ExecutionError(f"supplier rejected {action.entity}: out of stock")
        if self.failure_mode == "timeout":
            raise ExecutionError(f"supplier timed out placing {action.entity}")
        order_id = f"ORD-{action.entity}"
        self.orders[order_id] = {"status": "PLACED", "amount": action.params.get("amount")}
        return {"order_id": order_id, "status": "PLACED"}

    def compensate(self, action) -> dict[str, Any]:
        """cancel-order."""
        if self.compensation_fails:
            raise ExecutionError("supplier cancel-order failed: order already shipped")
        order_id = f"ORD-{action.entity}"
        order = self.orders.get(order_id)
        if order:
            order["status"] = "CANCELLED"
        return {"order_id": order_id, "status": "CANCELLED"}
