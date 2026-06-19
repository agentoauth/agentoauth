# SPDX-License-Identifier: MIT
"""MongoDB-backed inventory stub: approve / revert-approval.

Uses mongomock by default (offline, no Docker); a real MongoDB is used when
``SAGA_MONGO_URL`` is set. Only plain insert/update/delete are used so both
backends behave identically.
"""

from __future__ import annotations

import os
from typing import Any, Optional


class MongoStub:
    def __init__(self, mongo_url: Optional[str] = None) -> None:
        url = mongo_url if mongo_url is not None else os.environ.get("SAGA_MONGO_URL")
        if url:
            from pymongo import MongoClient

            client = MongoClient(url)
            self.backend = "mongo"
        else:
            import mongomock

            client = mongomock.MongoClient()
            self.backend = "mongomock"
        self._col = client["agentoauth_saga"]["inventory_approvals"]

    def execute(self, action) -> dict[str, Any]:
        """inventory.approve -> write an approval record."""
        self._col.update_one(
            {"entity": action.entity},
            {"$set": {"entity": action.entity, "status": "APPROVED",
                      "amount": action.params.get("amount")}},
            upsert=True,
        )
        return {"entity": action.entity, "status": "APPROVED"}

    def compensate(self, action) -> dict[str, Any]:
        """inventory.revert -> remove/flag the approval."""
        self._col.update_one(
            {"entity": action.entity},
            {"$set": {"status": "REVERTED"}},
        )
        return {"entity": action.entity, "status": "REVERTED"}

    def status(self, entity: str) -> Optional[str]:
        doc = self._col.find_one({"entity": entity})
        return doc["status"] if doc else None
