"""`/ws/ai` — the command center's live view of the analysis graph.

The client opens one socket per session and correlates the milestones it
receives with the analysis it requested over HTTP. Events carry ids only, so
a client that missed some still renders correctly from the brief it fetches.

Auth: a WebSocket cannot carry an Authorization header from the browser, so
the Firebase ID token is passed as the `token` query parameter and verified
with exactly the same code path as every HTTP route (`app/core/auth.py`).
An unverified socket is closed, never downgraded to anonymous.
"""

from __future__ import annotations

import asyncio
import contextlib

from typing import Annotated

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from app.config.settings import settings
from app.core.auth import AuthenticatedUser, _get_verifier
from app.services.ai_events import bus

router = APIRouter()

WS_POLICY_VIOLATION = 1008
HEARTBEAT_SECONDS = 25.0


def websocket_user(websocket: WebSocket, token: str | None = None) -> AuthenticatedUser | None:
    """WebSocket counterpart of `get_current_user`.

    A browser cannot set an Authorization header on a WebSocket, so the
    Firebase ID token arrives as the `token` query parameter and is verified
    by exactly the same verifier. Returning None (rather than raising) lets
    the route close the socket with a policy-violation code instead of
    surfacing an HTTP error the client cannot read."""

    del websocket  # the token is the only credential; kept for DI symmetry
    if not token:
        if settings.auth_dev_bypass_uid:
            uid = settings.auth_dev_bypass_uid
            return AuthenticatedUser(uid=uid, email=f"{uid}@local.dev", name="Dev Operator", picture=None, sign_in_provider="dev-bypass")
        return None
    try:
        return _get_verifier().verify(token.strip())
    except Exception:  # noqa: BLE001 — a bad token or unconfigured auth closes the socket, never 500s it
        return None


WebSocketUser = Annotated[AuthenticatedUser | None, Depends(websocket_user)]


@router.websocket("/ws/ai")
async def ai_events(websocket: WebSocket, user: WebSocketUser) -> None:
    if user is None:
        await websocket.close(code=WS_POLICY_VIOLATION)
        return
    await websocket.accept()
    queue = bus.subscribe(user.uid)
    await websocket.send_json({"type": "AI_EVENTS_READY"})
    try:
        while True:
            try:
                message = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_SECONDS)
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "heartbeat"})
                continue
            await websocket.send_json(message)
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        bus.unsubscribe(user.uid, queue)
        with contextlib.suppress(RuntimeError):
            await websocket.close()
