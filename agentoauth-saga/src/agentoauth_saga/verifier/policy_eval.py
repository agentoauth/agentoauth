# SPDX-License-Identifier: MIT
"""Thin policy-evaluation surface used by the verifier.

Keeps the verifier decoupled from the policy package internals: it asks here for
a verdict + decision basis + the policy identity that should be recorded into the
signed receipt.
"""

from __future__ import annotations

from typing import Any

from ..models import Action, Verdict
from ..policy.engine import evaluate, load_policy, policy_hash_for


def evaluate_for_verifier(
    action: Action,
    live_state: dict[str, Any] | None,
    policy_ref: str,
) -> tuple[Verdict, list[str], str, str]:
    """Return ``(verdict, decision_basis, policy_id, policy_hash)``."""
    verdict, basis = evaluate(action, live_state, policy_ref)
    policy = load_policy(policy_ref)
    policy_id = policy.get("id", policy_ref)
    return verdict, basis, policy_id, policy_hash_for(policy_ref)
