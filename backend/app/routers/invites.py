from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import update
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..models import Chat, ChatInvite, ChatMember, User, now_ms
from ..schemas import ChatOut, InviteCreateIn, InviteInfoOut, InviteOut

router = APIRouter(tags=["invites"])


def _new_token() -> str:
    # 16 hex chars = 64 bits of entropy, fixed length, alphanumeric only.
    return secrets.token_hex(8)


def _invite_url(token: str) -> str:
    return f"docot://invite/{token}"


def _to_out(inv: ChatInvite) -> InviteOut:
    return InviteOut(
        token=inv.token,
        chatId=inv.chat_id,
        createdBy=inv.created_by,
        createdAt=inv.created_at,
        expiresAt=inv.expires_at,
        maxUses=inv.max_uses,
        uses=inv.uses,
        revoked=inv.revoked,
        url=_invite_url(inv.token),
    )


def _is_active(inv: ChatInvite) -> bool:
    if inv.revoked:
        return False
    if inv.expires_at is not None and inv.expires_at < now_ms():
        return False
    if inv.max_uses is not None and inv.uses >= inv.max_uses:
        return False
    return True


def _require_admin(db: Session, chat_id: str, user_id: str) -> Chat:
    chat = db.get(Chat, chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    if chat.kind == "dm":
        raise HTTPException(status_code=400, detail="DMs cannot have invites")
    mem = (
        db.query(ChatMember)
        .filter(ChatMember.chat_id == chat_id, ChatMember.user_id == user_id)
        .first()
    )
    if not mem or mem.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin only")
    return chat


@router.post("/chats/{chat_id}/invites", response_model=InviteOut)
def create_invite(
    chat_id: str,
    body: InviteCreateIn,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> InviteOut:
    _require_admin(db, chat_id, me.id)
    for _ in range(5):
        token = _new_token()
        if not db.query(ChatInvite).filter(ChatInvite.token == token).first():
            break
    else:
        raise HTTPException(status_code=500, detail="Could not allocate token")
    inv = ChatInvite(
        token=token,
        chat_id=chat_id,
        created_by=me.id,
        expires_at=body.expiresAt,
        max_uses=body.maxUses,
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return _to_out(inv)


@router.get("/chats/{chat_id}/invites", response_model=list[InviteOut])
def list_invites(
    chat_id: str,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[InviteOut]:
    _require_admin(db, chat_id, me.id)
    rows = (
        db.query(ChatInvite)
        .filter(ChatInvite.chat_id == chat_id)
        .order_by(ChatInvite.created_at.desc())
        .all()
    )
    return [_to_out(r) for r in rows]


@router.delete("/invites/{token}")
def revoke_invite(
    token: str,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    inv = db.query(ChatInvite).filter(ChatInvite.token == token).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invite not found")
    _require_admin(db, inv.chat_id, me.id)
    inv.revoked = True
    db.commit()
    return {"ok": True}


@router.get("/invites/{token}", response_model=InviteInfoOut)
def get_invite_info(
    token: str,
    db: Session = Depends(get_db),
) -> InviteInfoOut:
    inv = db.query(ChatInvite).filter(ChatInvite.token == token).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invite not found")
    chat = db.get(Chat, inv.chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    member_count = db.query(ChatMember).filter(ChatMember.chat_id == chat.id).count()
    return InviteInfoOut(
        token=inv.token,
        chatId=chat.id,
        title=chat.title or "Chat",
        kind=chat.kind,
        description=getattr(chat, "description", "") or "",
        memberCount=member_count,
        valid=_is_active(inv),
    )


@router.post("/invites/{token}/join", response_model=ChatOut)
def join_via_invite(
    token: str,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> ChatOut:
    from .chats import _chat_out  # local import to avoid cycle

    inv = db.query(ChatInvite).filter(ChatInvite.token == token).first()
    if not inv or not _is_active(inv):
        raise HTTPException(status_code=410, detail="Invite invalid or expired")
    chat = db.get(Chat, inv.chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    existing = (
        db.query(ChatMember)
        .filter(ChatMember.chat_id == chat.id, ChatMember.user_id == me.id)
        .first()
    )
    if not existing:
        # Atomically claim a slot. If max_uses is set, only succeed when
        # there's still room; the WHERE clause makes check-and-increment a
        # single SQL operation, preventing the TOCTOU race where two
        # concurrent joins would both pass the _is_active check above.
        stmt = (
            update(ChatInvite)
            .where(ChatInvite.id == inv.id, ChatInvite.revoked.is_(False))
            .values(uses=ChatInvite.uses + 1)
        )
        if inv.max_uses is not None:
            stmt = stmt.where(ChatInvite.uses < inv.max_uses)
        if inv.expires_at is not None:
            stmt = stmt.where(ChatInvite.expires_at >= now_ms())
        result = db.execute(stmt)
        if result.rowcount == 0:
            db.rollback()
            raise HTTPException(status_code=410, detail="Invite invalid or expired")
        db.add(
            ChatMember(
                chat_id=chat.id,
                user_id=me.id,
                role="member",
            )
        )
        chat.updated_at = now_ms()
        db.commit()
        db.refresh(chat)
    return _chat_out(db, chat, me.id, with_history=True)
