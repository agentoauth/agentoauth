# SPDX-License-Identifier: MIT
"""Run the deep-cut saga with the Buyer->Supplier leg over real A2A.

Org A (LangGraph: Analyst -> Finance -> Buyer) runs locally; the Buyer leg crosses
the wire to Org B (CrewAI supplier subprocess). reconcile() then spans both orgs:
Org A's local receipts plus the supplier's cross-org receipt, with compensation of
Org A's local steps firing on a cross-org failure.
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agentoauth_saga.consent.keys import KeyRing  # noqa: E402
from agentoauth_saga.models import SagaState  # noqa: E402
from agentoauth_saga.saga.orchestrator import Orchestrator  # noqa: E402
from agentoauth_saga.systems.erp_stub import ErpStub  # noqa: E402
from agentoauth_saga.systems.mongo_stub import MongoStub  # noqa: E402
from agentoauth_saga.viewer.cli import render_saga  # noqa: E402

from demos._a2a_harness import supplier_process  # noqa: E402
from orgs.buyer.graph import run_buyer_saga  # noqa: E402
from orgs.buyer.saga import build_saga_steps  # noqa: E402

# Distinct seeds => Org A and Org B hold genuinely different keys.
BUYER_SEED = "org-a"
SUPPLIER_SEED = "org-b"
SAGA_ID = "reorder-XYZ"
PORT = int(os.environ.get("SUPPLIER_PORT", "9999"))


def run_saga_over_a2a(title: str, supplier_mode: str, compensation_fails: bool,
                      dump_name: str) -> SagaState:
    with supplier_process(mode=supplier_mode, port=PORT, seed=SUPPLIER_SEED) as url:
        keyring = KeyRing(seed=BUYER_SEED)
        orch = Orchestrator(SAGA_ID, keyring=keyring)
        steps = build_saga_steps(
            url, keyring,
            mongo=MongoStub(),
            erp=ErpStub(compensation_fails=compensation_fails),
        )
        state = run_buyer_saga(orch, steps)

    out_dir = os.environ.get("SAGA_OUT_DIR", os.getcwd())
    dump_path = os.path.join(out_dir, dump_name)
    orch.store.dump_json(SAGA_ID, dump_path)

    render_saga(title, orch.store.get_chain(SAGA_ID), state, orch.log)
    print(f"\nsaga.json written to: {dump_path}\n")
    return state
