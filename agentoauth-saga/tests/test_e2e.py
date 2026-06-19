# SPDX-License-Identifier: MIT
"""End-to-end: run the LangGraph saga for all three scenarios and assert outcomes."""

from __future__ import annotations

import json

from agentoauth_saga.agents.graph import SagaConfig, run_saga_graph
from agentoauth_saga.models import ConsentReceipt, Verdict
from agentoauth_saga.receipts.verify_chain import verify_chain
from agentoauth_saga.systems.erp_stub import ErpStub
from agentoauth_saga.systems.mongo_stub import MongoStub
from agentoauth_saga.systems.supplier_stub import SupplierStub


def _config(supplier_failure=None, compensation_fails=False):
    return SagaConfig(
        saga_id="reorder-XYZ",
        mongo_system=MongoStub(),
        erp_system=ErpStub(compensation_fails=compensation_fails),
        supplier_system=SupplierStub(failure_mode=supplier_failure, compensation_fails=compensation_fails),
    )


def test_happy_path_complete():
    orch, state = run_saga_graph(_config())
    chain = orch.store.get_chain("reorder-XYZ")
    assert len(chain) == 3
    assert all(r.verdict == Verdict.ALLOW for r in chain)
    assert state.reconciled_status.value == "COMPLETE"
    ok, problems = verify_chain(chain, orch.store.jwks)
    assert ok, problems


def test_failure_path_compensated():
    orch, state = run_saga_graph(_config(supplier_failure="out_of_stock"))
    chain = orch.store.get_chain("reorder-XYZ")
    comps = [r for r in chain if r.compensation_of is not None]
    assert len(comps) == 2
    assert state.reconciled_status.value == "COMPENSATED"
    ok, problems = verify_chain(chain, orch.store.jwks)
    assert ok, problems


def test_price_hallucination_is_verify_time_deny():
    orch, state = run_saga_graph(_config(supplier_failure="price_hallucination"))
    chain = orch.store.get_chain("reorder-XYZ")
    buyer = next(r for r in chain if r.step_id == "buyer")
    assert buyer.verdict == Verdict.DENY  # caught before any side effect
    assert state.reconciled_status.value == "COMPENSATED"


def test_compensation_fails_inconsistent():
    orch, state = run_saga_graph(_config(supplier_failure="out_of_stock", compensation_fails=True))
    assert state.reconciled_status.value == "INCONSISTENT"
    assert "finance" in state.unrecovered_steps


def test_receipts_self_verify_offline_from_dump(tmp_path):
    orch, _ = run_saga_graph(_config())
    path = tmp_path / "saga.json"
    orch.store.dump_json("reorder-XYZ", str(path))

    data = json.loads(path.read_text())
    assert all("d" not in k for k in data["keys"])  # no private key material leaked
    receipts = [ConsentReceipt.model_validate(r) for r in data["receipts"]]
    # Verify using ONLY the embedded JWKS — no verifier instance, no network.
    ok, problems = verify_chain(receipts, data["keys"])
    assert ok, problems
    assert data["reconciled"]["reconciled_status"] == "COMPLETE"
