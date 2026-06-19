# AgentOAuth Saga Accountability Layer

> Orchestrators (A2A‑SAGA / Temporal / LangGraph) **coordinate the steps**.
> AgentOAuth **proves each step's authority and records the reconciled outcome**.

A runnable reference implementation that extends [AgentOAuth](https://github.com/agentoauth/agentoauth)'s
single‑action consent‑token / consent‑receipt primitive from **one action** to a **multi‑step,
cross‑system saga** — including the partial‑failure‑with‑compensation path. It demonstrates the
**authority + accountability layer** on a 3‑agent procurement workflow: prove every step was
authorized, judge whether it was correct, and emit a neutral, self‑verifying record of the true
reconciled state when compensation half‑fails.

This is the **proof layer, not an orchestrator.** The saga harness here is intentionally thin.

---

## What it does

| Command | Scenario | Reconciled state |
|---|---|---|
| `python demos/run_happy.py` | All 3 steps authorized + executed | **`COMPLETE`** |
| `python demos/run_failure.py` | Final step fails → compensate in reverse | **`COMPENSATED`** |
| `python demos/run_compensation_fails.py` | A reversal is itself irreversible | **`INCONSISTENT`** (unrecovered step flagged) |

Every receipt is an **EdDSA compact JWS** that verifies **offline** against the public JWKS embedded
in the dump — no call back to the verifier. A CLI and a single static HTML file render the chain.

## Quick start (offline by default)

```bash
cd agentoauth-saga
python -m venv .venv && . .venv/bin/activate
pip install -e .

python demos/run_happy.py             # -> COMPLETE
python demos/run_failure.py           # -> COMPENSATED
python demos/run_compensation_fails.py # -> INCONSISTENT

# View a dumped chain in the terminal:
saga-view saga_failure.json

# Or open the static viewer and load a saga*.json (no backend, no storage):
#   src/agentoauth_saga/viewer/web/index.html
```

Everything runs with no network, no Docker: in‑process verifier, `mongomock`, and ephemeral keys.

## The worked example

Procurement reorder, `saga_id = "reorder-XYZ"`:

1. **Analyst** → `inventory.approve(order:XYZ)` → token → verify → ALLOW → write approval to mongo‑stub → **R1**
2. **Finance** → `budget.allocate(amount: 40000, limit: 50000)`, `live_state {budget_available: 60000}` → token *(parent R1)* → ALLOW → write invoice to erp‑stub → **R2**
3. **Buyer** → `order.place(supplier: acme)` → supplier‑stub (configurable failure)

On failure the saga compensates in reverse — `budget.void` (**R2c**, `compensation_of=R2`), then
`inventory.revert` (**R1c**, `compensation_of=R1`) — and `reconcile()` walks the signed chain to the
true state. With `compensation_fails=true`, R2's void fails → `INCONSISTENT`, R2 flagged as
unrecovered (the honest "you can't always roll back" case).

## Architecture

```
demo orchestrator (THIN harness — not the product)
   │  runs steps; on failure triggers compensation
   ▼
multi-agent workflow (LangGraph: Analyst → Finance → Buyer)
   ▼
┌──────────────────────────────────────────────┐
│  AUTHORITY + ACCOUNTABILITY LAYER (the product)│
│  consent   → issue/sign Consent Token (sig 1)  │
│  verifier  → validate vs policy (+ live state) │
│              → issue signed, linked Receipt(s2)│
│  policy    → ALLOW | CONFIRM | DENY            │
│  receipts  → linked chain by saga_id           │
│              + verify_chain() + reconcile()     │
└──────────────────────────────────────────────┘
   ▼
system stubs:  mongo-stub | erp-stub | supplier-stub(failure modes)
   ▼
viewer (CLI + static HTML): chain + reconciled state
```

The core (`consent` / `policy` / `verifier` / `receipts` / `systems`) is **framework‑agnostic** and
**never imports LangGraph** — enforced by `tests/test_layering.py`. Only `agents/` and `saga/` may.

### Signatures & the chain
- **Signature 1 (agent):** the Consent Token is an attached EdDSA compact JWS over a signed‑claims
  subset (`saga.consent.v0`).
- **Signature 2 (verifier):** the Consent Receipt is an attached EdDSA compact JWS (`receipt.saga.v0`)
  carrying the policy decision, `consent_token_hash`, and `parent_receipt_id`.
- `verify_chain()` checks, offline against the embedded public JWKS: every signature, that the signed
  payload still matches the stored fields (tamper‑evidence), the `parent_receipt_id` linked list, and
  that each `compensation_of` points at an earlier receipt.

## Reuse of AgentOAuth — and honest deviations

This project is built to **reuse AgentOAuth's signing/verification — no new crypto.** A few facts
shaped the implementation; they're called out here for honesty:

- **There is no AgentOAuth *Python* SDK** — upstream is TypeScript only. So we re‑implement the
  **same scheme** (Ed25519/EdDSA **compact JWS**, header `{alg:"EdDSA", kid, typ:"JWT"}`) in Python via
  `jwcrypto`/`cryptography`. The output is wire‑compatible: a receipt signed here verifies under
  standard JOSE/WebCrypto (validated in CI‑style checks against Node's native WebCrypto), and our
  policy canonicalization is **byte‑for‑byte identical** to the TS `canonicalizePolicy`.
- **The hosted route is `/verify`, not `/verify-consent`** (the PRD's name). The optional
  `verifier/hosted_adapter.py` posts to `/verify`; the path is env‑overridable (`SAGA_HOSTED_VERIFY_PATH`).
- **`CONFIRM`** is a saga‑local verdict (AgentOAuth receipts are ALLOW|DENY). It is always decided by
  the local policy engine and never round‑trips through a hosted verifier. In the demo it
  auto‑approves with a logged note (`SAGA_AUTO_CONFIRM`, default on).
- **`price_hallucination`** is a **verify‑time DENY**: the supplier quotes a price that violates the
  action `limits`, surfaced to the verifier via `live_state["quoted_amount"]`, so the order is denied
  *before* any side effect. `out_of_stock` / `timeout` are **execution failures** that trigger
  compensation of prior committed steps.
- **Execution outcome** (`metadata.exec`) is recorded *after* the authorization decision is signed —
  the receipt signature covers the decision + linkage; the execution result is a later annotation that
  `reconcile()` reads.

## Configuration (env, no secrets in code)

| Var | Default | Meaning |
|---|---|---|
| `SAGA_VERIFIER` | `local` | `hosted` to use the hosted adapter |
| `SAGA_HOSTED_VERIFIER_URL` / `SAGA_HOSTED_VERIFY_PATH` | `verifier.agentoauth.org` / `/verify` | hosted endpoint |
| `SAGA_MONGO_URL` | _(unset → mongomock)_ | real MongoDB for the mongo‑stub |
| `SAGA_AUTO_CONFIRM` | `1` | auto‑approve CONFIRM in the demo |
| `SAGA_KEY_SEED` | _(unset → random)_ | deterministic keys for diffable dumps |
| `SAGA_VERIFIER_PRIVATE_JWK`, `SAGA_AGENT_PRIVATE_JWK_<ID>` | _(unset → ephemeral)_ | bring your own keys |
| `SAGA_OUT_DIR` | cwd | where demos write `saga*.json` |

## Layout

```
src/agentoauth_saga/
  models.py                 # pydantic models + enums
  consent/  jwk.py keys.py token.py        # JWS/JWK, key ring, token issuance (sig 1)
  policy/   engine.py canonicalize.py policies/reorder.yaml
  verifier/ verifier.py policy_eval.py hosted_adapter.py   # decision + receipt (sig 2)
  receipts/ store.py verify_chain.py reconcile.py
  saga/     orchestrator.py                 # thin harness (no LangGraph)
  agents/   graph.py analyst.py finance.py buyer.py        # LangGraph workflow
  systems/  mongo_stub.py erp_stub.py supplier_stub.py
  viewer/   cli.py web/index.html
demos/   run_happy.py run_failure.py run_compensation_fails.py
tests/   test_policy.py test_receipts_chain.py test_reconcile.py
         test_verifier.py test_layering.py test_e2e.py
```

## Tests

```bash
pip install -e ".[dev]"
pytest
```

Covers the policy table (threshold / allowlist / budget / review‑band / price‑hallucination), the
golden policy‑hash pin, chain signatures + linkage, all four reconcile statuses, the LangGraph
isolation gate, and the three end‑to‑end scenarios.

## License

MIT — consistent with AgentOAuth.
