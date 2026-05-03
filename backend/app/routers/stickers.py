"""Sticker packs.

Anyone can create a public pack and add stickers to it. Stickers are
inserted into a chat as ordinary messages whose body is the same media
descriptor JSON used elsewhere — `{"kind":"sticker","u":"…","pk":"…"}`.
That keeps the existing `ban_stickers` content gate, history export, and
WS broadcast logic working without special-casing stickers.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..models import Sticker, StickerPack, User
from ..schemas import (
    StickerCreateIn,
    StickerOut,
    StickerPackCreateIn,
    StickerPackOut,
)


router = APIRouter(prefix="/stickers", tags=["stickers"])


def _sticker_out(s: Sticker) -> StickerOut:
    return StickerOut(
        id=s.id,
        packId=s.pack_id,
        url=s.url,
        emoji=s.emoji,
        createdAt=s.created_at,
    )


def _pack_out(p: StickerPack, stickers: list[Sticker]) -> StickerPackOut:
    return StickerPackOut(
        id=p.id,
        creatorId=p.creator_id,
        title=p.title,
        coverEmoji=p.cover_emoji or "🟩",
        public=bool(p.public),
        createdAt=p.created_at,
        stickers=[_sticker_out(s) for s in stickers],
    )


@router.get("/packs", response_model=list[StickerPackOut])
def list_packs(
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[StickerPackOut]:
    """Return all public packs and packs the caller created."""
    rows = (
        db.query(StickerPack)
        .filter((StickerPack.public.is_(True)) | (StickerPack.creator_id == me.id))
        .order_by(StickerPack.created_at.asc())
        .all()
    )
    out: list[StickerPackOut] = []
    for p in rows:
        stickers = (
            db.query(Sticker)
            .filter(Sticker.pack_id == p.id)
            .order_by(Sticker.created_at.asc())
            .all()
        )
        out.append(_pack_out(p, stickers))
    return out


@router.post("/packs", response_model=StickerPackOut)
def create_pack(
    body: StickerPackCreateIn,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> StickerPackOut:
    pack = StickerPack(
        creator_id=me.id,
        title=body.title.strip(),
        cover_emoji=(body.coverEmoji or "🟩")[:8],
        public=True,
    )
    db.add(pack)
    db.commit()
    db.refresh(pack)
    return _pack_out(pack, [])


@router.post("/packs/{pack_id}/stickers", response_model=StickerOut)
def add_sticker(
    pack_id: str,
    body: StickerCreateIn,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> StickerOut:
    pack = db.get(StickerPack, pack_id)
    if not pack:
        raise HTTPException(status_code=404, detail="Pack not found")
    if pack.creator_id and pack.creator_id != me.id:
        raise HTTPException(status_code=403, detail="Only the pack creator can add stickers")
    s = Sticker(pack_id=pack.id, url=body.url, emoji=(body.emoji or "")[:8])
    db.add(s)
    db.commit()
    db.refresh(s)
    return _sticker_out(s)


@router.delete("/packs/{pack_id}/stickers/{sticker_id}")
def remove_sticker(
    pack_id: str,
    sticker_id: str,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    pack = db.get(StickerPack, pack_id)
    if not pack:
        raise HTTPException(status_code=404, detail="Pack not found")
    if pack.creator_id and pack.creator_id != me.id:
        raise HTTPException(status_code=403, detail="Only the pack creator can remove stickers")
    s = db.get(Sticker, sticker_id)
    if not s or s.pack_id != pack.id:
        raise HTTPException(status_code=404, detail="Sticker not found")
    db.delete(s)
    db.commit()
    return {"ok": True}


@router.delete("/packs/{pack_id}")
def remove_pack(
    pack_id: str,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    pack = db.get(StickerPack, pack_id)
    if not pack:
        raise HTTPException(status_code=404, detail="Pack not found")
    if pack.creator_id != me.id:
        raise HTTPException(status_code=403, detail="Only the pack creator can delete the pack")
    db.delete(pack)
    db.commit()
    return {"ok": True}
