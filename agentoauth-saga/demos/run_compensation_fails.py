#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""Compensation-fails path: a reversal is itself irreversible.

The supplier fails (out_of_stock) AND the ERP void-invoice compensation fails, so
Finance's committed write cannot be rolled back. This is the honest "you can't
always undo" case.

Expected: reconcile == INCONSISTENT, with the unrecovered step (finance) flagged.
"""

from __future__ import annotations

from _common import make_config, run_and_report


def main() -> int:
    config = make_config(supplier_failure="out_of_stock", compensation_fails=True)
    _, state = run_and_report("Compensation fails — INCONSISTENT", config, "saga_compensation_fails.json")
    assert state.reconciled_status.value == "INCONSISTENT", state.reconciled_status
    assert state.unrecovered_steps, "expected at least one flagged unrecovered step"
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
