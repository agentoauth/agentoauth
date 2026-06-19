#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""Deep-cut happy path: the saga succeeds across both orgs over A2A.

Analyst (mongo) -> Finance (erp) locally, then Buyer -> Supplier (CrewAI) over A2A.
Expected: 3 linked, signed receipts spanning two orgs; reconcile == COMPLETE.
"""

from __future__ import annotations

from _saga_a2a import run_saga_over_a2a


def main() -> int:
    state = run_saga_over_a2a(
        "Deep cut — saga happy path (LangGraph Org A ↔ CrewAI Org B over A2A)",
        supplier_mode="available", compensation_fails=False, dump_name="saga_happy.json",
    )
    assert state.reconciled_status.value == "COMPLETE", state.reconciled_status
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
