from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import update
from sqlalchemy.orm import Session

from ..auth import create_token, current_user, hash_password, verify_password
from ..db import get_db
from ..models import PairToken, User, now_ms
from ..schemas import AuthOut, LoginIn, PairClaimIn, PairStartOut, SignupIn, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_to_out(u: User) -> UserOut:
    return UserOut(
        id=u.id,
        handle=u.handle,
        name=u.name,
        bio=u.bio,
        kind=u.kind,
        phone=u.phone,
        lastSeen=u.last_seen_at,
    )


@router.post("/signup", response_model=AuthOut)
def signup(body: SignupIn, db: Session = Depends(get_db)) -> AuthOut:
    existing = db.query(User).filter(User.handle == body.handle).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Handle already taken")
    user = User(
        handle=body.handle,
        name=body.name.strip(),
        password_hash=hash_password(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_token(user.id)
    return AuthOut(token=token, user=_user_to_out(user))


@router.post("/login", response_model=AuthOut)
def login(body: LoginIn, db: Session = Depends(get_db)) -> AuthOut:
    user = db.query(User).filter(User.handle == body.handle).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_token(user.id)
    return AuthOut(token=token, user=_user_to_out(user))


@router.get("/me", response_model=UserOut)
def me(u: User = Depends(current_user)) -> UserOut:
    return _user_to_out(u)


PAIR_TTL_MS = 90_000  # 90 seconds


@router.post("/pair/start", response_model=PairStartOut)
def pair_start(
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> PairStartOut:
    """Authenticated device generates a one-shot QR token. Anyone holding it
    within 90 s can mint a fresh session token for the same account."""
    token = secrets.token_urlsafe(24)
    expires = now_ms() + PAIR_TTL_MS
    db.add(PairToken(token=token, user_id=me.id, expires_at=expires))
    db.commit()
    return PairStartOut(token=token, expires=expires)


@router.post("/pair/claim", response_model=AuthOut)
def pair_claim(
    body: PairClaimIn,
    db: Session = Depends(get_db),
) -> AuthOut:
    """New device redeems the QR token for a session. Single-use, time-bounded."""
    row = db.get(PairToken, body.token)
    if row is None:
        raise HTTPException(status_code=404, detail="Invalid token")
    if row.consumed_at:
        raise HTTPException(status_code=410, detail="Token already used")
    if row.expires_at < now_ms():
        raise HTTPException(status_code=410, detail="Token expired")
    # Atomic mark-as-consumed; reject second claim races.
    res = db.execute(
        update(PairToken)
        .where(PairToken.token == body.token, PairToken.consumed_at == 0)
        .values(consumed_at=now_ms())
    )
    if res.rowcount != 1:
        db.rollback()
        raise HTTPException(status_code=410, detail="Token already used")
    user = db.get(User, row.user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    db.commit()
    token = create_token(user.id)
    return AuthOut(token=token, user=_user_to_out(user))
