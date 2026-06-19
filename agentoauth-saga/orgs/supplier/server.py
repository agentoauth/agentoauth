# SPDX-License-Identifier: MIT
"""Org B — the CrewAI supplier exposed as an A2A server (responder).

Run it standalone:

    python -m orgs.supplier.server            # 127.0.0.1:9999, mode=available

Env:
    SUPPLIER_HOST / SUPPLIER_PORT   bind address (default 127.0.0.1:9999)
    SUPPLIER_PUBLIC_URL             URL advertised in the Agent Card (default http://host:port/)
    SUPPLIER_MODE                   available | out_of_stock | price_violation | timeout
    SAGA_KEY_SEED                   deterministic keys for reproducible demos
"""

from __future__ import annotations

import os

import uvicorn
from a2a.server.apps import A2AStarletteApplication
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.tasks import InMemoryTaskStore
from a2a.types import AgentCapabilities, AgentCard, AgentSkill

from agentoauth_saga.consent.keys import KeyRing
from agentoauth_saga.verifier.verifier import LocalVerifier

from orgs.common.a2a_consent import PLACE_ORDER_SKILL
from orgs.supplier.executor import SupplierExecutor
from orgs.supplier.inventory import SupplierInventory


def build_agent_card(public_url: str) -> AgentCard:
    skill = AgentSkill(
        id=PLACE_ORDER_SKILL,
        name="Place Order",
        description=(
            "Place a purchase order. Requires an AgentOAuth consent token in the A2A "
            "message metadata (key 'agentoauth'); the supplier verifies the token's "
            "authority before acting and returns a signed Consent Receipt as an artifact."
        ),
        tags=["commerce", "procurement", "agentoauth"],
        examples=["place an order for SKU order:XYZ within a 50000 USD limit"],
    )
    return AgentCard(
        name="Acme Supplier (CrewAI)",
        description="External supplier agent (Org B), framework: CrewAI, transport: A2A.",
        url=public_url,
        version="0.1.0",
        default_input_modes=["text"],
        default_output_modes=["text"],
        capabilities=AgentCapabilities(streaming=True),
        skills=[skill],
    )


def build_app() -> A2AStarletteApplication:
    host = os.environ.get("SUPPLIER_HOST", "127.0.0.1")
    port = int(os.environ.get("SUPPLIER_PORT", "9999"))
    public_url = os.environ.get("SUPPLIER_PUBLIC_URL", f"http://{host}:{port}/")

    keyring = KeyRing(seed=os.environ.get("SAGA_KEY_SEED"))
    verifier = LocalVerifier(keyring.verifier_key())
    inventory = SupplierInventory.from_env()

    handler = DefaultRequestHandler(
        agent_executor=SupplierExecutor(verifier, inventory),
        task_store=InMemoryTaskStore(),
    )
    return A2AStarletteApplication(agent_card=build_agent_card(public_url), http_handler=handler)


def main() -> None:
    host = os.environ.get("SUPPLIER_HOST", "127.0.0.1")
    port = int(os.environ.get("SUPPLIER_PORT", "9999"))
    mode = os.environ.get("SUPPLIER_MODE", "available")
    print(f"[supplier] CrewAI A2A server on {host}:{port} (mode={mode})")
    uvicorn.run(build_app().build(), host=host, port=port, log_level="warning")


if __name__ == "__main__":
    main()
