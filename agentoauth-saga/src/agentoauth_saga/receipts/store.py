# SPDX-License-Identifier: MIT
"""Receipt store — append + ordered retrieval, keyed by saga_id.

Backed by mongomock by default (offline); a real MongoDB is used when
``SAGA_MONGO_URL`` is set. Uses only plain insert/find (no aggregation) so the
mongomock and server paths behave identically. Also retains the public JWKS used
to verify the chain offline, and can dump a self-contained ``saga.json``.
"""

from __future__ import annotations

import json
import os
from typing import Any, Optional

from ..models import ConsentReceipt


class ReceiptStore:
    def __init__(self, mongo_url: Optional[str] = None) -> None:
        url = mongo_url if mongo_url is not None else os.environ.get("SAGA_MONGO_URL")
        if url:
            from pymongo import MongoClient  # optional dependency

            self._client = MongoClient(url)
            self._col = self._client.get_database("agentoauth_saga").get_collection("receipts")
            self._backend = "mongo"
        else:
            import mongomock

            self._client = mongomock.MongoClient()
            self._col = self._client["agentoauth_saga"]["receipts"]
            self._backend = "mongomock"
        # Insertion order is captured explicitly — mongomock does not guarantee
        # _id ordering matches insert order across all versions.
        self._seq = 0
        # Public JWKS for offline signature verification (agent + verifier keys).
        self._jwks: list[dict[str, Any]] = []

    @property
    def backend(self) -> str:
        return self._backend

    # -- keys ---------------------------------------------------------------
    def register_keys(self, jwks: list[dict[str, Any]]) -> None:
        """Merge public JWKs (deduped by kid) used to verify receipts/tokens."""
        known = {k.get("kid") for k in self._jwks}
        for k in jwks:
            if k.get("kid") not in known:
                self._jwks.append(k)
                known.add(k.get("kid"))

    @property
    def jwks(self) -> list[dict[str, Any]]:
        return list(self._jwks)

    # -- receipts -----------------------------------------------------------
    def append(self, receipt: ConsentReceipt) -> None:
        doc = receipt.model_dump(mode="json")
        doc["_seq"] = self._seq
        self._seq += 1
        self._col.insert_one(doc)

    def get_chain(self, saga_id: str) -> list[ConsentReceipt]:
        docs = self._col.find({"saga_id": saga_id})
        ordered = sorted(docs, key=lambda d: d["_seq"])
        return [ConsentReceipt.model_validate(_strip(d)) for d in ordered]

    def get_receipt(self, saga_id: str, receipt_id: str) -> Optional[ConsentReceipt]:
        doc = self._col.find_one({"saga_id": saga_id, "receipt_id": receipt_id})
        return ConsentReceipt.model_validate(_strip(doc)) if doc else None

    # -- dump ---------------------------------------------------------------
    def dump(self, saga_id: str) -> dict[str, Any]:
        """Self-contained dict: receipt chain + embedded public JWKS + reconciled state.

        No private keys are included, so the dump is safe to share and the chain
        verifies offline (signatures against the embedded JWKS).
        """
        from .reconcile import reconcile

        chain = self.get_chain(saga_id)
        state = reconcile(chain, self._jwks, saga_id)
        return {
            "saga_id": saga_id,
            "keys": self._jwks,
            "receipts": [r.model_dump(mode="json") for r in chain],
            "reconciled": state.model_dump(mode="json"),
        }

    def dump_json(self, saga_id: str, path: str) -> None:
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(self.dump(saga_id), fh, indent=2)


def _strip(doc: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in doc.items() if k not in ("_id", "_seq")}
