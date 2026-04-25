from __future__ import annotations

import asyncio
from collections import defaultdict

from fastapi import WebSocket


class ChatHub:
    def __init__(self) -> None:
        self._rooms: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def join(self, chat_id: str, ws: WebSocket) -> None:
        async with self._lock:
            self._rooms[chat_id].add(ws)

    async def leave(self, chat_id: str, ws: WebSocket) -> None:
        async with self._lock:
            self._rooms[chat_id].discard(ws)
            if not self._rooms[chat_id]:
                self._rooms.pop(chat_id, None)

    async def broadcast(self, chat_id: str, payload: dict) -> None:
        async with self._lock:
            conns = list(self._rooms.get(chat_id, set()))
        for conn in conns:
            try:
                await conn.send_json(payload)
            except Exception:
                pass


hub = ChatHub()
