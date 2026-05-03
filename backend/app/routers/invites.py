from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import update
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..models import Chat, ChatInvite, ChatMember, InviteRequest, User, now_ms
from ..schemas import (
    ChatOut,
    InviteCreateIn,
    InviteInfoOut,
    InviteOut,
    InviteRequestDecideIn,
    InviteRequestOut,
)

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
        requireApproval=bool(getattr(inv, "require_approval", False)),
        name=getattr(inv, "name", "") or "",
        url=_invite_url(inv.token),
    )


def _to_request_out(req: InviteRequest) -> InviteRequestOut:
    return InviteRequestOut(
        id=req.id,
        chatId=req.chat_id,
        userId=req.user_id,
        inviteToken=req.invite_token or "",
        note=req.note or "",
        status=req.status,
        createdAt=req.created_at,
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
        require_approval=bool(body.requireApproval) if body.requireApproval is not None else False,
        name=(body.name or "")[:80],
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
        requireApproval=bool(getattr(inv, "require_approval", False)),
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
        # Approval mode: don't add the user; create / refresh a pending
        # request and return the chat in a stub form so the client can
        # show "awaiting approval".
        if bool(getattr(inv, "require_approval", False)):
            req = (
                db.query(InviteRequest)
                .filter(
                    InviteRequest.chat_id == chat.id,
                    InviteRequest.user_id == me.id,
                )
                .first()
            )
            if req is None:
                db.add(
                    InviteRequest(
                        chat_id=chat.id,
                        user_id=me.id,
                        invite_token=token,
                        status="pending",
                    )
                )
                db.commit()
            elif req.status in ("denied", "approved"):
                # Allow re-requesting after a denial, or after a user who
                # was previously approved left the chat and now wants to
                # rejoin via the same invite.
                req.status = "pending"
                req.decided_by = ""
                req.decided_at = None
                req.created_at = now_ms()
                req.invite_token = token
                db.commit()
            # 4xx so the client treats this as an error path; the marker
            # detail lets the join screen surface a "pending approval" UX.
            raise HTTPException(status_code=403, detail="approval-required")
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


# ---------------------------------------------------------------------------
# Approval queue: admins approve/deny pending join requests.
# ---------------------------------------------------------------------------


@router.get("/chats/{chat_id}/invite-requests", response_model=list[InviteRequestOut])
def list_invite_requests(
    chat_id: str,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[InviteRequestOut]:
    _require_admin(db, chat_id, me.id)
    rows = (
        db.query(InviteRequest)
        .filter(InviteRequest.chat_id == chat_id, InviteRequest.status == "pending")
        .order_by(InviteRequest.created_at.asc())
        .all()
    )
    return [_to_request_out(r) for r in rows]


@router.post(
    "/chats/{chat_id}/invite-requests/{request_id}",
    response_model=InviteRequestOut,
)
def decide_invite_request(
    chat_id: str,
    request_id: int,
    body: InviteRequestDecideIn,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> InviteRequestOut:
    _require_admin(db, chat_id, me.id)
    req = db.get(InviteRequest, request_id)
    if not req or req.chat_id != chat_id:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != "pending":
        raise HTTPException(status_code=409, detail="Already decided")
    req.status = "approved" if body.approve else "denied"
    req.decided_by = me.id
    req.decided_at = now_ms()
    if body.approve:
        existing = (
            db.query(ChatMember)
            .filter(
                ChatMember.chat_id == chat_id,
                ChatMember.user_id == req.user_id,
            )
            .first()
        )
        if not existing:
            # Atomically claim a slot on the originating invite so
            # `max_uses` remains a hard cap even when admins approve a
            # backlog of pending requests one by one. Mirrors the
            # join_via_invite fast path.
            inv = (
                db.query(ChatInvite)
                .filter(ChatInvite.token == req.invite_token)
                .first()
            )
            if inv is not None:
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
                    raise HTTPException(
                        status_code=410,
                        detail="Invite invalid or expired",
                    )
            db.add(
                ChatMember(
                    chat_id=chat_id,
                    user_id=req.user_id,
                    role="member",
                )
            )
    db.commit()
    db.refresh(req)
    return _to_request_out(req)
