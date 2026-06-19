# SPDX-License-Identifier: MIT
"""LangGraph procurement workflow: Analyst -> Finance -> Buyer.

This is the demo orchestration surface. LangGraph (imported only here and,
permissibly, in ``saga/``) coordinates the *steps*; AgentOAuth proves each step's
authority and records the reconciled outcome. Each node hands its built step to
the framework-agnostic :class:`Orchestrator`, which issues the consent token, gets
a signed verifier receipt, executes the side effect, and — on DENY/failure —
compensates prior committed steps in reverse. The graph just threads the chain's
``last_receipt_id`` and halts once a step is denied or fails.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional, TypedDict

from langgraph.graph import END, StateGraph

from ..models import SagaState
from ..saga.orchestrator import Orchestrator
from . import analyst, buyer, finance


@dataclass
class SagaConfig:
    """Inputs for one procurement saga run."""

    saga_id: str = "reorder-XYZ"
    entity: str = "order:XYZ"
    amount: int = 40000
    supplier: str = "acme"
    budget_available: int = 60000
    limits: dict[str, Any] = field(
        default_factory=lambda: {
            "max_amount": 50000,
            "supplier_allowlist": ["acme", "globex", "initech"],
        }
    )
    mongo_system: Any = None
    erp_system: Any = None
    supplier_system: Any = None


class SagaGraphState(TypedDict):
    last_receipt_id: Optional[str]
    halted: bool


def _halted_after(receipt) -> bool:
    if receipt.verdict.value == "DENY":
        return True
    exec_meta = receipt.metadata.get("exec", {})
    return isinstance(exec_meta, dict) and exec_meta.get("status") == "FAILED"


def build_saga_graph(orchestrator: Orchestrator, config: SagaConfig):
    """Compile the Analyst->Finance->Buyer graph bound to one orchestrator/config."""

    def analyst_node(state: SagaGraphState) -> dict[str, Any]:
        step = analyst.make_step(config.entity, config.amount, config.supplier,
                                 config.limits, config.mongo_system)
        receipt = orchestrator.run_step(step)
        return {"last_receipt_id": orchestrator.last_receipt_id, "halted": _halted_after(receipt)}

    def finance_node(state: SagaGraphState) -> dict[str, Any]:
        step = finance.make_step(config.entity, config.amount, config.supplier, config.limits,
                                 config.erp_system, config.budget_available)
        receipt = orchestrator.run_step(step)
        return {"last_receipt_id": orchestrator.last_receipt_id, "halted": _halted_after(receipt)}

    def buyer_node(state: SagaGraphState) -> dict[str, Any]:
        step = buyer.make_step(config.entity, config.amount, config.supplier, config.limits,
                               config.supplier_system, config.budget_available)
        receipt = orchestrator.run_step(step)
        return {"last_receipt_id": orchestrator.last_receipt_id, "halted": _halted_after(receipt)}

    def route(state: SagaGraphState) -> str:
        return "stop" if state.get("halted") else "continue"

    graph = StateGraph(SagaGraphState)
    graph.add_node("analyst", analyst_node)
    graph.add_node("finance", finance_node)
    graph.add_node("buyer", buyer_node)
    graph.set_entry_point("analyst")
    graph.add_conditional_edges("analyst", route, {"continue": "finance", "stop": END})
    graph.add_conditional_edges("finance", route, {"continue": "buyer", "stop": END})
    graph.add_edge("buyer", END)
    return graph.compile()


def run_saga_graph(config: SagaConfig, orchestrator: Optional[Orchestrator] = None) -> tuple[Orchestrator, SagaState]:
    """Run the LangGraph workflow and return the orchestrator + reconciled state."""
    orch = orchestrator or Orchestrator(config.saga_id)
    app = build_saga_graph(orch, config)
    app.invoke({"last_receipt_id": None, "halted": False})
    return orch, orch.reconcile()
