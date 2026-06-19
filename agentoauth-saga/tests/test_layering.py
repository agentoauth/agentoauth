# SPDX-License-Identifier: MIT
"""Architectural gate: the authority+accountability core must not import LangGraph.

Only ``agents/`` and ``saga/`` may import langgraph. This makes the framework-
agnostic constraint a CI gate rather than a comment. Enforced two ways:
  1. AST scan of every core source file for any langgraph import,
  2. importing every core module in a subprocess where ``langgraph`` is shadowed
     by a module that raises on import.
"""

from __future__ import annotations

import ast
import subprocess
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / "src" / "agentoauth_saga"
CORE_DIRS = ["consent", "policy", "verifier", "receipts", "systems"]


def _core_files() -> list[Path]:
    files = [SRC / "models.py"]
    for d in CORE_DIRS:
        files.extend((SRC / d).rglob("*.py"))
    return files


def test_core_has_no_langgraph_import_ast():
    offenders = []
    for path in _core_files():
        tree = ast.parse(path.read_text())
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for n in node.names:
                    if n.name.split(".")[0] == "langgraph":
                        offenders.append(str(path))
            elif isinstance(node, ast.ImportFrom):
                if (node.module or "").split(".")[0] == "langgraph":
                    offenders.append(str(path))
    assert not offenders, f"core modules must not import langgraph: {offenders}"


def test_core_imports_with_langgraph_shadowed():
    """Import the core modules with langgraph poisoned; any usage would ImportError."""
    modules = ["agentoauth_saga.models"]
    for d in CORE_DIRS:
        for path in (SRC / d).rglob("*.py"):
            if path.name == "__init__.py":
                modules.append(f"agentoauth_saga.{d}")
            else:
                modules.append(f"agentoauth_saga.{d}.{path.stem}")

    code = (
        "import sys, types\n"
        "poison = types.ModuleType('langgraph')\n"
        "class _Boom:\n"
        "    def __getattr__(self, _):\n"
        "        raise ImportError('langgraph must not be used by core')\n"
        "poison.__getattr__ = lambda name: (_ for _ in ()).throw(ImportError('no langgraph in core'))\n"
        "sys.modules['langgraph'] = poison\n"
        f"for m in {modules!r}:\n"
        "    __import__(m)\n"
        "print('OK')\n"
    )
    result = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    assert "OK" in result.stdout
