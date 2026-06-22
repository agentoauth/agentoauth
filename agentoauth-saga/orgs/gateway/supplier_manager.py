# SPDX-License-Identifier: MIT
"""Manage real CrewAI supplier subprocesses for the live demo gateway.

One supplier process per scenario *mode* (its private reality), launched lazily on
first use and cached for the gateway's lifetime. Each runs on its own localhost
port, so the buyer→supplier leg still crosses a real HTTP wire inside the container.
Reuses the same launch+readiness approach as demos/_a2a_harness.supplier_process.
"""

from __future__ import annotations

import os
import subprocess
import sys
import time

import httpx

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# scenario -> (supplier mode, localhost port)
SCENARIOS: dict[str, tuple[str, int]] = {
    "success": ("available", 9991),
    "out_of_stock": ("out_of_stock", 9992),
    "price_violation": ("price_violation", 9993),
}
SUPPLIER_SEED = "org-b"


class SupplierManager:
    def __init__(self) -> None:
        self._procs: dict[str, subprocess.Popen] = {}

    def url_for(self, scenario: str, ready_timeout: float = 40.0) -> str:
        """Return the base URL of a ready supplier for ``scenario`` (starting it if needed)."""
        if scenario not in SCENARIOS:
            raise KeyError(f"unknown scenario: {scenario}")
        mode, port = SCENARIOS[scenario]
        url = f"http://127.0.0.1:{port}"
        if scenario in self._procs and self._procs[scenario].poll() is None:
            return url
        self._start(mode, port, ready_timeout)
        self._procs[scenario] = self._last_proc
        return url

    def _start(self, mode: str, port: int, ready_timeout: float) -> None:
        env = dict(os.environ)
        env.update({
            "SUPPLIER_MODE": mode,
            "SUPPLIER_HOST": "127.0.0.1",
            "SUPPLIER_PORT": str(port),
            "SAGA_KEY_SEED": SUPPLIER_SEED,
            "PYTHONPATH": PROJECT_ROOT + os.pathsep + env.get("PYTHONPATH", ""),
        })
        proc = subprocess.Popen(
            [sys.executable, "-m", "orgs.supplier.server"],
            cwd=PROJECT_ROOT, env=env,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
        )
        card = f"http://127.0.0.1:{port}/.well-known/agent-card.json"
        deadline = time.time() + ready_timeout
        while time.time() < deadline:
            if proc.poll() is not None:
                out = proc.stdout.read() if proc.stdout else ""
                raise RuntimeError(f"supplier (mode={mode}) exited early:\n{out}")
            try:
                if httpx.get(card, timeout=2.0).status_code == 200:
                    self._last_proc = proc
                    return
            except Exception:
                time.sleep(0.3)
        proc.terminate()
        raise RuntimeError(f"supplier (mode={mode}) did not become ready on :{port}")

    def shutdown(self) -> None:
        for proc in self._procs.values():
            proc.terminate()
        for proc in self._procs.values():
            try:
                proc.wait(timeout=8)
            except Exception:
                proc.kill()
        self._procs.clear()
