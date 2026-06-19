# SPDX-License-Identifier: MIT
"""Architectural gate: the authority+accountability core must stay agnostic.

The core (``consent`` / ``verifier`` / ``policy`` / ``receipts`` / ``systems`` /
``models``) must not import any orchestration framework or transport — not
``langgraph``, ``a2a``, or ``crewai``. Only ``saga/`` (the thin orchestrator)
may import langgraph; A2A and CrewAI live solely under ``orgs/``. This makes the
framework- & transport-agnostic constraint a CI gate rather than a comment.
Enforced two ways:
  1. AST scan of every core source file for any forbidden import,
  2. importing every core module in a subprocess where the forbidden packages are
     shadowed by modules that raise on import.
"""

from __future__ import annotations

import ast
import subprocess
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / "src" / "agentoauth_saga"
CORE_DIRS = ["consent", "policy", "verifier", "receipts", "systems"]
FORBIDDEN = ("langgraph", "a2a", "crewai")


def _core_files() -> list[Path]:
    files = [SRC / "models.py"]
    for d in CORE_DIRS:
        files.extend((SRC / d).rglob("*.py"))
    return files


def test_core_has_no_forbidden_import_ast():
    offenders = []
    for path in _core_files():
        tree = ast.parse(path.read_text())
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for n in node.names:
                    if n.name.split(".")[0] in FORBIDDEN:
                        offenders.append((str(path), n.name))
            elif isinstance(node, ast.ImportFrom):
                if (node.module or "").split(".")[0] in FORBIDDEN:
                    offenders.append((str(path), node.module))
    assert not offenders, f"core modules must not import {FORBIDDEN}: {offenders}"


def test_core_imports_with_frameworks_shadowed():
    """Import every core module with langgraph/a2a/crewai poisoned; usage would ImportError."""
    modules = ["agentoauth_saga.models"]
    for d in CORE_DIRS:
        for path in (SRC / d).rglob("*.py"):
            if path.name == "__init__.py":
                modules.append(f"agentoauth_saga.{d}")
            else:
                modules.append(f"agentoauth_saga.{d}.{path.stem}")

    code = (
        "import sys, types\n"
        f"for name in {list(FORBIDDEN)!r}:\n"
        "    poison = types.ModuleType(name)\n"
        "    poison.__getattr__ = (lambda n: (lambda attr: (_ for _ in ()).throw(\n"
        "        ImportError(f'{n} must not be used by core'))))(name)\n"
        "    sys.modules[name] = poison\n"
        f"for m in {modules!r}:\n"
        "    __import__(m)\n"
        "print('OK')\n"
    )
    result = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    assert "OK" in result.stdout
