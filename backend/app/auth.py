from __future__ import annotations

import time

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .models import User

bearer = HTTPBearer(auto_error=False)


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(user_id: str) -> str:
    s = get_settings()
    now = int(time.time())
    payload = {"sub": user_id, "iat": now, "exp": now + s.jwt_ttl_seconds}
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm)


def decode_token(token: str) -> dict:
    s = get_settings()
    return jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm])


def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if not creds:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing auth")
    try:
        payload = decode_token(creds.credentials)
        uid = payload.get("sub")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from e
    user = db.get(User, uid)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    # Soft-deleted accounts (delete_account clears password_hash) must be
    # rejected immediately so existing JWTs cannot resurrect the user.
    if not user.password_hash:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account deleted")
    # best-effort last-seen tick; don't block request on commit failure
    try:
        user.last_seen_at = int(time.time() * 1000)
        db.add(user)
        db.commit()
    except Exception:
        db.rollback()
    return user


def user_from_token(token: str, db: Session) -> User | None:
    try:
        payload = decode_token(token)
    except Exception:
        return None
    uid = payload.get("sub")
    if not uid:
        return None
    user = db.get(User, uid)
    if not user:
        return None
    # Soft-deleted accounts (password_hash cleared by delete_account) must be
    # rejected here too — the WebSocket handler authenticates via this
    # function and would otherwise let a deleted user keep receiving
    # broadcasts on stale JWTs.
    if not user.password_hash:
        return None
    return user


def get_bearer_from_request(request: Request) -> str | None:
    auth = request.headers.get("authorization") or ""
    if auth.lower().startswith("bearer "):
        return auth.split(" ", 1)[1].strip()
    # fallback to ?token= for WebSocket
    return request.query_params.get("token")
