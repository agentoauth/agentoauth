#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""Generate baked replay traces for the live demo's offline fallback.

Runs the REAL handshake for each scenario (supplier as a subprocess) with seeded
keys so the artifacts are stable and verify in-browser, and writes them to
orgs/gateway/static/traces/<scenario>.json.

    python scripts/gen_traces.py
"""

from __future__ import annotations

import asyncio
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from agentoauth_saga.consent.keys import KeyRing  # noqa: E402
from agentoauth_saga.models import Action  # noqa: E402
from demos._a2a_harness import supplier_process  # noqa: E402
from orgs.buyer.client import place_order_via_a2a  # noqa: E402
from orgs.gateway.supplier_manager import SCENARIOS  # noqa: E402
from orgs.gateway.trace import build_trace  # noqa: E402

OUT = os.path.join(ROOT, "orgs", "gateway", "static", "traces")


def _action() -> Action:
    return Action(
        type="order.place", entity="order:XYZ",
        params={"amount": 40000, "supplier": "acme", "currency": "USD"},
        limits={"max_amount": 50000, "supplier_allowlist": ["acme", "globex", "initech"]},
    )


async def _trace_for(scenario: str, mode: str, port: int) -> dict:
    with supplier_process(mode=mode, port=port, seed="org-b") as url:
        outcome = await place_order_via_a2a(
            supplier_url=url, saga_id="demo", step_id="buyer",
            parent_receipt_id=None, action=_action(), keyring=KeyRing(seed="org-a"),
        )
    return build_trace(scenario, _action(), outcome)


def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    for scenario, (mode, port) in SCENARIOS.items():
        trace = asyncio.run(_trace_for(scenario, mode, port + 100))  # offset ports
        path = os.path.join(OUT, f"{scenario}.json")
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(trace, fh, indent=2)
        print(f"wrote {path}  (a2a_state={trace['a2a_state']}, verdict={trace['verify']['verdict']})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
