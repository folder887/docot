from __future__ import annotations

import os
import secrets
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


def _persistent_jwt_secret() -> str:
    """Return a JWT secret that survives process restarts.

    Priority: explicit env var > on-disk secret file (auto-created on first
    boot, alongside the SQLite db) > ephemeral fallback (only used in tests
    when /data is not writable).
    """
    env = os.environ.get("JWT_SECRET", "").strip()
    if env:
        return env
    base = Path(os.environ.get("DOCOT_SECRETS_DIR", "/data"))
    try:
        base.mkdir(parents=True, exist_ok=True)
        path = base / "jwt_secret"
        if path.exists():
            data = path.read_text(encoding="utf-8").strip()
            if data:
                return data
        new = secrets.token_urlsafe(48)
        path.write_text(new, encoding="utf-8")
        try:
            path.chmod(0o600)
        except OSError:
            pass
        return new
    except OSError:
        # /data not writable (tests / CI). Process-local secret is fine here
        # because tokens are not expected to outlive the process.
        return secrets.token_urlsafe(32)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:////data/docot.db"
    jwt_secret: str = _persistent_jwt_secret()
    jwt_algorithm: str = "HS256"
    jwt_ttl_seconds: int = 60 * 60 * 24 * 30  # 30 days
    cors_origins: str = "*"


@lru_cache
def get_settings() -> Settings:
    return Settings()
