# SPDX-License-Identifier: MIT
"""CLI viewer — render a saga receipt chain + reconciled state as a table.

Usable two ways:
  * ``render_saga(...)`` in-process (the demos call this), and
  * ``saga-view <saga.json>`` to load a dump and verify + render it offline.
"""

from __future__ import annotations

import json
import sys
from typing import Any

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from ..models import ConsentReceipt, SagaState
from ..receipts.reconcile import reconcile

_VERDICT_STYLE = {"ALLOW": "green", "CONFIRM": "yellow", "DENY": "red"}
_STATUS_STYLE = {
    "COMPLETE": "bold green",
    "COMPENSATED": "bold yellow",
    "INCONSISTENT": "bold red",
    "IN_PROGRESS": "bold blue",
}


def org_label(step_id: str) -> str:
    """Label a step by the org + framework that signed/owns it (best-effort)."""
    head = step_id.split(".")[0]
    if head == "buyer":
        return "Org B · CrewAI"
    if head in ("analyst", "finance"):
        return "Org A · LangGraph"
    return "Org A · LangGraph"  # compensations run on the initiating org


def _receipt_table(receipts: list[ConsentReceipt]) -> Table:
    table = Table(title="Receipt chain", show_lines=False, expand=True)
    table.add_column("#", justify="right")
    table.add_column("receipt_id", overflow="fold")
    table.add_column("step")
    table.add_column("org · framework")
    table.add_column("verdict")
    table.add_column("executed", justify="center")
    table.add_column("compensation_of", overflow="fold")
    table.add_column("parent", overflow="fold")
    for i, r in enumerate(receipts):
        verdict = r.verdict.value if hasattr(r.verdict, "value") else str(r.verdict)
        style = _VERDICT_STYLE.get(verdict, "white")
        table.add_row(
            str(i),
            r.receipt_id[:20],
            r.step_id,
            org_label(r.step_id),
            f"[{style}]{verdict}[/{style}]",
            "✓" if r.executed else "·",
            (r.compensation_of or "")[:20],
            (r.parent_receipt_id or "—")[:20],
        )
    return table


def render_saga(title: str, receipts: list[ConsentReceipt], state: SagaState, log: list[str] | None = None) -> None:
    console = Console()
    console.print(Panel.fit(f"[bold]{title}[/bold]\nsaga_id: {state.saga_id}", border_style="cyan"))
    if log:
        console.print("[dim]orchestrator log:[/dim]")
        for line in log:
            console.print(f"  [dim]{line}[/dim]")
    console.print(_receipt_table(receipts))
    status = state.reconciled_status.value
    style = _STATUS_STYLE.get(status, "white")
    summary = f"[{style}]RECONCILED: {status}[/{style}]"
    if state.unrecovered_steps:
        summary += f"\n[red]unrecovered steps (could not roll back): {', '.join(state.unrecovered_steps)}[/red]"
    console.print(Panel.fit(summary, border_style="cyan"))


def _load_dump(path: str) -> tuple[list[ConsentReceipt], list[dict[str, Any]], str]:
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
    receipts = [ConsentReceipt.model_validate(r) for r in data["receipts"]]
    return receipts, data.get("keys", []), data.get("saga_id", "")


def main(argv: list[str] | None = None) -> int:
    argv = argv if argv is not None else sys.argv[1:]
    if not argv:
        print("usage: saga-view <saga.json>", file=sys.stderr)
        return 2
    receipts, jwks, saga_id = _load_dump(argv[0])
    state = reconcile(receipts, jwks, saga_id)
    render_saga(f"Saga viewer — {argv[0]}", receipts, state)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
