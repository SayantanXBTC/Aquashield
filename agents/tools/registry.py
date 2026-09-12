"""Tool wrappers: every data access goes through `ToolRunner.call`, which
times the call, records it for the audit trail, and converts failures into
DATA_UNAVAILABLE limitations instead of exceptions. Agents never call the
data access object directly."""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Callable, TypeVar

from agents.schemas.evidence import DATA_UNAVAILABLE, DataLimitation
from agents.schemas.state import ToolCallRecord
from agents.tools.data_access import AnalysisDataAccess

T = TypeVar("T")


@dataclass
class ToolRunner:
    data: AnalysisDataAccess
    agent: str
    calls: list[ToolCallRecord] = field(default_factory=list)
    limitations: list[DataLimitation] = field(default_factory=list)

    def call(self, tool: str, fn: Callable[[], T], *, subject: str, **arguments: Any) -> T | None:
        started = time.perf_counter()
        try:
            result = fn()
            ok = True
            note = None
        except Exception as exc:  # any data-layer failure is a limitation, never a crash
            result = None
            ok = False
            note = f"{type(exc).__name__}: {exc}"[:200]
            self.limitations.append(DataLimitation(code=DATA_UNAVAILABLE, subject=subject, detail=note))
        self.calls.append(
            ToolCallRecord(
                agent=self.agent,
                tool=tool,
                arguments=arguments,
                ok=ok,
                duration_ms=round((time.perf_counter() - started) * 1000, 3),
                note=note,
            )
        )
        return result

    def unavailable(self, subject: str, detail: str) -> None:
        self.limitations.append(DataLimitation(code=DATA_UNAVAILABLE, subject=subject, detail=detail))
