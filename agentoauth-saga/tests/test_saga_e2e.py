# SPDX-License-Identifier: MIT
"""WS4 e2e: the deep-cut saga with the Buyer->Supplier leg over REAL A2A.

reconcile() spans both orgs (Org A's local receipts + Org B's cross-org receipt);
compensation of Org A's local steps fires on a cross-org failure.
"""

from __future__ import annotations

from agentoauth_saga.consent.keys import KeyRing
from agentoauth_saga.receipts.verify_chain import verify_chain
from agentoauth_saga.saga.orchestrator import Orchestrator
from agentoauth_saga.systems.erp_stub import ErpStub
from agentoauth_saga.systems.mongo_stub import MongoStub

from demos._a2a_harness import supplier_process
from orgs.buyer.graph import run_buyer_saga
from orgs.buyer.saga import build_saga_steps

PORT = 9972


def _run(mode: str, compensation_fails: bool = False):
    with supplier_process(mode=mode, port=PORT, seed="org-b") as url:
        keyring = KeyRing(seed="org-a")
        orch = Orchestrator("reorder-XYZ", keyring=keyring)
        steps = build_saga_steps(
            url, keyring, mongo=MongoStub(),
            erp=ErpStub(compensation_fails=compensation_fails),
        )
        state = run_buyer_saga(orch, steps)
        chain = orch.store.get_chain("reorder-XYZ")
        jwks = orch.store.jwks
    return state, chain, jwks


def test_happy_spans_both_orgs_complete():
    state, chain, jwks = _run("available")
    assert state.reconciled_status.value == "COMPLETE"
    assert len(chain) == 3
    # The buyer receipt was signed by Org B's verifier; the chain still verifies
    # offline because that public key was registered into the store.
    ok, problems = verify_chain(chain, jwks)
    assert ok, problems
    buyer = next(r for r in chain if r.step_id == "buyer")
    assert buyer.executed is True


def test_cross_org_failure_compensates_local_steps():
    state, chain, jwks = _run("out_of_stock")
    assert state.reconciled_status.value == "COMPENSATED"
    comps = [r for r in chain if r.compensation_of is not None]
    assert len(comps) == 2  # Finance + Analyst rolled back
    assert verify_chain(chain, jwks)[0]


def test_compensation_failure_is_inconsistent():
    state, _, _ = _run("out_of_stock", compensation_fails=True)
    assert state.reconciled_status.value == "INCONSISTENT"
    assert "finance" in state.unrecovered_steps
