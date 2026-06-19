# SPDX-License-Identifier: MIT
"""Launch the supplier A2A server as a SEPARATE process (real wire, no shortcut).

Shared by the handshake/saga demos and the e2e tests. Waits for the Agent Card to
be served before yielding, and tears the process down afterwards.
"""

from __future__ import annotations

import contextlib
import os
import subprocess
import sys
import time

import httpx

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


@contextlib.contextmanager
def supplier_process(mode: str = "available", port: int = 9999,
                     seed: str = "handshake-demo", host: str = "127.0.0.1",
                     ready_timeout: float = 30.0):
    """Start ``python -m orgs.supplier.server`` and wait until its Agent Card is up."""
    env = dict(os.environ)
    env.update({
        "SUPPLIER_MODE": mode,
        "SUPPLIER_HOST": host,
        "SUPPLIER_PORT": str(port),
        "SAGA_KEY_SEED": seed,
        "PYTHONPATH": PROJECT_ROOT + os.pathsep + env.get("PYTHONPATH", ""),
    })
    proc = subprocess.Popen(
        [sys.executable, "-m", "orgs.supplier.server"],
        cwd=PROJECT_ROOT, env=env,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
    )
    card_url = f"http://{host}:{port}/.well-known/agent-card.json"
    try:
        deadline = time.time() + ready_timeout
        while time.time() < deadline:
            if proc.poll() is not None:
                out = proc.stdout.read() if proc.stdout else ""
                raise RuntimeError(f"supplier exited early (code {proc.returncode}):\n{out}")
            try:
                if httpx.get(card_url, timeout=2.0).status_code == 200:
                    break
            except Exception:
                time.sleep(0.3)
        else:
            raise RuntimeError("supplier did not become ready in time")
        yield f"http://{host}:{port}"
    finally:
        proc.terminate()
        with contextlib.suppress(Exception):
            proc.wait(timeout=10)
        if proc.poll() is None:
            proc.kill()
