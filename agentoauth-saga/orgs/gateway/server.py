# SPDX-License-Identifier: MIT
"""Live demo gateway — a single service for the two-signature visualization.

Serves the animated frontend and, on demand, runs the REAL buyer→supplier A2A
handshake (LangGraph Org A ↔ CrewAI Org B) for a scenario, returning a trace of
genuine artifacts the browser re-verifies. Designed to run as one Railway service:
it binds ``0.0.0.0:$PORT`` and lazily launches the supplier subprocesses itself.
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from agentoauth_saga.consent.keys import KeyRing
from agentoauth_saga.models import Action
from orgs.buyer.client import place_order_via_a2a
from orgs.gateway.supplier_manager import SCENARIOS, SupplierManager
from orgs.gateway.trace import build_trace

_STATIC = Path(__file__).parent / "static"
_BUYER_SEED = os.environ.get("BUYER_SEED", "org-a")


def _demo_action() -> Action:
    return Action(
        type="order.place",
        entity="order:XYZ",
        params={"amount": 40000, "supplier": "acme", "currency": "USD"},
        limits={"max_amount": 50000, "supplier_allowlist": ["acme", "globex", "initech"]},
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.suppliers = SupplierManager()
    try:
        yield
    finally:
        app.state.suppliers.shutdown()


app = FastAPI(title="AgentOAuth over A2A — live two-signature demo", lifespan=lifespan)


class HandshakeRequest(BaseModel):
    scenario: str = "success"


@app.get("/healthz")
async def healthz() -> dict[str, object]:
    return {"ok": True, "scenarios": list(SCENARIOS.keys())}


@app.post("/api/handshake")
async def handshake(req: HandshakeRequest) -> JSONResponse:
    """Run the real handshake for a scenario and return the genuine-artifact trace."""
    if req.scenario not in SCENARIOS:
        raise HTTPException(status_code=400, detail=f"unknown scenario '{req.scenario}'")
    suppliers: SupplierManager = app.state.suppliers
    try:
        url = suppliers.url_for(req.scenario)
    except Exception as exc:  # supplier failed to start
        raise HTTPException(status_code=503, detail=f"supplier unavailable: {exc}") from exc

    action = _demo_action()
    outcome = await place_order_via_a2a(
        supplier_url=url, saga_id="demo", step_id="buyer",
        parent_receipt_id=None, action=action, keyring=KeyRing(seed=_BUYER_SEED),
    )
    return JSONResponse(build_trace(req.scenario, action, outcome))


# Static frontend (index.html at /).
if _STATIC.exists():
    app.mount("/", StaticFiles(directory=str(_STATIC), html=True), name="static")


def main() -> None:
    port = int(os.environ.get("PORT", "8000"))
    host = os.environ.get("HOST", "0.0.0.0")
    print(f"[gateway] live two-signature demo on {host}:{port}")
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
