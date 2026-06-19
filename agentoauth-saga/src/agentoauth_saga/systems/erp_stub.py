# SPDX-License-Identifier: MIT
"""In-memory ERP stub: create-invoice / void-invoice.

Not a real ERP integration — the point of this project is the authority+receipt
layer, not connectors. ``compensation_fails=True`` makes ``compensate`` raise so
we can demonstrate the honest "can't always roll back" (INCONSISTENT) case.
"""

from __future__ import annotations

from typing import Any


class ExecutionError(RuntimeError):
    """Raised when a system execute/compensate handler fails."""


class ErpStub:
    def __init__(self, compensation_fails: bool = False) -> None:
        self.compensation_fails = compensation_fails
        self.invoices: dict[str, dict[str, Any]] = {}

    def execute(self, action) -> dict[str, Any]:
        """budget.allocate -> create an invoice."""
        invoice_id = f"INV-{action.entity}"
        self.invoices[invoice_id] = {
            "amount": action.params.get("amount"),
            "status": "OPEN",
            "entity": action.entity,
        }
        return {"invoice_id": invoice_id, "status": "OPEN"}

    def compensate(self, action) -> dict[str, Any]:
        """budget.void -> void the invoice (fails if compensation_fails is set)."""
        if self.compensation_fails:
            raise ExecutionError("ERP void-invoice failed: upstream ledger locked")
        invoice_id = f"INV-{action.entity}"
        inv = self.invoices.get(invoice_id)
        if inv:
            inv["status"] = "VOID"
        return {"invoice_id": invoice_id, "status": "VOID"}
