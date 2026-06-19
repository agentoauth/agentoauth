# SPDX-License-Identifier: MIT
"""WS3 — real interop with the canonical TypeScript AgentOAuth implementation.

Not mocked: this drives a Node runner that uses ``jose`` (the exact library the TS
SDK/verifier sign + verify with) and the REAL ``canonicalize.ts``. It proves three
things, the non-negotiable "AgentOAuth is a protocol" check:

  1. canonicalization byte-parity across non-integer fixtures (floats, nested,
     unicode, key ordering) — Python ``hash_policy`` == TS ``hashPolicy``;
  2. a Python-issued consent token verifies under the TS (jose) verifier;
  3. a TS-issued token verifies in the Python ``verify_compact``.

Skips cleanly when the TS toolchain isn't available (e.g. ``pnpm install`` + build
not run), so the suite stays green offline; CI runs it for real.
"""

from __future__ import annotations

import json
import os
import subprocess

import pytest

from agentoauth_saga.consent.jwk import jwk_from_dict, verify_compact
from agentoauth_saga.consent.keys import KeyRing
from agentoauth_saga.consent.token import issue_token
from agentoauth_saga.models import Action
from agentoauth_saga.policy.canonicalize import hash_policy

_HERE = os.path.dirname(os.path.abspath(__file__))               # .../agentoauth-saga/tests
_REPO = os.path.dirname(os.path.dirname(_HERE))                  # .../agentoauth (monorepo root)
_VERIFIER_API = os.path.join(_REPO, "packages", "verifier-api")
_TSX = os.path.join(_VERIFIER_API, "node_modules", ".bin", "tsx")
_CANON_TS = os.path.join(_VERIFIER_API, "src", "policy", "canonicalize.ts")
_RUNNER = os.path.join(_HERE, "interop", "ts_interop.mts")


def _jose_path() -> str | None:
    try:
        out = subprocess.run(
            ["node", "-e", "console.log(require.resolve('jose'))"],
            cwd=_VERIFIER_API, capture_output=True, text=True, timeout=30,
        )
        return out.stdout.strip() or None
    except Exception:
        return None


_JOSE = _jose_path()
_AVAILABLE = all(os.path.exists(p) for p in (_TSX, _CANON_TS, _RUNNER)) and bool(_JOSE)
pytestmark = pytest.mark.skipif(
    not _AVAILABLE,
    reason="TS toolchain not available (run `pnpm install` and `pnpm --filter @agentoauth/sdk build`)",
)


def _run(cmd: str, payload) -> dict:
    env = dict(os.environ, JOSE_PATH=_JOSE, CANON_PATH=_CANON_TS)
    proc = subprocess.run(
        [_TSX, _RUNNER, cmd],
        input=json.dumps(payload), capture_output=True, text=True, env=env, timeout=120,
    )
    assert proc.returncode == 0, f"interop runner failed: {proc.stderr}"
    return json.loads(proc.stdout)


# --- 1. canonicalization byte-parity --------------------------------------
_FIXTURES = [
    {"b": 1, "a": [3, 2, 1]},
    {"limits": {"per_txn": {"amount": 1000.5, "currency": "USD"}}, "id": "x"},
    {"z": {"y": [{"k": 2, "j": 1}], "nested": {"deep": {"v": 3.0}}}, "a": 1},
    {"unicode": "café ☕ 日本", "emoji": "🤝", "n": -2.25},
    {"arr_order": [3, 1, 2], "bool": True, "nul": None},
]


def test_canonicalization_byte_parity():
    ts = _run("hash", _FIXTURES)["hashes"]
    for fixture, ts_hash in zip(_FIXTURES, ts):
        assert hash_policy(fixture) == ts_hash, f"canon mismatch for {fixture}"


# --- 2. Python-signed verifies under the TS (jose) verifier ----------------
def test_python_token_verifies_in_ts():
    ring = KeyRing(seed="interop")
    agent_key = ring.agent_key("buyer@org-a")
    token = issue_token(
        "saga", "buyer", None, "buyer@org-a",
        Action(type="order.place", entity="order:XYZ",
               params={"amount": 40000, "supplier": "acme"},
               limits={"max_amount": 50000}),
        "reorder", agent_key,
    )
    from agentoauth_saga.consent.jwk import public_jwk_dict
    res = _run("verify", {"jws": token.signature, "jwk": public_jwk_dict(agent_key)})
    assert res["valid"] is True, res
    assert res["header"]["alg"] == "EdDSA" and res["header"]["typ"] == "JWT"
    assert res["payload"]["saga_id"] == "saga"


# --- 3. TS-signed verifies in Python ---------------------------------------
def test_ts_token_verifies_in_python():
    claims = {"saga_id": "saga", "step_id": "buyer", "scope": "order.place", "n": 7}
    out = _run("sign", {"claims": claims})
    decoded = verify_compact(out["jws"], jwk_from_dict(out["jwk"]))
    assert decoded["saga_id"] == "saga" and decoded["scope"] == "order.place"


# --- bonus: Python canon already matches without the runner ----------------
def test_python_canon_is_deterministic():
    assert hash_policy({"a": 1, "b": 2}) == hash_policy({"b": 2, "a": 1})
