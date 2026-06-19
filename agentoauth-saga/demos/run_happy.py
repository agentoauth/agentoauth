#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""Happy path: 3-agent procurement saga succeeds end-to-end.

Expected: 3 linked, signed receipts; all signatures verify; reconcile == COMPLETE.
"""

from __future__ import annotations

from _common import make_config, run_and_report


def main() -> int:
    config = make_config()  # no supplier failure
    _, state = run_and_report("Happy path — procurement reorder", config, "saga_happy.json")
    assert state.reconciled_status.value == "COMPLETE", state.reconciled_status
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
