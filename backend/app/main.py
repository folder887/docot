from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .db import Base, engine
from .routers import auth, chats, events, folders, notes, posts, uploads, users


def create_app() -> FastAPI:
    settings = get_settings()
    Base.metadata.create_all(bind=engine)

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
    app.include_router(uploads.router)
    return app


app = create_app()
