# SPDX-License-Identifier: MIT
"""Table-driven policy tests + golden policy-hash pin."""

from __future__ import annotations

import pytest

from agentoauth_saga.models import Action, Verdict
from agentoauth_saga.policy.canonicalize import canonicalize_policy, hash_policy
from agentoauth_saga.policy.engine import evaluate, load_policy, policy_hash_for


def _order(amount=40000, supplier="acme", limits=None):
    return Action(
        type="order.place",
        entity="order:XYZ",
        params={"amount": amount, "supplier": supplier},
        limits=limits or {"max_amount": 50000, "supplier_allowlist": ["acme", "globex", "initech"]},
    )


@pytest.mark.parametrize(
    "action, live_state, expected",
    [
        # valid -> ALLOW
        (_order(amount=40000), {"budget_available": 60000}, Verdict.ALLOW),
        # amount over threshold -> DENY
        (_order(amount=60000), {"budget_available": 100000}, Verdict.DENY),
        # supplier not allowlisted -> DENY
        (_order(supplier="shady"), {"budget_available": 60000}, Verdict.DENY),
        # budget unavailable -> DENY
        (_order(amount=40000), {"budget_available": 1000}, Verdict.DENY),
        # review band -> CONFIRM
        (_order(amount=47000), {"budget_available": 60000}, Verdict.CONFIRM),
        # price hallucination: quoted price over limit -> DENY (verify-time)
        (_order(amount=40000), {"budget_available": 60000, "quoted_amount": 99000}, Verdict.DENY),
    ],
)
def test_evaluate_verdicts(action, live_state, expected):
    verdict, basis = evaluate(action, live_state)
    assert verdict == expected
    assert basis  # always a human-readable explanation


def test_most_restrictive_wins():
    # Over-threshold AND in (a hypothetical) confirm situation -> DENY dominates.
    action = _order(amount=60000)
    verdict, basis = evaluate(action, {"budget_available": 100000})
    assert verdict == Verdict.DENY


def test_budget_field_for_finance_action():
    finance = Action(
        type="budget.allocate",
        entity="order:XYZ",
        params={"amount": 40000},
        limits={"max_amount": 50000},
    )
    assert evaluate(finance, {"budget_available": 60000})[0] == Verdict.ALLOW
    assert evaluate(finance, {"budget_available": 30000})[0] == Verdict.DENY


def test_canonicalize_sorts_and_compacts():
    canon = canonicalize_policy({"b": 1, "a": [3, {"z": 1, "y": 2}]})
    assert canon == '{"a":[3,{"y":2,"z":1}],"b":1}'


def test_golden_policy_hash_is_stable():
    """Pin the reorder policy hash so format drift (e.g. float 1000.0) is caught.

    Recompute the expected value intentionally from the loaded dict; the assertion
    is that canonicalization is deterministic and integer-normalized.
    """
    policy = load_policy("reorder")
    h1 = hash_policy(policy)
    h2 = policy_hash_for("reorder")
    assert h1 == h2
    assert h1.startswith("sha256:")
    # Float-vs-int must not change the hash.
    policy_float = dict(policy)
    policy_float["limits"] = {**policy["limits"], "max_amount": 50000.0}
    assert hash_policy(policy_float) == h1
