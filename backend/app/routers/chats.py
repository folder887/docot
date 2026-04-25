from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy import and_
from sqlalchemy.orm import Session

from ..auth import current_user, user_from_token
from ..db import SessionLocal, get_db
from ..models import Chat, ChatMember, Message, User, now_ms
from ..schemas import (
    ChatCreateIn,
    ChatMemberOut,
    ChatMemberPatch,
    ChatOut,
    ChatPatch,
    MessageIn,
    MessageOut,
    MessagePatch,
)
from ..ws import hub

router = APIRouter(prefix="/chats", tags=["chats"])


def _msg_out(m: Message) -> MessageOut:
    text_value = "" if m.deleted_at else m.text
    sealed = bool(getattr(m, "sealed", False))
    # Sealed messages: the server still records the real author privately for
    # permission checks (edit/delete), but every public surface — REST and
    # WebSocket — sees an empty authorId. Clients re-derive the sender from
    # the chat membership and verify identity via the inner Signal envelope.
    public_author = "" if sealed else m.author_id
    return MessageOut(
        id=m.id,
        authorId=public_author,
        text=text_value,
        at=m.created_at,
        editedAt=m.edited_at,
        deletedAt=m.deleted_at,
        replyToId=m.reply_to_id,
        sealed=sealed,
    )


def _chat_out(db: Session, chat: Chat, me_id: str, with_history: bool = False) -> ChatOut:
    members = [m.user_id for m in chat.members]
    membership = next((m for m in chat.members if m.user_id == me_id), None)
    last = (
        db.query(Message)
        .filter(Message.chat_id == chat.id)
        .order_by(Message.created_at.desc())
        .first()
    )
    msgs: list[MessageOut] = []
    if with_history:
        rows = (
            db.query(Message)
            .filter(Message.chat_id == chat.id)
            .order_by(Message.created_at.asc())
            .limit(500)
            .all()
        )
        msgs = [_msg_out(m) for m in rows]

    title = chat.title
    if chat.kind == "dm" and not title:
        other = next((m for m in chat.members if m.user_id != me_id), None)
        if other and other.user:
            title = other.user.name

    return ChatOut(
        id=chat.id,
        kind=chat.kind,
        title=title or "Chat",
        description=getattr(chat, "description", "") or "",
        isPublic=bool(getattr(chat, "is_public", False)),
        createdBy=chat.created_by,
        participants=members,
        pinned=bool(membership and membership.pinned),
        muted=bool(membership and membership.muted),
        role=membership.role if membership else "member",
        updatedAt=chat.updated_at,
        lastMessage=_msg_out(last) if last else None,
        messages=msgs,
    )


@router.get("", response_model=list[ChatOut])
def list_chats(me: User = Depends(current_user), db: Session = Depends(get_db)) -> list[ChatOut]:
    chats = (
        db.query(Chat)
        .join(ChatMember, ChatMember.chat_id == Chat.id)
        .filter(ChatMember.user_id == me.id)
        .order_by(Chat.updated_at.desc())
        .all()
    )
    return [_chat_out(db, c, me.id) for c in chats]


