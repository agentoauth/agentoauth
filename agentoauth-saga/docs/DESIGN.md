# Design Doc — AgentOAuth Profile for A2A + ARD
## Verifiable authority for cross-organization agent actions

Status: design (no implementation in this document). Audience: AgentOAuth maintainers + the
A2A/ARD community.

---

## 1. Purpose

[ARD](https://developers.googleblog.com/announcing-the-agentic-resource-discovery-specification/)
standardizes **discovery** (orgs publish `ai-catalog.json`; registries crawl it). **A2A** standardizes
**transport** (Agent Cards + Tasks). Neither defines how two *independent* organizations establish
**verifiable authority for an action** — proof of *what was authorized, by whom, within what limits,
and what was decided*, that anyone can check without trusting either party.

This document specifies how **AgentOAuth** composes with ARD and A2A to fill that gap, so two parties
that share no code and no prior trust can: discover each other, agree on a bounded action, and produce
an independently-verifiable, non-repudiable record — with the verifier **neutral** (not controlled by
the party that benefits).

## 2. The layered model

```
DISCOVERY   ARD  ai-catalog.json (/.well-known)     "who can do X, and where is their agent"
TRANSPORT   A2A  AgentCard + Tasks                  "how I call that agent"
AUTHORITY   AgentOAuth  Consent Token + Receipt     "may this action happen, and what was decided"  ← this doc
IDENTITY    per-domain JWKS (/.well-known)          "whose key signed this"
VERIFIER    neutral, pluggable authority            "who judges + signs the receipt (not the beneficiary)"
```

AgentOAuth is **not new crypto** — it is the authority *profile* the other layers leave to implementers:
two Ed25519 signatures (the initiator's **Consent Token** and the verifier's **Consent Receipt**) plus
the identity, advertisement, and neutrality rules that make them meaningful between strangers.

## 3. Trust model (the crux)

Separate two questions that are easy to conflate:

- **"Was this action authorized?"** — **Falsifiable by anyone.** Policy is *public* and *content-addressed*
  (`policy_hash`) and evaluation is *deterministic*, so any third party can recompute the verdict from
  `(action, policy)` and detect a dishonest decision. A signed, bound receipt that says `ALLOW` on an
  over-limit action is self-incriminating evidence.
- **"Did the responder actually perform it?"** — **The responder's claim.** AgentOAuth records it
  (signed → non-repudiable) but cannot prove the physical side-effect. That needs a settlement
  oracle / system-of-record and is **out of scope** here.

From this, the **neutrality requirement**: the receipt must be signed by a party that does not benefit
from the outcome. Two supported models (a deployment chooses; they can coexist and are negotiated
per-handshake):

1. **Self-run + deterministic public policy.** Each org may run its own verifier; trust is minimized
   not by neutrality but by *auditability* — the decision is reproducible and the receipt is bound, so
   cheating is detectable. Cheapest to adopt; good for low/medium stakes.
2. **Shared third-party verifier.** A verifier both parties accept (e.g. a hosted AgentOAuth verifier)
   signs the receipt — neutral by construction. Better for higher stakes; adds an availability
   dependency.

(*Future: a federation/registry where parties advertise accepted verifiers and a quorum/threshold of
independent verifiers attest. Noted, not specified here.*)

Properties the profile guarantees regardless of model: **non-repudiation** (every decision signed),
**binding** (`consent_token_hash` ties a receipt to exactly one token), **tamper-evidence**, and
**offline verifiability** (anyone with the public keys can check, no callback).

## 4. Identity & keys

- An organization is identified by a **domain** (the token `iss`). It publishes Ed25519 public keys as
  a **JWKS at `https://<domain>/.well-known/jwks.json`**, each key carrying a `kid`; rotation is
  additive (old `kid`s remain until expiry).
- **Resolution replaces trust-on-first-use:** a counterparty's keys are fetched from its domain JWKS
  (location also discoverable via the ARD catalog / AgentCard). A signature is trusted because it
  verifies against a key published under the domain that the token claims as `iss`/verifier.
- Baseline trust root is **web-PKI / domain control** (you trust `acme.com`'s key because it's served
  over TLS from `acme.com`). Stronger identity (DIDs, org certificates) is an optional upgrade that
  slots into the same `iss`→key resolution step.

## 5. Discovery & authority advertisement

- The org publishes **`ai-catalog.json`** (ARD) at its well-known path, listing its A2A agent(s); each
  entry references the agent's **AgentCard** URL.
- The **AgentCard** is extended with an **AgentOAuth security scheme** that declares, per skill:
  - the **required action/scope** (e.g. `order.place`),
  - the governing **policy** by `id` + **`policy_hash`** (content-addressed),
  - the **limits** envelope,
  - the **accepted verifier(s)** (URLs / identifiers),
  - the **`jwks_url`** for the responder's keys.
- Effect: **before calling**, the initiator learns exactly what authority is required, which policy
  governs it, and *who is allowed to verify it* — and can decline up front if it accepts none of the
  responder's verifiers (trust mismatch surfaces before any action).

## 6. The two authority objects

Both are **EdDSA (Ed25519) compact JWS**, independently verifiable; header `{alg:"EdDSA", kid, typ:"JWT"}`.

**Consent Token (Signature 1 — the initiator).** Signed claims (illustrative):
```
ver, iss (initiator domain), agent (initiator agent id), sub/user (optional human principal),
aud (responder agent/domain),           # binds the token to its intended recipient
action { type, resource, params, limits },
scope, policy_id, policy_hash,          # the policy both sides must agree on
nonce, jti, iat, exp,                   # freshness + one-time-use
intent (optional)                       # WebAuthn human approval for high-stakes actions
```

**Consent Receipt (Signature 2 — the neutral verifier).** Signed claims:
```
ver, id, decision (ALLOW|CONFIRM|DENY), reason, decision_basis[],
consent_token_hash,                     # sha256 of the exact token JWS — the binding
policy_id, policy_hash, verifier (who signed), iat, ts, remaining (optional)
```

`consent_token_hash` is the cryptographic glue: a receipt cannot be paired with a different request.

## 7. Policy agreement

Policies are **content-addressed**: `policy_hash = sha256(canonical(policy))`, with a canonicalization
that is byte-identical across implementations. The responder advertises `policy_id + policy_hash` on its
card; the initiator **pins that hash** into the token. The verifier resolves the policy *by hash* and
**rejects on mismatch** — so it is provable that both parties evaluated the *same* rules. Because
evaluation is deterministic, the verdict is reproducible (and a wrong one is falsifiable) by any third
party.

## 8. The neutral verifier (pluggable)

A single interface — `verify(token, context) → signed Consent Receipt` — with interchangeable
implementations: **self-run deterministic**, **shared third-party**, (**future**) **federated/quorum**.

**Selection rule:** at handshake, the chosen verifier must lie in the **intersection** of the
initiator's accepted verifiers and the responder's advertised accepted verifiers. Empty intersection →
no deal (the trust gap is made explicit rather than papered over). The receipt is signed by that
verifier's key — **never by the beneficiary** when a neutral verifier is selected.

## 9. Anti-abuse (safe between strangers)

- **`aud`** binds the token to the intended responder (stops relay/reuse against a third party).
- **`iss`** binds to the initiator's domain; the responder verifies Sig 1 against that domain's JWKS.
- **`exp`** keeps tokens short-lived; **`nonce`/`jti`** are recorded in a replay store for one-time use.
- **Revocation:** the verifier/issuer checks `jti` and `policy_id` against a revocation endpoint.
- **`intent`** (WebAuthn/passkey) optionally requires a human approval bound to `policy_hash` for
  high-stakes actions.

## 10. End-to-end handshake (stranger → stranger)

```
1. A discovers B via ARD ai-catalog.json → B's A2A agent → AgentCard.
2. A reads B's card: required scope, policy_id+policy_hash, accepted verifiers, jwks_url.
3. A resolves B's public keys (JWKS) and confirms it accepts one of B's verifiers (V).
4. A issues + signs the Consent Token: aud=B, policy_hash=B's, action ≤ limits   🔏 Sig 1.
5. A → B over A2A, carrying the token and A's iss (so B can resolve A's key).
6. B resolves A's key from A's domain JWKS; checks Sig 1, aud, iss, exp, nonce/jti, revocation.
7. The chosen neutral verifier V evaluates the policy (resolved by policy_hash) → verdict.
8. V signs the Consent Receipt, bound to the token via consent_token_hash             🔏 Sig 2.
9. B performs the action iff ALLOW; returns the receipt as the A2A artifact + task state.
10. A verifies Sig 2 against V's key + the binding; anyone can re-verify offline, forever.
```
(The current reference demo renders steps 4–10; see [`handshake.mmd`](handshake.mmd). This design adds
steps 1–3 — domain key resolution + advertisement — and makes V *neutral* in steps 7–8.)

## 11. Threat model (summary)

| Threat | Mitigation |
|---|---|
| Responder signs a dishonest `ALLOW` | deterministic public policy + signed, bound receipt → falsifiable; with a neutral verifier, the beneficiary can't sign at all |
| Initiator forges authority | token must verify against the `iss` domain's published JWKS; `aud`/`exp`/replay |
| Replay / relay to a third party | `aud` binding + one-time `nonce`/`jti` |
| Stale / rotated / compromised key | `kid` + JWKS rotation + revocation (`jti`/policy) |
| Responder claims it acted but didn't | **not** solved — non-repudiable claim only; needs a settlement oracle (out of scope) |

## 12. Out of scope

Physical execution / settlement proof; running a discovery registry/crawler (we *publish* ARD
catalogs); production key custody (HSM/KMS); legal / dispute resolution; payment rails.

## 13. Relationship to the current reference implementation (honest delta)

| Design element | In the demo today | Added by this design |
|---|---|---|
| Two signatures (Token / Receipt) | ✅ implemented | — |
| A2A transport, Agent Card | ✅ | — |
| Deterministic, content-addressed policy (`policy_hash`) | ✅ (TS-interop proven) | enforce mismatch rejection |
| Identity / keys | TOFU (embedded in messages) | **domain JWKS resolution** |
| Authority advertisement | skill description only | **AgentCard AgentOAuth security scheme + ai-catalog.json** |
| Verifier | inside Org B (beneficiary) | **neutral, pluggable, negotiated** |
| `aud`/`iss`/replay/revocation | partial / not enforced | **enforced** |

## 14. Open questions

- **Policy distribution:** by-reference (fetch by `policy_id`, pin by hash) vs by-value (carry the
  policy in the token). Recommendation: by-reference + hash pin.
- **Verifier governance:** how accepted-verifier lists are curated; registry vs self-declared.
- **Identity strength:** domain/web-PKI baseline vs DIDs/verifiable credentials.
- **Standardization path:** publish as an **A2A extension** (security scheme) + an **AgentOAuth
  profile** doc, referencing ARD for discovery.
