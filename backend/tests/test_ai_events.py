"""The AI event bus: per-owner isolation, best-effort delivery, no blocking.

These run without a database — the bus is pure in-process fan-out."""

from __future__ import annotations

import asyncio

import pytest

from app.services.ai_events import AGENT_STARTED, QUEUE_MAXSIZE, AIEventBus


@pytest.mark.anyio
async def test_events_reach_only_the_owner_that_subscribed():
    bus = AIEventBus()
    mine = bus.subscribe("uid-a")
    theirs = bus.subscribe("uid-b")

    bus.publish_threadsafe("uid-a", AGENT_STARTED, {"agent_name": "hazard_agent", "frame_index": 3})
    await asyncio.sleep(0)

    message = mine.get_nowait()
    assert message == {"type": AGENT_STARTED, "agent_name": "hazard_agent", "frame_index": 3}
    assert theirs.empty()


@pytest.mark.anyio
async def test_publishing_with_no_subscriber_is_a_noop():
    bus = AIEventBus()
    queue = bus.subscribe("uid-a")
    bus.unsubscribe("uid-a", queue)
    bus.publish_threadsafe("uid-a", AGENT_STARTED, {"agent_name": "risk_agent"})
    await asyncio.sleep(0)
    assert queue.empty()
    assert bus.subscriber_count("uid-a") == 0


@pytest.mark.anyio
async def test_a_full_subscriber_drops_events_instead_of_blocking():
    bus = AIEventBus()
    queue = bus.subscribe("uid-a")
    for _ in range(QUEUE_MAXSIZE + 10):
        bus.publish_threadsafe("uid-a", AGENT_STARTED, {"agent_name": "hazard_agent"})
    await asyncio.sleep(0)
    # Nothing raised, nothing stalled; the queue simply stops at its bound.
    assert queue.qsize() == QUEUE_MAXSIZE


@pytest.fixture
def anyio_backend():
    return "asyncio"
