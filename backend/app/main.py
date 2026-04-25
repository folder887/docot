from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from .config import get_settings
from .db import Base, engine
from .routers import auth, chats, events, folders, invites, notes, posts, uploads, users

logger = logging.getLogger(__name__)


# Lightweight in-place migrations for SQLite (we don't use Alembic).
# Each entry: (table_name, column_name, "<column DDL fragment>")
_MIGRATIONS: list[tuple[str, str, str]] = [
    ("chats", "description", "TEXT NOT NULL DEFAULT ''"),
    ("chats", "is_public", "INTEGER NOT NULL DEFAULT 0"),
    ("messages", "edited_at", "INTEGER"),
    ("messages", "deleted_at", "INTEGER"),
    ("messages", "reply_to_id", "VARCHAR"),
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


def create_app() -> FastAPI:
    settings = get_settings()
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
    app.include_router(uploads.router)
    return app


app = create_app()
