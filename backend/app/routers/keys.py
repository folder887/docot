from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..models import OneTimePreKey, User, UserKeys, now_ms
from ..schemas import (
    DeviceListOut,
    DeviceOut,
    KeyBundleIn,
    KeyBundleOut,
    KeyStatusOut,
    OneTimePreKeysIn,
    PreKeyOut,
)

router = APIRouter(prefix="/keys", tags=["keys"])


def _bundle_row_for(user_id: str, device_id: int, db: Session) -> UserKeys | None:
    return db.execute(
        select(UserKeys).where(
            UserKeys.user_id == user_id, UserKeys.device_id == device_id
        )
    ).scalar_one_or_none()


def _all_bundles_for(user_id: str, db: Session) -> list[UserKeys]:
    return list(
        db.execute(
            select(UserKeys)
            .where(UserKeys.user_id == user_id)
            .order_by(UserKeys.device_id.asc())
        ).scalars()
    )


@router.post("/bundle", response_model=KeyStatusOut)
def upload_bundle(
    payload: KeyBundleIn,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> KeyStatusOut:
    """Upload (or replace) the bundle for one of the user's devices.

    A user may register many devices, each with its own identity. Identity keys
    are immutable per (user, device) once uploaded.
    """
    row = _bundle_row_for(me.id, payload.deviceId, db)
    if row is None:
        row = UserKeys(
            user_id=me.id,
            device_id=payload.deviceId,
            registration_id=payload.registrationId,
            identity_key=payload.identityKey,
            signed_pre_key_id=payload.signedPreKeyId,
            signed_pre_key=payload.signedPreKey,
            signed_pre_key_signature=payload.signedPreKeySignature,
            updated_at=now_ms(),
        )
        db.add(row)
    else:
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

    _add_one_time_keys(me.id, payload.deviceId, payload.oneTimePreKeys, db)

    db.commit()
    return _status(me.id, payload.deviceId, db)


@router.post("/onetime", response_model=KeyStatusOut)
def replenish_one_time(
    payload: OneTimePreKeysIn,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> KeyStatusOut:
    if _bundle_row_for(me.id, payload.deviceId, db) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="bundle_missing")
    _add_one_time_keys(me.id, payload.deviceId, payload.keys, db)
    db.commit()
    return _status(me.id, payload.deviceId, db)


@router.get("/status", response_model=KeyStatusOut)
def my_status(
    deviceId: int,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> KeyStatusOut:
    return _status(me.id, deviceId, db)


@router.get("/devices/{user_id}", response_model=DeviceListOut)
def list_devices(
    user_id: str,
    me: User = Depends(current_user),  # noqa: ARG001
    db: Session = Depends(get_db),
) -> DeviceListOut:
    """List all device bundles registered for `user_id`.

    Senders use this to know how many envelopes to fan out per message.
    """
    if db.get(User, user_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="user_not_found")
    rows = _all_bundles_for(user_id, db)
    return DeviceListOut(
        userId=user_id,
        devices=[
            DeviceOut(
                deviceId=r.device_id,
                registrationId=r.registration_id,
                updatedAt=r.updated_at,
            )
            for r in rows
        ],
    )


@router.get("/bundle/{user_id}/{device_id}", response_model=KeyBundleOut)
def fetch_bundle_for_device(
    user_id: str,
    device_id: int,
    me: User = Depends(current_user),  # noqa: ARG001
    db: Session = Depends(get_db),
) -> KeyBundleOut:
    """Return a consumable bundle for a specific (user, device) and atomically
    consume one OTP if any are available."""
    if db.get(User, user_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="user_not_found")
    row = _bundle_row_for(user_id, device_id, db)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="bundle_not_found")

    inner = (
        select(OneTimePreKey.id)
        .where(
            OneTimePreKey.user_id == user_id,
            OneTimePreKey.device_id == device_id,
            OneTimePreKey.consumed.is_(False),
        )
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
        deviceId=device_id,
        registrationId=row.registration_id,
        identityKey=row.identity_key,
        signedPreKeyId=row.signed_pre_key_id,
        signedPreKey=row.signed_pre_key,
        signedPreKeySignature=row.signed_pre_key_signature,
        preKey=pre_key,
    )


@router.get("/bundle/{user_id}", response_model=KeyBundleOut)
def fetch_bundle_legacy(
    user_id: str,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> KeyBundleOut:
    """Backwards-compatible single-device fetch.

    Picks the lowest-numbered registered device. New clients should call
    `/keys/devices/{user_id}` then `/keys/bundle/{user_id}/{device_id}` for
    every device they want to encrypt to.
    """
    rows = _all_bundles_for(user_id, db)
    if not rows:
        if db.get(User, user_id) is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="user_not_found")
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="bundle_not_found")
    return fetch_bundle_for_device(user_id, rows[0].device_id, me, db)


def _add_one_time_keys(
    user_id: str, device_id: int, keys: list[PreKeyOut], db: Session
) -> None:
    for k in keys:
        sp = db.begin_nested()
        try:
            db.add(
                OneTimePreKey(
                    user_id=user_id,
                    device_id=device_id,
                    key_id=k.keyId,
                    public_key=k.publicKey,
                    consumed=False,
                )
            )
            db.flush()
            sp.commit()
        except IntegrityError:
            sp.rollback()
            # Duplicate (user_id, device_id, key_id) — skip and keep going.


def _status(user_id: str, device_id: int, db: Session) -> KeyStatusOut:
    has = _bundle_row_for(user_id, device_id, db) is not None
    remaining = db.execute(
        select(func.count(OneTimePreKey.id)).where(
            OneTimePreKey.user_id == user_id,
            OneTimePreKey.device_id == device_id,
            OneTimePreKey.consumed.is_(False),
        )
    ).scalar_one()
    return KeyStatusOut(
        hasBundle=has,
        deviceId=device_id if has else None,
        oneTimeRemaining=remaining,
    )
