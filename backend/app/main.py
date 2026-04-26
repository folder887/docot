from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from .config import get_settings
from .db import Base, engine
from .routers import (
    auth,
    chats,
    events,
    folders,
    invites,
    keys,
    notes,
    polls,
    posts,
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
    ("messages", "edited_at", "INTEGER"),
    ("messages", "deleted_at", "INTEGER"),
    ("messages", "reply_to_id", "VARCHAR"),
    ("messages", "sealed", "INTEGER NOT NULL DEFAULT 0"),
    ("users", "avatar_url", "VARCHAR(500) NOT NULL DEFAULT ''"),
    ("users", "links", "TEXT NOT NULL DEFAULT ''"),
    ("users", "bot_owner_id", "VARCHAR NOT NULL DEFAULT ''"),
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


def create_app() -> FastAPI:
    settings = get_settings()
    _migrate_signal_to_multi_device()
    Base.metadata.create_all(bind=engine)
    _apply_migrations()

    app = FastAPI(title="docot", version="1.0.0")
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
    app.include_router(folders.router)
    app.include_router(invites.router)
    app.include_router(keys.router)
    app.include_router(polls.router)
    app.include_router(uploads.router)
    return app


app = create_app()
