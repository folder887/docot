from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from .config import get_settings
from .db import Base, SessionLocal, engine
from .models import Chat, Message, now_ms
from .routers import (
    auth,
    calls,
    chats,
    events,
    folders,
    invites,
    keys,
    link_preview,
    notes,
    polls,
    posts,
    reports,
    uploads,
    users,
)

logger = logging.getLogger(__name__)


# Lightweight in-place migrations for SQLite (we don't use Alembic).
# Each entry: (table_name, column_name, "<column DDL fragment>")
_MIGRATIONS: list[tuple[str, str, str]] = [
    ("chats", "description", "TEXT NOT NULL DEFAULT ''"),
    ("chats", "is_public", "INTEGER NOT NULL DEFAULT 0"),
    ("chats", "slow_mode_seconds", "INTEGER NOT NULL DEFAULT 0"),
    ("chats", "subscribers_only", "INTEGER NOT NULL DEFAULT 0"),
    ("chats", "signed_posts", "INTEGER NOT NULL DEFAULT 0"),
    ("chats", "auto_delete_seconds", "INTEGER NOT NULL DEFAULT 0"),
    ("messages", "edited_at", "INTEGER"),
    ("messages", "deleted_at", "INTEGER"),
    ("messages", "reply_to_id", "VARCHAR"),
    ("messages", "sealed", "INTEGER NOT NULL DEFAULT 0"),
    ("users", "avatar_url", "VARCHAR(500) NOT NULL DEFAULT ''"),
    ("users", "avatar_svg", "TEXT NOT NULL DEFAULT ''"),
    ("users", "status", "VARCHAR(140) NOT NULL DEFAULT ''"),
    ("users", "presence", "VARCHAR(16) NOT NULL DEFAULT 'everyone'"),
    ("users", "phone_visibility", "VARCHAR(16) NOT NULL DEFAULT 'contacts'"),
    ("users", "search_visibility", "VARCHAR(16) NOT NULL DEFAULT 'everyone'"),
    ("users", "links", "TEXT NOT NULL DEFAULT ''"),
    ("users", "bot_owner_id", "VARCHAR NOT NULL DEFAULT ''"),
    ("messages", "pinned", "INTEGER NOT NULL DEFAULT 0"),
    ("messages", "pinned_at", "INTEGER"),
    ("posts", "community_id", "VARCHAR NOT NULL DEFAULT ''"),
    ("posts", "title", "VARCHAR(300) NOT NULL DEFAULT ''"),
    # v0.1.6: topics + admin log + content restrictions + invite requests
    ("messages", "topic_id", "VARCHAR"),
    ("chats", "ban_media", "INTEGER NOT NULL DEFAULT 0"),
    ("chats", "ban_voice", "INTEGER NOT NULL DEFAULT 0"),
    ("chats", "ban_stickers", "INTEGER NOT NULL DEFAULT 0"),
    ("chats", "ban_links", "INTEGER NOT NULL DEFAULT 0"),
    ("chats", "topics_enabled", "INTEGER NOT NULL DEFAULT 0"),
    ("chat_invites", "require_approval", "INTEGER NOT NULL DEFAULT 0"),
    ("chat_invites", "name", "VARCHAR(80) NOT NULL DEFAULT ''"),
]


def _apply_migrations() -> None:
    insp = inspect(engine)
    with engine.begin() as conn:
        for table, column, ddl in _MIGRATIONS:
            if not insp.has_table(table):
                continue
            cols = {c["name"] for c in insp.get_columns(table)}
            if column in cols:
                continue
            try:
                conn.execute(text(f'ALTER TABLE {table} ADD COLUMN {column} {ddl}'))
            except Exception as exc:  # noqa: BLE001
                logger.warning("Migration ADD COLUMN %s.%s failed: %s", table, column, exc)


def _migrate_signal_to_multi_device() -> None:
    """Single-device → multi-device upgrade for the Signal key tables.

    The original schema keyed `user_keys` by user_id only and `one_time_prekeys`
    by (user_id, key_id). Multi-device requires a `device_id` column in both
    tables, which means the PK / unique constraints have to change. SQLite can't
    rewrite a PK in place, so when the legacy schema is detected we drop both
    crypto tables. `Base.metadata.create_all` recreates them with the new shape
    on the next call, and clients transparently re-upload their bundles.
    Account data (users, chats, messages) is untouched.
    """
    insp = inspect(engine)
    with engine.begin() as conn:
        if not insp.has_table("user_keys"):
            return
        cols = {c["name"] for c in insp.get_columns("user_keys")}
        if "device_id" in cols:
            return
        logger.warning("Upgrading user_keys/one_time_prekeys to multi-device schema")
        conn.execute(text("DROP TABLE IF EXISTS one_time_prekeys"))
        conn.execute(text("DROP TABLE IF EXISTS user_keys"))


def _purge_expired_messages_once() -> int:
    """Tomb-stone messages older than each chat's auto_delete_seconds.

    Sealed (E2E) ciphertext is replaced with empty text and `deleted_at` is
    stamped, mirroring the user-initiated delete path. Returns the number
    of messages purged. Errors are logged and suppressed so a transient
    DB issue can't crash the whole worker.
    """
    purged = 0
    try:
        db = SessionLocal()
        try:
            chats = db.query(Chat).filter(Chat.auto_delete_seconds > 0).all()
            now = now_ms()
            for chat in chats:
                ttl_ms = int(chat.auto_delete_seconds) * 1000
                cutoff = now - ttl_ms
                rows = (
                    db.query(Message)
                    .filter(
                        Message.chat_id == chat.id,
                        Message.created_at < cutoff,
                        Message.deleted_at.is_(None),
                    )
                    .all()
                )
                for m in rows:
                    m.text = ""
                    m.deleted_at = now
                purged += len(rows)
            if purged:
                db.commit()
        finally:
            db.close()
    except Exception as exc:  # noqa: BLE001
        logger.warning("auto-delete purge failed: %s", exc)
    return purged


async def _purge_loop() -> None:
    """Run `_purge_expired_messages_once` every 60s for the lifetime of the app."""
    while True:
        await asyncio.sleep(60)
        await asyncio.to_thread(_purge_expired_messages_once)


@asynccontextmanager
async def _lifespan(_: FastAPI):
    task = asyncio.create_task(_purge_loop())
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except (asyncio.CancelledError, Exception):  # noqa: BLE001
            pass


def create_app() -> FastAPI:
    settings = get_settings()
    _migrate_signal_to_multi_device()
    Base.metadata.create_all(bind=engine)
    _apply_migrations()

    app = FastAPI(title="docot", version="1.0.0", lifespan=_lifespan)
    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/healthz")
    def healthz() -> dict:
        return {"ok": True}

    app.include_router(auth.router)
    app.include_router(users.router)
    app.include_router(chats.router)
    app.include_router(notes.router)
    app.include_router(events.router)
    app.include_router(posts.router)
    app.include_router(posts.communities_router)
    app.include_router(folders.router)
    app.include_router(invites.router)
    app.include_router(keys.router)
    app.include_router(polls.router)
    app.include_router(uploads.router)
    app.include_router(link_preview.router)
    app.include_router(reports.router)
    app.include_router(calls.router)
    return app


app = create_app()