@router.post("", response_model=ChatOut)
def create_chat(
    body: ChatCreateIn,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> ChatOut:
    participant_ids = list(dict.fromkeys([me.id, *body.participantIds]))
    for pid in participant_ids:
        if not db.get(User, pid):
            raise HTTPException(status_code=400, detail=f"Unknown user: {pid}")

    if body.kind == "dm":
        if len(participant_ids) != 2:
            raise HTTPException(status_code=400, detail="DM requires exactly 1 other participant")
        existing = (
            db.query(Chat)
            .join(ChatMember, ChatMember.chat_id == Chat.id)
            .filter(Chat.kind == "dm", ChatMember.user_id == me.id)
            .all()
        )
        for c in existing:
            member_ids = {m.user_id for m in c.members}
            if member_ids == set(participant_ids):
                return _chat_out(db, c, me.id, with_history=True)

    chat = Chat(
        kind=body.kind,
        title=body.title or "",
        description=body.description or "",
        is_public=bool(body.isPublic) if body.isPublic is not None else False,
        created_by=me.id,
    )
    db.add(chat)
    db.flush()
    for pid in participant_ids:
        db.add(
            ChatMember(
                chat_id=chat.id,
                user_id=pid,
                role="owner" if pid == me.id else "member",
            )
        )
    db.commit()
    db.refresh(chat)
    return _chat_out(db, chat, me.id, with_history=True)


def _require_member(db: Session, chat_id: str, user_id: str) -> Chat:
    chat = db.get(Chat, chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    m = (
        db.query(ChatMember)
        .filter(and_(ChatMember.chat_id == chat_id, ChatMember.user_id == user_id))
        .first()
    )
    if not m:
        raise HTTPException(status_code=403, detail="Not a member")
    return chat


@router.get("/{chat_id}", response_model=ChatOut)
def get_chat(
    chat_id: str, me: User = Depends(current_user), db: Session = Depends(get_db)
) -> ChatOut:
    chat = _require_member(db, chat_id, me.id)
    return _chat_out(db, chat, me.id, with_history=True)


@router.get("/{chat_id}/messages", response_model=list[MessageOut])
def list_messages(
    chat_id: str,
    before: int | None = None,
    limit: int = 100,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[MessageOut]:
    _require_member(db, chat_id, me.id)
    q = db.query(Message).filter(Message.chat_id == chat_id)
    if before is not None:
        q = q.filter(Message.created_at < before)
    rows = q.order_by(Message.created_at.desc()).limit(max(1, min(limit, 500))).all()
    rows.reverse()
    return [_msg_out(m) for m in rows]


@router.post("/{chat_id}/messages", response_model=MessageOut)
async def post_message(
    chat_id: str,
    body: MessageIn,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> MessageOut:
    chat = _require_member(db, chat_id, me.id)
    if chat.kind == "channel":
        mem = (
            db.query(ChatMember)
            .filter(ChatMember.chat_id == chat.id, ChatMember.user_id == me.id)
            .first()
        )
        if not mem or mem.role not in ("owner", "admin"):
            raise HTTPException(status_code=403, detail="Only admins can post in channels")
    reply_to_id = None
    if body.replyToId:
        ref = db.get(Message, body.replyToId)
        if ref and ref.chat_id == chat.id:
            reply_to_id = ref.id
    # Sealed-sender is only meaningful in DM where the recipient can infer the
    # sender from chat membership. Reject it elsewhere so callers don't end up
    # with a permanently-anonymous group/channel post.
    sealed = bool(body.sealed) and chat.kind == "dm"
    msg = Message(
        chat_id=chat.id,
        author_id=me.id,
        text=body.text,
        reply_to_id=reply_to_id,
        sealed=sealed,
    )
    chat.updated_at = msg.created_at or now_ms()
    db.add(msg)
    db.add(chat)
    db.commit()
    db.refresh(msg)
    payload = {"type": "message", "chatId": chat.id, "message": _msg_out(msg).model_dump()}
    await hub.broadcast(chat.id, payload)
    return _msg_out(msg)


@router.patch("/{chat_id}/messages/{message_id}", response_model=MessageOut)
async def edit_message(
    chat_id: str,
    message_id: str,
    body: MessagePatch,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> MessageOut:
    _require_member(db, chat_id, me.id)
    msg = db.get(Message, message_id)
    if not msg or msg.chat_id != chat_id:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.deleted_at:
        raise HTTPException(status_code=410, detail="Message deleted")
    if msg.author_id != me.id:
        raise HTTPException(status_code=403, detail="Cannot edit others' messages")
    msg.text = body.text
    if body.sealed is not None:
        # Sealed flag may toggle if the new ciphertext is sealed but the old
        # one wasn't (or vice versa); only honour it for DM chats where the
        # convention applies.
        chat = db.get(Chat, chat_id)
        if chat and chat.kind == "dm":
            msg.sealed = bool(body.sealed)
    msg.edited_at = now_ms()
    db.commit()
    db.refresh(msg)
    payload = {"type": "message_edited", "chatId": chat_id, "message": _msg_out(msg).model_dump()}
    await hub.broadcast(chat_id, payload)
    return _msg_out(msg)


@router.delete("/{chat_id}/messages/{message_id}")
async def delete_message(
    chat_id: str,
    message_id: str,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    _require_member(db, chat_id, me.id)
    msg = db.get(Message, message_id)
    if not msg or msg.chat_id != chat_id:
        raise HTTPException(status_code=404, detail="Message not found")
    mem = (
        db.query(ChatMember)
        .filter(ChatMember.chat_id == chat_id, ChatMember.user_id == me.id)
        .first()
    )
    is_admin = bool(mem and mem.role in ("owner", "admin"))
    if msg.author_id != me.id and not is_admin:
        raise HTTPException(status_code=403, detail="Cannot delete others' messages")
    if msg.deleted_at:
        return {"ok": True, "id": message_id}
    msg.deleted_at = now_ms()
    msg.text = ""
    db.commit()
    payload = {
        "type": "message_deleted",
        "chatId": chat_id,
        "messageId": message_id,
        "deletedAt": msg.deleted_at,
    }
    await hub.broadcast(chat_id, payload)
    return {"ok": True, "id": message_id}


@router.patch("/{chat_id}", response_model=ChatOut)
def update_chat(
    chat_id: str,
    body: ChatPatch,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> ChatOut:
    chat = _require_member(db, chat_id, me.id)
    mem = (
        db.query(ChatMember)
        .filter(ChatMember.chat_id == chat.id, ChatMember.user_id == me.id)
        .first()
    )
    if not mem or mem.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin only")
    if chat.kind == "dm":
        raise HTTPException(status_code=400, detail="Cannot edit DM")
    if body.title is not None:
        chat.title = body.title.strip()[:120]
    if body.description is not None:
        chat.description = body.description[:1000]
    if body.isPublic is not None:
        chat.is_public = bool(body.isPublic)
    chat.updated_at = now_ms()
    db.commit()
    db.refresh(chat)
    return _chat_out(db, chat, me.id)


@router.get("/{chat_id}/members", response_model=list[ChatMemberOut])
def list_members(
    chat_id: str,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[ChatMemberOut]:
    _require_member(db, chat_id, me.id)
    rows = db.query(ChatMember).filter(ChatMember.chat_id == chat_id).all()
    return [
        ChatMemberOut(userId=r.user_id, role=r.role, joinedAt=r.joined_at) for r in rows
    ]


@router.patch("/{chat_id}/members/{user_id}", response_model=ChatMemberOut)
def patch_member(
    chat_id: str,
    user_id: str,
    body: ChatMemberPatch,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> ChatMemberOut:
    chat = _require_member(db, chat_id, me.id)
    my_mem = (
        db.query(ChatMember)
        .filter(ChatMember.chat_id == chat.id, ChatMember.user_id == me.id)
        .first()
    )
    if not my_mem or my_mem.role != "owner":
        raise HTTPException(status_code=403, detail="Owner only")
    target = (
        db.query(ChatMember)
        .filter(ChatMember.chat_id == chat.id, ChatMember.user_id == user_id)
        .first()
    )
    if not target:
        raise HTTPException(status_code=404, detail="Member not found")
    if body.role == "owner":
        my_mem.role = "admin"
    target.role = body.role
    db.commit()
    return ChatMemberOut(userId=target.user_id, role=target.role, joinedAt=target.joined_at)


@router.delete("/{chat_id}/members/{user_id}")
def remove_member(
    chat_id: str,
    user_id: str,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    chat = _require_member(db, chat_id, me.id)
    my_mem = (
        db.query(ChatMember)
        .filter(ChatMember.chat_id == chat.id, ChatMember.user_id == me.id)
        .first()
    )
    if user_id != me.id and (not my_mem or my_mem.role not in ("owner", "admin")):
        raise HTTPException(status_code=403, detail="Admin only")
    target = (
        db.query(ChatMember)
        .filter(ChatMember.chat_id == chat.id, ChatMember.user_id == user_id)
        .first()
    )
    if not target:
        raise HTTPException(status_code=404, detail="Member not found")
    if target.role == "owner" and target.user_id != me.id:
        raise HTTPException(status_code=403, detail="Cannot remove owner")
    db.delete(target)
    db.commit()
    return {"ok": True}


@router.post("/{chat_id}/pin")
def pin_chat(
    chat_id: str,
    pinned: bool = True,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    _require_member(db, chat_id, me.id)
    mem = (
        db.query(ChatMember)
        .filter(ChatMember.chat_id == chat_id, ChatMember.user_id == me.id)
        .first()
    )
    assert mem is not None
    mem.pinned = pinned
    db.commit()
    return {"ok": True, "pinned": pinned}


@router.post("/{chat_id}/mute")
def mute_chat(
    chat_id: str,
    muted: bool = True,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    _require_member(db, chat_id, me.id)
    mem = (
        db.query(ChatMember)
        .filter(ChatMember.chat_id == chat_id, ChatMember.user_id == me.id)
        .first()
    )
    assert mem is not None
    mem.muted = muted
    db.commit()
    return {"ok": True, "muted": muted}


@router.delete("/{chat_id}")
def delete_chat(
    chat_id: str, me: User = Depends(current_user), db: Session = Depends(get_db)
) -> dict:
    chat = _require_member(db, chat_id, me.id)
    if chat.created_by != me.id:
        # non-creator just leaves
        db.query(ChatMember).filter(
            ChatMember.chat_id == chat_id, ChatMember.user_id == me.id
        ).delete()
    else:
        db.delete(chat)
    db.commit()
    return {"ok": True}


@router.websocket("/ws")
async def chat_ws(websocket: WebSocket, token: str, chatId: str) -> None:
    await websocket.accept()
    db = SessionLocal()
    try:
        user = user_from_token(token, db)
        if not user:
            await websocket.close(code=4401)
            return
        chat = db.get(Chat, chatId)
        if not chat:
            await websocket.close(code=4404)
            return
        member = (
            db.query(ChatMember)
            .filter(ChatMember.chat_id == chatId, ChatMember.user_id == user.id)
            .first()
        )
        if not member:
            await websocket.close(code=4403)
            return
    finally:
        db.close()

    await hub.join(chatId, websocket)
    try:
        while True:
            # we don't process inbound messages (POST /messages is the sole write path),
            # but we keep the connection alive.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await hub.leave(chatId, websocket)
