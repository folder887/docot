from __future__ import annotations

import secrets
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:////data/docot.db"
    jwt_secret: str = secrets.token_urlsafe(32)
    jwt_algorithm: str = "HS256"
    jwt_ttl_seconds: int = 60 * 60 * 24 * 30  # 30 days
    cors_origins: str = "*"


@lru_cache
def get_settings() -> Settings:
    return Settings()
