#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""HERO demo — the cross-framework handshake.

Org A (LangGraph buyer) delegates one ``place_order`` to Org B (CrewAI supplier)
over real A2A, carrying an AgentOAuth consent token. The supplier verifies the
token BEFORE acting, acts, and returns a signed Consent Receipt; the buyer verifies
the receipt. Runs the supplier as a SEPARATE process — the A↔B leg crosses a wire.

    python demos/run_handshake.py                 # success path
    python demos/run_handshake.py out_of_stock    # fulfilment failure
    python demos/run_handshake.py price_violation  # authority denied (verify-time)
"""

from __future__ import annotations

import asyncio
import os
import sys

from agentoauth_saga.consent.keys import KeyRing
from agentoauth_saga.models import Action

# Import path bootstrap so `orgs` is importable when run from the project root.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from demos._a2a_harness import supplier_process  # noqa: E402
from orgs.buyer.client import place_order_via_a2a  # noqa: E402

SUPPLIER_PORT = int(os.environ.get("SUPPLIER_PORT", "9999"))


def _action() -> Action:
    return Action(
        type="order.place",
        entity="order:XYZ",
        params={"amount": 40000, "supplier": "acme", "currency": "USD"},
        limits={"max_amount": 50000, "supplier_allowlist": ["acme", "globex", "initech"]},
    )


async def _delegate(url: str):
    keyring = KeyRing(seed="org-a")
    return await place_order_via_a2a(
        supplier_url=url, saga_id="handshake", step_id="buyer",
        parent_receipt_id=None, action=_action(), keyring=keyring,
    )


async def _run(mode: str) -> int:
    external = os.environ.get("SUPPLIER_URL")
    if external:
        # Supplier is already running as a separate service (e.g. docker-compose).
        outcome = await _delegate(external.rstrip("/"))
    else:
        # Launch the supplier as a child process for a one-command local demo.
        with supplier_process(mode=mode, port=SUPPLIER_PORT, seed="org-b"):
            outcome = await _delegate(f"http://127.0.0.1:{SUPPLIER_PORT}")

    print("\n================ AgentOAuth over A2A — handshake ================")
    print(f"  supplier mode      : {mode}")
    print(f"  A2A task state     : {outcome.state}")
    print(f"  decision           : {outcome.decision.get('category')} "
          f"(used_llm={outcome.decision.get('used_llm')})")
    print(f"  supplier reasoning : {outcome.decision.get('reason')}")
    if outcome.receipt is not None:
        print(f"  receipt verdict    : {outcome.receipt.verdict.value}")
        print(f"  receipt executed   : {outcome.receipt.executed}")
        print(f"  receipt id         : {outcome.receipt.receipt_id}")
        print(f"  receipt SIGNATURE  : {'VALID ✓' if outcome.receipt_valid else 'INVALID ✗'} "
              f"(verified offline against the supplier's verifier key)")
    else:
        print("  receipt            : none (auth-required)")
    print("================================================================\n")

    # Acceptance: the handshake completed and (when authorized) the receipt verifies.
    if mode == "available":
        assert outcome.state == "completed" and outcome.receipt_valid, outcome
    return 0


def main() -> int:
    mode = sys.argv[1] if len(sys.argv) > 1 else "available"
    return asyncio.run(_run(mode))


if __name__ == "__main__":
    raise SystemExit(main())
