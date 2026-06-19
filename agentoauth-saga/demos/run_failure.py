#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""Deep-cut failure path: the cross-org Buyer->Supplier leg fails; saga compensates.

The supplier (Org B) is out of stock, so the A2A leg fails. The orchestrator
compensates Org A's prior committed local steps (Finance void-invoice, Analyst
revert-approval) in reverse.
Expected: 2 compensation receipts; reconcile == COMPENSATED.
"""

from __future__ import annotations

from _saga_a2a import run_saga_over_a2a


def main() -> int:
    state = run_saga_over_a2a(
        "Deep cut — saga failure + compensation (supplier out of stock, over A2A)",
        supplier_mode="out_of_stock", compensation_fails=False, dump_name="saga_failure.json",
    )
    assert state.reconciled_status.value == "COMPENSATED", state.reconciled_status
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
