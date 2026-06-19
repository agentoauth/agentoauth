# SPDX-License-Identifier: MIT
"""Hosted verifier adapter: request shape + response normalisation (mocked httpx).

These run fully offline by monkeypatching ``httpx.Client`` — no network.
"""

from __future__ import annotations

import httpx
import pytest

from agentoauth_saga.verifier import hosted_adapter as ha


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


class _FakeClient:
    """Captures the last POST and returns a canned response."""

    last = {}

    def __init__(self, *args, **kwargs):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def post(self, url, json=None, headers=None):
        _FakeClient.last = {"url": url, "json": json, "headers": headers}
        return _FakeResponse(_FakeClient.response)


@pytest.fixture
def fake_httpx(monkeypatch):
    monkeypatch.setattr(httpx, "Client", _FakeClient)
    _FakeClient.last = {}
    return _FakeClient


def test_posts_to_verify_with_token_and_context(fake_httpx):
    fake_httpx.response = {"valid": True, "decision": "ALLOW", "receipt": "jws.compact.sig"}
    adapter = ha.HostedVerifierAdapter(base_url="https://verifier.example", api_key="secret")
    out = adapter.verify("TOKEN_JWS", {"action": "order.place", "amount": 40000})

    sent = fake_httpx.last
    assert sent["url"] == "https://verifier.example/verify"  # PRD's /verify-consent does NOT exist
    assert sent["json"]["token"] == "TOKEN_JWS"
    assert sent["json"]["action"] == "order.place"
    assert sent["headers"]["authorization"] == "Bearer secret"
    assert out["decision"] == "ALLOW" and out["receipt"] == "jws.compact.sig"


def test_unwraps_nested_policy_decision(fake_httpx):
    fake_httpx.response = {"policy_decision": {"decision": "DENY", "receipt": "x.y.z"}}
    adapter = ha.HostedVerifierAdapter(base_url="https://v.example")
    out = adapter.verify("T", {})
    assert out == {"decision": "DENY", "receipt": "x.y.z"}
    # No api_key -> no auth header.
    assert "authorization" not in fake_httpx.last["headers"]


def test_verify_path_is_env_overridable(fake_httpx, monkeypatch):
    monkeypatch.setenv("SAGA_HOSTED_VERIFY_PATH", "/verify-consent")
    fake_httpx.response = {"decision": "ALLOW"}
    adapter = ha.HostedVerifierAdapter(base_url="https://v.example")
    adapter.verify("T", {})
    assert fake_httpx.last["url"] == "https://v.example/verify-consent"
