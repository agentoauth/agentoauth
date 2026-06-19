# SPDX-License-Identifier: MIT
"""The supplier's CrewAI agent — reasons over private inventory to decide fulfilment.

Hybrid by design (per the build decision):
  * If an LLM key is present (``OPENAI_API_KEY`` / ``ANTHROPIC_API_KEY`` / ``GEMINI_API_KEY``),
    a real CrewAI ``Agent``/``Task``/``Crew`` reasons over the private inventory (exposed
    as a tool) and produces a human-readable justification.
  * Otherwise it falls back to a deterministic decision so the demo runs offline and
    reproducibly here.

Either way the *authoritative* fulfilment outcome (in stock? timed out?) is governed
by the supplier's system of record (``SupplierInventory``) — an LLM never invents
stock. The crew supplies reasoning; ground truth supplies the decision. The separate,
security-critical authority check (consent-token signature + the quoted price vs the
buyer's authorized limit) is enforced by the AgentOAuth verifier in the executor, not
here. ``crewai`` is imported lazily so this module stays importable (and testable)
without it.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

from .inventory import Decision, OrderRequest, SupplierInventory

_LLM_KEYS = ("OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "GROQ_API_KEY")


def has_llm() -> bool:
    return any(os.environ.get(k) for k in _LLM_KEYS)


@dataclass
class CrewDecision:
    decision: Decision
    reasoning: str
    used_llm: bool


class SupplierCrew:
    """Wraps the fulfilment decision; runs a real CrewAI crew when an LLM is available."""

    def __init__(self, inventory: SupplierInventory) -> None:
        self.inventory = inventory

    def decide(self, request: OrderRequest) -> CrewDecision:
        ground_truth = self.inventory.decide(request)
        if has_llm():
            try:
                reasoning = self._reason_with_crew(request, ground_truth)
                return CrewDecision(ground_truth, reasoning, used_llm=True)
            except Exception as exc:  # noqa: BLE001 - never let LLM issues block the demo
                return CrewDecision(
                    ground_truth,
                    f"(LLM reasoning unavailable: {exc}); decided from inventory of record",
                    used_llm=False,
                )
        return CrewDecision(ground_truth, self._deterministic_reasoning(request, ground_truth), used_llm=False)

    # -- deterministic explanation -----------------------------------------
    @staticmethod
    def _deterministic_reasoning(request: OrderRequest, d: Decision) -> str:
        if d.category == "fulfilled":
            return (f"Supplier '{request.supplier_name}' has SKU {request.sku} in stock; "
                    f"quoted {d.quoted_price:.0f} {request.currency}, within the authorized limit.")
        if d.category == "authority_denied":
            return (f"Supplier would charge {d.quoted_price:.0f} for SKU {request.sku}, which "
                    f"exceeds the buyer's authorized limit — declining on authority grounds.")
        return f"Supplier cannot fulfil SKU {request.sku}: {d.reason}."

    # -- real CrewAI reasoning ---------------------------------------------
    def _reason_with_crew(self, request: OrderRequest, ground_truth: Decision) -> str:
        from crewai import Agent, Crew, Task  # lazy import

        snapshot = (
            f"sku={request.sku} requested_amount={request.requested_amount} "
            f"currency={request.currency} authorized_limit={request.max_amount} "
            f"inventory_mode={self.inventory.mode} quoted_price={ground_truth.quoted_price:.0f} "
            f"system_of_record_decision={ground_truth.category} reason={ground_truth.reason!r}"
        )
        agent = Agent(
            role="Supplier fulfilment officer",
            goal="Decide whether to fulfil purchase orders, honouring stock reality and the buyer's authorized spend limit.",
            backstory="You run order desk for a parts supplier and never promise stock you don't have.",
            verbose=False,
            allow_delegation=False,
        )
        task = Task(
            description=(
                "Given this order and your private inventory snapshot, explain in 2-3 sentences "
                "whether you will fulfil it and why. Your system of record has already determined "
                f"the outcome; justify it clearly. Snapshot: {snapshot}"
            ),
            expected_output="A short justification for the fulfilment decision.",
            agent=agent,
        )
        result = Crew(agents=[agent], tasks=[task], verbose=False).kickoff()
        return str(getattr(result, "raw", result)).strip()
