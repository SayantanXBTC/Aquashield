"""In-process fan-out of AI analysis milestones to connected operators.

The analysis graph runs synchronously inside the request thread (the same
prototype choice as simulation execution — CLAUDE.md §26). The command
center still needs to watch the agents work, so each node pushes a milestone
here and this bus fans it out to that operator's open AI event sockets.

Scope and guarantees, deliberately small:

* **Per-owner.** A subscriber only ever receives events published for its own
  verified Firebase uid — the same isolation rule as every scenario row.
* **Best effort.** Events are a live view, never the source of truth: the
  Command Brief is fetched over HTTP. A slow or full subscriber queue drops
  events rather than blocking the analysis.
* **In-process.** One uvicorn worker. Multi-worker deployment needs a real
  broker; that is a documented follow-up, not something to fake here.
* **No secrets.** Agent name, status, a one-line summary and ids only —
  never prompt text, API keys or chain-of-thought.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

logger = logging.getLogger(__name__)

QUEUE_MAXSIZE = 256

# Milestone names the frontend listens for (shared/types/index.ts mirrors these).
AI_ANALYSIS_STARTED = "AI_ANALYSIS_STARTED"
AGENT_STARTED = "AGENT_STARTED"
AGENT_COMPLETED = "AGENT_COMPLETED"
AI_ANALYSIS_COMPLETED = "AI_ANALYSIS_COMPLETED"
AI_ANALYSIS_FAILED = "AI_ANALYSIS_FAILED"
AI_ANALYSIS_STALE = "AI_ANALYSIS_STALE"


class AIEventBus:
    def __init__(self) -> None:
        self._subscribers: dict[str, set[asyncio.Queue[dict[str, Any]]]] = {}
        self._loop: asyncio.AbstractEventLoop | None = None

    def subscribe(self, owner_uid: str) -> asyncio.Queue[dict[str, Any]]:
        self._loop = asyncio.get_running_loop()
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=QUEUE_MAXSIZE)
        self._subscribers.setdefault(owner_uid, set()).add(queue)
        return queue

    def unsubscribe(self, owner_uid: str, queue: asyncio.Queue[dict[str, Any]]) -> None:
        subscribers = self._subscribers.get(owner_uid)
        if not subscribers:
            return
        subscribers.discard(queue)
        if not subscribers:
            self._subscribers.pop(owner_uid, None)

    def subscriber_count(self, owner_uid: str) -> int:
        return len(self._subscribers.get(owner_uid, ()))

    def _deliver(self, owner_uid: str, message: dict[str, Any]) -> None:
        for queue in tuple(self._subscribers.get(owner_uid, ())):
            try:
                queue.put_nowait(message)
            except asyncio.QueueFull:
                # A live view, not a log: drop rather than stall the analysis.
                logger.debug("AI event dropped for %s: subscriber queue full", owner_uid)

    def publish_threadsafe(self, owner_uid: str, event: str, data: dict[str, Any]) -> None:
        """Called from the analysis thread. A no-op when nobody is watching."""

        loop = self._loop
        if loop is None or not self._subscribers.get(owner_uid):
            return
        message = {"type": event, **data}
        try:
            loop.call_soon_threadsafe(self._deliver, owner_uid, message)
        except RuntimeError:
            # Event loop is gone (shutdown) — events are best effort.
            logger.debug("AI event dropped for %s: event loop unavailable", owner_uid)


bus = AIEventBus()
