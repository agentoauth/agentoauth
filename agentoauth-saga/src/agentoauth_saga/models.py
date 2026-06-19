# SPDX-License-Identifier: MIT
# AgentOAuth Saga Accountability Layer
"""Core data models for the saga authority + accountability layer.

These pydantic models extend AgentOAuth's single-action consent-token/receipt
primitive with saga-chaining (``saga_id`` / ``parent_receipt_id``) and an
ontology-typed :class:`Action`. They are framework-agnostic — nothing here
imports LangGraph or any orchestrator.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class Verdict(str, Enum):
    """Policy decision. Most-restrictive-wins ordering is DENY > CONFIRM > ALLOW."""

    ALLOW = "ALLOW"
    CONFIRM = "CONFIRM"
    DENY = "DENY"


class ReconciledStatus(str, Enum):
    """Terminal (or in-flight) state of a reconciled saga."""

    COMPLETE = "COMPLETE"
    COMPENSATED = "COMPENSATED"
    INCONSISTENT = "INCONSISTENT"
    IN_PROGRESS = "IN_PROGRESS"


# Per-forward-step classification used by reconcile().
StepStatus = Literal[
    "DONE",
    "DENIED",
    "IN_PROGRESS",
    "COMPENSATED",
    "COMPENSATION_FAILED",
    "FAILED",
]


class Action(BaseModel):
    """Ontology-typed action: what is being done, to what, within what limits."""

    type: str = Field(..., description="e.g. 'inventory.approve', 'budget.allocate', 'order.place'")
    entity: str = Field(..., description="e.g. 'order:XYZ', 'vendor:acme'")
    params: dict[str, Any] = Field(default_factory=dict)
    limits: dict[str, Any] = Field(default_factory=dict)


class ConsentToken(BaseModel):
    """Agent-issued, agent-signed request for authority to perform one saga step."""

    saga_id: str
    step_id: str
    parent_receipt_id: Optional[str] = None
    agent_id: str
    action: Action
    policy_ref: str
    policy_hash: str
    issued_at: str
    expiry: str
    # Signature 1 — compact EdDSA JWS over the signed-claims subset (see consent/token.py).
    signature: str


class ConsentReceipt(BaseModel):
    """Verifier-issued, verifier-signed, self-verifying record of one decision."""

    receipt_id: str
    saga_id: str
    step_id: str
    parent_receipt_id: Optional[str] = None
    consent_token_hash: str
    verdict: Verdict
    decision_basis: list[str] = Field(default_factory=list)
    executed: bool = False
    compensation_of: Optional[str] = None
    policy_id: str = ""
    policy_hash: str = ""
    reason: str = ""
    remaining: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)
    ts: str = ""
    # Signature 2 — compact EdDSA JWS over the signed-claims subset (see verifier/verifier.py).
    verifier_signature: str = ""


class StepState(BaseModel):
    """Reconciled view of a single forward step."""

    step_id: str
    receipt_id: str
    action: Optional[Action] = None
    verdict: Verdict
    executed: bool = False
    compensated: bool = False
    status: StepStatus
    unrecovered: bool = False


class SagaState(BaseModel):
    """Reconciled view of the whole saga."""

    saga_id: str
    steps: list[StepState] = Field(default_factory=list)
    reconciled_status: ReconciledStatus
    unrecovered_steps: list[str] = Field(default_factory=list)
    reason: str = ""
