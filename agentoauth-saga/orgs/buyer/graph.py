# SPDX-License-Identifier: MIT
"""Org A buyer as a LangGraph workflow: Analyst -> Finance -> Buyer.

The Buyer node delegates ``order.place`` to the CrewAI supplier over A2A (via the
step's ``remote_handler``). LangGraph coordinates the steps; AgentOAuth proves each
step's authority. LangGraph is imported only here (under orgs/buyer), never by core.
"""

from __future__ import annotations

from typing import Any, Optional, TypedDict

from langgraph.graph import END, StateGraph

from agentoauth_saga.models import SagaState
from agentoauth_saga.saga.orchestrator import Orchestrator, Step


class _State(TypedDict):
    last_receipt_id: Optional[str]
    halted: bool


def _halted(receipt) -> bool:
    if receipt.verdict.value == "DENY":
        return True
    return (receipt.metadata.get("exec") or {}).get("status") == "FAILED"


def build_buyer_graph(orchestrator: Orchestrator, steps: list[Step]):
    by_id = {s.step_id: s for s in steps}

    def make_node(step_id: str):
        def node(state: _State) -> dict[str, Any]:
            receipt = orchestrator.run_step(by_id[step_id])
            return {"last_receipt_id": orchestrator.last_receipt_id, "halted": _halted(receipt)}
        return node

    def route(state: _State) -> str:
        return "stop" if state.get("halted") else "continue"

    g = StateGraph(_State)
    g.add_node("analyst", make_node("analyst"))
    g.add_node("finance", make_node("finance"))
    g.add_node("buyer", make_node("buyer"))
    g.set_entry_point("analyst")
    g.add_conditional_edges("analyst", route, {"continue": "finance", "stop": END})
    g.add_conditional_edges("finance", route, {"continue": "buyer", "stop": END})
    g.add_edge("buyer", END)
    return g.compile()


def run_buyer_saga(orchestrator: Orchestrator, steps: list[Step]) -> SagaState:
    """Drive the LangGraph workflow and return the reconciled saga state."""
    app = build_buyer_graph(orchestrator, steps)
    app.invoke({"last_receipt_id": None, "halted": False})
    return orchestrator.reconcile()
