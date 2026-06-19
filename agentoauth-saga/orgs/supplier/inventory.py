# SPDX-License-Identifier: MIT
"""Supplier's PRIVATE backend: inventory + the order-fulfilment decision.

This is the data and logic the CrewAI agent reasons over (see ``crew.py``). It is
deliberately framework-agnostic and dependency-free so it can be unit-tested and
so the deterministic fallback (no-LLM) path produces identical, reproducible
decisions. The CrewAI crew, when an LLM key is present, reasons to the *same*
shape of decision over this same private data.

The "failure modes" of the original in-memory stub become the supplier's private
reality, configured at server start via ``SUPPLIER_MODE`` — the buyer cannot set
them (that's the point of crossing an org boundary):

  * ``available``        -> fulfils at the requested price
  * ``out_of_stock``     -> cannot fulfil (fulfilment failure)
  * ``price_violation``  -> would charge above the buyer's authorized limit, so it
                            declines on authority grounds (no order placed)
  * ``timeout``          -> cannot fulfil in time (fulfilment failure)
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Literal, Optional

DecisionCategory = Literal["fulfilled", "authority_denied", "fulfillment_failed"]


@dataclass
class OrderRequest:
    sku: str
    requested_amount: float
    currency: str
    max_amount: Optional[float]      # the authority limit carried by the consent token
    supplier_name: str


@dataclass
class Decision:
    fulfill: bool
    category: DecisionCategory
    reason: str
    quoted_price: float
    order_id: Optional[str] = None


@dataclass
class SupplierInventory:
    """The supplier's private state. ``mode`` simulates a real-world condition."""

    mode: str = "available"
    # Unit economics the buyer never sees; used to produce a quote.
    base_price_multiplier: float = 1.0
    name: str = "acme"
    placed_orders: dict[str, dict] = field(default_factory=dict)

    @classmethod
    def from_env(cls) -> "SupplierInventory":
        return cls(
            mode=os.environ.get("SUPPLIER_MODE", "available"),
            name=os.environ.get("SUPPLIER_NAME", "acme"),
        )

    def quote_for(self, request: OrderRequest) -> float:
        """The price the supplier would charge (private pricing)."""
        if self.mode == "price_violation":
            limit = request.max_amount or request.requested_amount
            return float(limit) * 2 + 9000  # deliberately above the authorized limit
        return request.requested_amount * self.base_price_multiplier

    def decide(self, request: OrderRequest) -> Decision:
        """Decide whether to fulfil ``request``, reasoning over private inventory."""
        quote = self.quote_for(request)

        if self.mode == "out_of_stock":
            return Decision(False, "fulfillment_failed",
                            f"SKU {request.sku} is out of stock", quote)
        if self.mode == "timeout":
            return Decision(False, "fulfillment_failed",
                            f"supplier timed out fulfilling {request.sku}", quote)
        if request.max_amount is not None and quote > request.max_amount:
            return Decision(False, "authority_denied",
                            f"quoted price {quote:.0f} exceeds authorized limit "
                            f"{request.max_amount:.0f}", quote)

        order_id = f"ORD-{request.sku}"
        self.placed_orders[order_id] = {"status": "PLACED", "amount": quote}
        return Decision(True, "fulfilled",
                        f"order {order_id} placed at {quote:.0f} {request.currency}",
                        quote, order_id=order_id)

    def cancel(self, sku: str, compensation_fails: bool = False) -> dict:
        """Compensation: cancel a previously placed order."""
        if compensation_fails:
            raise RuntimeError("supplier cancel-order failed: order already shipped")
        order_id = f"ORD-{sku}"
        order = self.placed_orders.get(order_id)
        if order:
            order["status"] = "CANCELLED"
        return {"order_id": order_id, "status": "CANCELLED"}
