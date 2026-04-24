from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import create_token, current_user, hash_password, verify_password
from ..db import get_db
from ..models import User
from ..schemas import AuthOut, LoginIn, SignupIn, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_to_out(u: User) -> UserOut:
    return UserOut(
        id=u.id,
        handle=f"@{u.handle}",
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
