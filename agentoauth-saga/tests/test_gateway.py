# SPDX-License-Identifier: MIT
"""The live demo gateway runs the real handshake and returns verifiable artifacts.

Uses FastAPI's TestClient (which drives the lifespan, so a real supplier subprocess
is launched per scenario). The two signatures and the consent_token_hash binding in
the returned trace must be genuine.
"""

from __future__ import annotations

import hashlib

import pytest
from fastapi.testclient import TestClient

from orgs.gateway.server import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_healthz(client):
    r = client.get("/healthz")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert set(body["scenarios"]) == {"success", "out_of_stock", "price_violation"}


def _run(client, scenario):
    r = client.post("/api/handshake", json={"scenario": scenario})
    assert r.status_code == 200, r.text
    return r.json()


def _binding_holds(trace) -> bool:
    sig = trace["token"]["signature"]
    expected = "sha256:" + hashlib.sha256(sig.encode()).hexdigest()
    return expected == trace["receipt"]["consent_token_hash"]


@pytest.mark.parametrize(
    "scenario, state, verdict, category",
    [
        ("success", "completed", "ALLOW", "fulfilled"),
        ("out_of_stock", "failed", "ALLOW", "fulfillment_failed"),
        ("price_violation", "rejected", "DENY", "authority_denied"),
    ],
)
def test_handshake_trace(client, scenario, state, verdict, category):
    t = _run(client, scenario)
    assert t["a2a_state"] == state
    assert t["verify"]["verdict"] == verdict
    assert t["crew"]["category"] == category
    # Both signatures are present and the receipt is bound to the exact token.
    assert t["token"]["signature"] and t["receipt"]["signature"]
    assert t["token"]["agent_jwk"] and t["receipt"]["verifier_jwk"]
    assert _binding_holds(t)
    assert t["verify"]["decision_basis"]  # real policy rules fired


def test_unknown_scenario_400(client):
    r = client.post("/api/handshake", json={"scenario": "nope"})
    assert r.status_code == 400
