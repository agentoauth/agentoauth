# SPDX-License-Identifier: MIT
"""Declarative policy engine — ALLOW | CONFIRM | DENY, most-restrictive-wins.

Mirrors the intent of ``packages/verifier-api/src/policy/engine.py`` but typed
for saga :class:`Action`s. Rules are loaded from YAML; each rule names a built-in
``check`` from a fixed vocabulary. Every triggered rule contributes its verdict
and a human-readable ``decision_basis`` line; the most restrictive verdict wins.
"""

from __future__ import annotations

import functools
from pathlib import Path
from typing import Any, Callable

import yaml

from ..models import Action, Verdict
from .canonicalize import hash_policy

_POLICY_DIR = Path(__file__).parent / "policies"

# DENY > CONFIRM > ALLOW
_RANK = {Verdict.ALLOW: 0, Verdict.CONFIRM: 1, Verdict.DENY: 2}


@functools.lru_cache(maxsize=None)
def load_policy(policy_ref: str) -> dict[str, Any]:
    """Load a policy YAML by ref (bare name like ``reorder`` or ``reorder.yaml``)."""
    name = policy_ref if policy_ref.endswith((".yaml", ".yml")) else f"{policy_ref}.yaml"
    path = _POLICY_DIR / name
    if not path.exists():
        raise FileNotFoundError(f"policy not found: {path}")
    return yaml.safe_load(path.read_text())


def policy_hash_for(policy_ref: str) -> str:
    return hash_policy(load_policy(policy_ref))


# --- check vocabulary -----------------------------------------------------
# Each predicate returns (triggered: bool, basis_message: str).
CheckResult = tuple[bool, str]


def _effective_amount(action: Action, live_state: dict[str, Any] | None) -> float | None:
    """Amount the limit is checked against — the supplier-quoted price if the
    verifier was handed one (catches ``price_hallucination``), else the requested amount."""
    if live_state and live_state.get("quoted_amount") is not None:
        return live_state["quoted_amount"]
    return action.params.get("amount")


def _max_amount(action: Action, policy: dict[str, Any]) -> float | None:
    return action.limits.get("max_amount", policy.get("limits", {}).get("max_amount"))


def _allowlist(action: Action, policy: dict[str, Any]) -> list[str]:
    return action.limits.get("supplier_allowlist", policy.get("supplier_allowlist", []))


def _check_amount_exceeds_limit(action, live_state, policy) -> CheckResult:
    amount = _effective_amount(action, live_state)
    limit = _max_amount(action, policy)
    if amount is None or limit is None:
        return False, ""
    quoted = live_state and live_state.get("quoted_amount") is not None
    if amount > limit:
        src = "quoted price" if quoted else "amount"
        return True, f"{src} {amount} exceeds max_amount {limit}"
    return False, ""


def _check_supplier_not_allowlisted(action, live_state, policy) -> CheckResult:
    supplier = action.params.get("supplier")
    if supplier is None:
        return False, ""
    allow = _allowlist(action, policy)
    if supplier not in allow:
        return True, f"supplier '{supplier}' not in allowlist {allow}"
    return False, ""


def _check_budget_insufficient(action, live_state, policy) -> CheckResult:
    if not live_state or live_state.get("budget_available") is None:
        return False, ""
    amount = action.params.get("amount")
    if amount is None:
        return False, ""
    budget = live_state["budget_available"]
    if budget < amount:
        return True, f"budget_available {budget} < required {amount}"
    return False, ""


def _check_amount_in_review_band(action, live_state, policy) -> CheckResult:
    band = policy.get("review_band")
    amount = action.params.get("amount")
    if not band or amount is None:
        return False, ""
    if band["min"] <= amount <= band["max"]:
        return True, f"amount {amount} within review band [{band['min']},{band['max']}]"
    return False, ""


_CHECKS: dict[str, Callable[[Action, dict | None, dict], CheckResult]] = {
    "amount_exceeds_limit": _check_amount_exceeds_limit,
    "supplier_not_allowlisted": _check_supplier_not_allowlisted,
    "budget_insufficient": _check_budget_insufficient,
    "amount_in_review_band": _check_amount_in_review_band,
}


def evaluate(
    action: Action,
    live_state: dict[str, Any] | None = None,
    policy_ref: str = "reorder",
) -> tuple[Verdict, list[str]]:
    """Evaluate ``action`` against the policy; return ``(verdict, decision_basis)``.

    Most-restrictive-wins. If no rule triggers, the verdict is ALLOW.
    """
    policy = load_policy(policy_ref)
    verdict = Verdict.ALLOW
    basis: list[str] = []

    for rule in policy.get("rules", []):
        check = _CHECKS.get(rule["check"])
        if check is None:
            continue
        triggered, message = check(action, live_state, policy)
        if triggered:
            rule_verdict = Verdict(rule["verdict"])
            basis.append(f"{rule['id']}: {message} -> {rule_verdict.value}")
            if _RANK[rule_verdict] > _RANK[verdict]:
                verdict = rule_verdict

    if not basis:
        basis.append(f"no rule triggered -> {Verdict.ALLOW.value}")
    return verdict, basis
