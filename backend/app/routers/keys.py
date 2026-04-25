from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..models import OneTimePreKey, User, UserKeys, now_ms
from ..schemas import (
    KeyBundleIn,
    KeyBundleOut,
    KeyStatusOut,
    OneTimePreKeysIn,
    PreKeyOut,
)

router = APIRouter(prefix="/keys", tags=["keys"])


def _bundle_row_for(user_id: str, db: Session) -> UserKeys | None:
    return db.execute(select(UserKeys).where(UserKeys.user_id == user_id)).scalar_one_or_none()


@router.post("/bundle", response_model=KeyStatusOut)
def upload_bundle(
    payload: KeyBundleIn,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> KeyStatusOut:
    """Upload (or replace) the user's identity + signed prekey + optional OTP pool."""
    row = _bundle_row_for(me.id, db)
    if row is None:
        row = UserKeys(
            user_id=me.id,
            registration_id=payload.registrationId,
            identity_key=payload.identityKey,
            signed_pre_key_id=payload.signedPreKeyId,
            signed_pre_key=payload.signedPreKey,
            signed_pre_key_signature=payload.signedPreKeySignature,
            updated_at=now_ms(),
        )
        db.add(row)
    else:
        # Identity key MUST NOT change once published; replacing it would orphan
        # existing sessions on peers. Updating signed prekey + OTPs is fine.
        if row.identity_key != payload.identityKey:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail="identity_key_changed",
            )
        row.registration_id = payload.registrationId
        row.signed_pre_key_id = payload.signedPreKeyId
        row.signed_pre_key = payload.signedPreKey
        row.signed_pre_key_signature = payload.signedPreKeySignature
        row.updated_at = now_ms()

    _add_one_time_keys(me.id, payload.oneTimePreKeys, db)

    db.commit()
    return _status(me.id, db)


@router.post("/onetime", response_model=KeyStatusOut)
def replenish_one_time(
    payload: OneTimePreKeysIn,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> KeyStatusOut:
    if _bundle_row_for(me.id, db) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="bundle_missing")
    _add_one_time_keys(me.id, payload.keys, db)
    db.commit()
    return _status(me.id, db)


@router.get("/status", response_model=KeyStatusOut)
def my_status(me: User = Depends(current_user), db: Session = Depends(get_db)) -> KeyStatusOut:
    return _status(me.id, db)


@router.get("/bundle/{user_id}", response_model=KeyBundleOut)
def fetch_bundle(
    user_id: str,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> KeyBundleOut:
    """Return a consumable bundle for `user_id` and atomically consume one OTP if any."""
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="user_not_found")
    row = _bundle_row_for(user_id, db)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="bundle_not_found")

    # Atomically claim one OTP: a single UPDATE...WHERE id=(SELECT...) RETURNING
    # ensures two concurrent fetchers cannot grab the same prekey. SQLite ≥3.35
    # and PostgreSQL both support RETURNING.
    inner = (
        select(OneTimePreKey.id)
        .where(OneTimePreKey.user_id == user_id, OneTimePreKey.consumed.is_(False))
        .order_by(OneTimePreKey.id.asc())
        .limit(1)
        .scalar_subquery()
    )
    claimed = db.execute(
        update(OneTimePreKey)
        .where(OneTimePreKey.id == inner)
        .values(consumed=True)
        .returning(OneTimePreKey.key_id, OneTimePreKey.public_key)
    ).first()
    db.commit()

    pre_key = (
        PreKeyOut(keyId=claimed.key_id, publicKey=claimed.public_key) if claimed else None
    )
    return KeyBundleOut(
        userId=user_id,
        registrationId=row.registration_id,
        identityKey=row.identity_key,
        signedPreKeyId=row.signed_pre_key_id,
        signedPreKey=row.signed_pre_key,
        signedPreKeySignature=row.signed_pre_key_signature,
        preKey=pre_key,
    )


def _add_one_time_keys(user_id: str, keys: list[PreKeyOut], db: Session) -> None:
    for k in keys:
        # Wrap each insert in a SAVEPOINT so a duplicate key only rolls back
        # this single row — without touching the surrounding transaction
        # (UserKeys row + previously-flushed OTPs).
        sp = db.begin_nested()
        try:
            db.add(
                OneTimePreKey(
                    user_id=user_id,
                    key_id=k.keyId,
                    public_key=k.publicKey,
                    consumed=False,
                )
            )
            db.flush()
            sp.commit()
        except IntegrityError:
            sp.rollback()
            # Duplicate (user_id, key_id) — skip and keep going.


def _status(user_id: str, db: Session) -> KeyStatusOut:
    has = _bundle_row_for(user_id, db) is not None
    remaining = db.execute(
        select(func.count(OneTimePreKey.id)).where(
            OneTimePreKey.user_id == user_id,
            OneTimePreKey.consumed.is_(False),
        )
    ).scalar_one()
    return KeyStatusOut(hasBundle=has, oneTimeRemaining=remaining)
