#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""Deep-cut compensation-fails path: a reversal is itself irreversible.

The cross-org Buyer->Supplier leg fails (out of stock) AND Org A's ERP void-invoice
compensation fails, so Finance's committed write cannot be rolled back — the honest
"you can't always undo" case, now spanning two orgs.
Expected: reconcile == INCONSISTENT, with the unrecovered step (finance) flagged.
"""

from __future__ import annotations

from _saga_a2a import run_saga_over_a2a


def main() -> int:
    state = run_saga_over_a2a(
        "Deep cut — compensation fails → INCONSISTENT (over A2A)",
        supplier_mode="out_of_stock", compensation_fails=True,
        dump_name="saga_compensation_fails.json",
    )
    assert state.reconciled_status.value == "INCONSISTENT", state.reconciled_status
    assert state.unrecovered_steps, "expected a flagged unrecovered step"
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
