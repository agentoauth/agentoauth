#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""Failure path: the final step (order.place) fails; the saga compensates.

The supplier stub is configured to fail (out_of_stock execution failure). The
orchestrator compensates the prior committed steps (Finance void-invoice, Analyst
revert-approval) in reverse.

Expected: step 3 failed; 2 compensation receipts; reconcile == COMPENSATED;
verify_chain == True.
"""

from __future__ import annotations

from _common import make_config, run_and_report


def main() -> int:
    config = make_config(supplier_failure="out_of_stock")
    _, state = run_and_report("Failure + compensation — supplier out of stock", config, "saga_failure.json")
    assert state.reconciled_status.value == "COMPENSATED", state.reconciled_status
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
