from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


@router.websocket("/ws")
async def websocket_connectivity_check(websocket: WebSocket) -> None:
    """Connectivity test only — no simulation/telemetry/agent events yet."""
    await websocket.accept()
    await websocket.send_json({"type": "heartbeat", "message": "connected"})
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_json({"type": "echo", "message": data})
    except WebSocketDisconnect:
        pass
