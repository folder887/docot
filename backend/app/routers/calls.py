"""WebRTC call signalling — lightweight relay of SDP offers/answers + ICE
candidates between two users in a 1:1 call.

Media never flows through this server. Once both sides have exchanged
their SDP+ICE, the WebRTC stack establishes a direct (or STUN-relayed)
peer connection and audio/video bypasses us entirely.

Why a fresh router instead of the chat hub:
- A call may exist without an active chat (e.g. cold-call to a contact
  whose DM was never opened on this device).
- Call peers are addressed by user-id, not chat-id.
- We forward any opaque JSON payload signed by the sender's token, so
  clients can extend the protocol (e.g. add `screen-share` later) without
  a backend change.

Authorization: the connecting user is authenticated by JWT (same as
chat WS). Peers are matched by `peerId` query param. Each user keeps at
most one signalling socket — a re-connect by the same user evicts the
previous socket so a phone-number swap or refresh doesn't leave a dead
relay endpoint open.
"""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..auth import user_from_token
from ..db import SessionLocal

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/calls", tags=["calls"])


class CallHub:
    """One signalling socket per user. Forwards opaque JSON to a target
    user. Disconnects clean up the slot so the next connect doesn't
    leak."""

    def __init__(self) -> None:
        self._sockets: dict[str, WebSocket] = {}
        self._lock = asyncio.Lock()

    async def attach(self, user_id: str, ws: WebSocket) -> WebSocket | None:
        """Register `ws` for `user_id`. Returns the previous socket if any
        so the caller can close it after releasing the lock (closing
        inside the lock would deadlock if it triggers our own detach)."""
        async with self._lock:
            old = self._sockets.get(user_id)
            self._sockets[user_id] = ws
            return old

    async def detach(self, user_id: str, ws: WebSocket) -> None:
        async with self._lock:
            cur = self._sockets.get(user_id)
            if cur is ws:
                self._sockets.pop(user_id, None)

    async def send(self, target_user_id: str, payload: dict[str, Any]) -> bool:
        async with self._lock:
            target = self._sockets.get(target_user_id)
        if not target:
            return False
        try:
            await target.send_json(payload)
            return True
        except Exception:  # noqa: BLE001
            # Drop the dead socket; the peer will eventually time out.
            await self.detach(target_user_id, target)
            return False


hub = CallHub()


# Allow-list of signalling event types. Anything else is dropped — keeps
# the relay from being abused as a generic WebSocket pubsub.
_ALLOWED_EVENTS = {
    "call:offer",       # caller → callee: kick off a call (sdp inside)
    "call:answer",      # callee → caller: accept (sdp inside)
    "call:ice",         # both ways: ICE candidate
    "call:reject",      # callee → caller: declined
    "call:end",         # either side: hang up
    "call:cancel",      # caller → callee: caller hung up before answer
    "call:ringing",     # callee → caller: device is alerting the user
    "call:media",       # either side: mute/cam-off state change
}

# Cap on a single frame the relay will forward. SDP blobs are usually
# < 6 KB; 32 KB leaves headroom for fat ICE / pre-bundled candidates
# without letting clients ship arbitrary payloads through us.
_MAX_FRAME_BYTES = 32 * 1024


@router.websocket("/ws")
async def calls_ws(websocket: WebSocket, token: str) -> None:
    """Per-user signalling socket. Auth happens once at connect time.

    Inbound frames are JSON `{ "type": "call:*", "to": "<userId>", ... }`.
    The relay re-emits the same frame to the target with the caller's
    user-id stamped into `from` so the receiver can verify identity.
    """
    await websocket.accept()
    db = SessionLocal()
    try:
        user = user_from_token(token, db)
        if not user:
            await websocket.close(code=4401)
            return
        my_id = user.id
    finally:
        db.close()

    old = await hub.attach(my_id, websocket)
    if old is not None:
        try:
            await old.close(code=4000)
        except Exception:  # noqa: BLE001
            pass

    try:
        while True:
            try:
                raw = await websocket.receive_text()
            except WebSocketDisconnect:
                break
            if len(raw) > _MAX_FRAME_BYTES:
                continue
            try:
                msg = _safe_json(raw)
            except ValueError:
                continue
            if not isinstance(msg, dict):
                continue
            ev = msg.get("type")
            target = msg.get("to")
            if not isinstance(ev, str) or ev not in _ALLOWED_EVENTS:
                continue
            if not isinstance(target, str) or not target or target == my_id:
                continue
            payload = dict(msg)
            payload["from"] = my_id
            ok = await hub.send(target, payload)
            if not ok and ev in ("call:offer", "call:ice"):
                # Tell the caller their target is offline so they can
                # surface "user is unavailable" instead of waiting on a
                # phantom answer.
                try:
                    await websocket.send_json(
                        {"type": "call:unreachable", "to": target}
                    )
                except Exception:  # noqa: BLE001
                    pass
    finally:
        await hub.detach(my_id, websocket)


def _safe_json(raw: str) -> Any:
    """json.loads with a strict guard — accepts only objects/arrays.

    Numbers and strings are valid JSON top-level values but we never
    want them as signalling frames; rejecting them here keeps the relay
    loop's type-check simple.
    """
    import json as _json

    val = _json.loads(raw)
    if not isinstance(val, (dict, list)):
        raise ValueError("non-container json")
    return val
