# SPDX-License-Identifier: MIT
"""Optional adapter to a hosted AgentOAuth verifier.

Default demo path is the local in-process :class:`LocalVerifier` (offline). This
adapter is used only when ``SAGA_VERIFIER=hosted``.

NOTE ON THE PRD: the PRD references ``/verify-consent``; the real local + hosted
AgentOAuth verifiers expose ``POST /verify`` (see ``packages/verifier-api/src/index.ts``
and ``packages/hosted-verifier``). We post to ``/verify`` and treat the returned
receipt JWS as the upstream receipt. The path is env-overridable via
``SAGA_HOSTED_VERIFY_PATH`` so a future ``/verify-consent`` alias still works.

CONFIRM is a saga-local concept (AgentOAuth receipts are ALLOW|DENY only), so the
hosted path never decides CONFIRM — CONFIRM is always computed by the LOCAL policy
engine. Use the hosted adapter only for ALLOW/DENY signature + limit checks.
"""

from __future__ import annotations

import os
from typing import Any, Optional

import httpx

DEFAULT_BASE = "https://verifier.agentoauth.org"


class HostedVerifierAdapter:
    def __init__(
        self,
        base_url: Optional[str] = None,
        verify_path: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout: float = 10.0,
    ) -> None:
        self.base_url = (base_url or os.environ.get("SAGA_HOSTED_VERIFIER_URL", DEFAULT_BASE)).rstrip("/")
        self.verify_path = verify_path or os.environ.get("SAGA_HOSTED_VERIFY_PATH", "/verify")
        self.api_key = api_key or os.environ.get("SAGA_HOSTED_API_KEY")
        self.timeout = timeout

    def verify(self, token_jws: str, context: dict[str, Any]) -> dict[str, Any]:
        """POST the token to the hosted verifier; return the parsed JSON response.

        ``context`` carries action/resource/amount/currency just like the TS
        ``POST /verify`` body. The caller maps ``decision``/``receipt`` onto a
        saga :class:`~agentoauth_saga.models.ConsentReceipt`.
        """
        headers = {"content-type": "application/json"}
        if self.api_key:
            headers["authorization"] = f"Bearer {self.api_key}"
        body = {"token": token_jws, **context}
        with httpx.Client(timeout=self.timeout) as client:
            resp = client.post(f"{self.base_url}{self.verify_path}", json=body, headers=headers)
            resp.raise_for_status()
            data = resp.json()
        # The hosted verifier returns {valid, decision, receipt (compact JWS), ...};
        # some deployments nest it under "policy_decision". Normalise both.
        if "policy_decision" in data and isinstance(data["policy_decision"], dict):
            return data["policy_decision"]
        return data
