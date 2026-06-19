# SPDX-License-Identifier: MIT
"""Shared demo helpers: build a SagaConfig wired to fresh system stubs."""

from __future__ import annotations

import os
from typing import Optional

from agentoauth_saga.agents.graph import SagaConfig, run_saga_graph
from agentoauth_saga.saga.orchestrator import Orchestrator
from agentoauth_saga.systems.erp_stub import ErpStub
from agentoauth_saga.systems.mongo_stub import MongoStub
from agentoauth_saga.systems.supplier_stub import SupplierStub
from agentoauth_saga.viewer.cli import render_saga


def make_config(
    supplier_failure: Optional[str] = None,
    compensation_fails: bool = False,
    saga_id: str = "reorder-XYZ",
) -> SagaConfig:
    return SagaConfig(
        saga_id=saga_id,
        mongo_system=MongoStub(),
        erp_system=ErpStub(compensation_fails=compensation_fails),
        supplier_system=SupplierStub(failure_mode=supplier_failure,
                                     compensation_fails=compensation_fails),
    )


def run_and_report(title: str, config: SagaConfig, dump_name: str):
    """Run the LangGraph saga, print the receipt chain + reconciled state, dump saga.json."""
    orch: Orchestrator
    orch, state = run_saga_graph(config)

    out_dir = os.environ.get("SAGA_OUT_DIR", os.getcwd())
    dump_path = os.path.join(out_dir, dump_name)
    orch.store.dump_json(config.saga_id, dump_path)

    render_saga(title, orch.store.get_chain(config.saga_id), state, orch.log)
    print(f"\nsaga.json written to: {dump_path}")
    print(f"View it: open src/agentoauth_saga/viewer/web/index.html  (or: saga-view {dump_path})\n")
    return orch, state
