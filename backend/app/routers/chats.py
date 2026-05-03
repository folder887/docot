from __future__ import annotations

import json
import re
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy import and_
from sqlalchemy.orm import Session

from ..auth import current_user, user_from_token
from ..db import SessionLocal, get_db
from ..models import (
    AdminLog,
    Chat,
    ChatMember,
    Message,
    MessageReaction,
    Topic,
    User,
    now_ms,
)
from ..schemas import (
    AdminLogOut,
    ChatCreateIn,
    ChatMemberOut,
    ChatMemberPatch,
    ChatOut,
    ChatPatch,
    MessageIn,
    MessageOut,
    MessagePatch,
    ReactionAggOut,
    ReactionIn,
    TopicCreateIn,
    TopicOut,
    TopicPatchIn,
)
from ..ws import hub

router = APIRouter(prefix="/chats", tags=["chats"])

# Conservative URL detector — matches http(s)://… and bare host.tld
# patterns. Regular host words like "example" don't match; the dot is
# required, mirroring user expectations of "a link".
_LINK_RX = re.compile(
    r"https?://\S+|(?:^|\s)(?:[a-z0-9-]+\.)+[a-z]{2,}(?:/\S*)?",
    re.IGNORECASE,
)


def _looks_like_link(text: str) -> bool:
    return bool(_LINK_RX.search(text or ""))


def _audit(
    db: Session,
    chat_id: str,
    actor_id: str,
    action: str,
    target_kind: str = "",
    target_id: str = "",
    payload: dict[str, object] | None = None,
) -> None:
    """Append an admin-log entry. Caller is responsible for the surrounding commit."""
    db.add(
        AdminLog(
            chat_id=chat_id,
            actor_id=actor_id,
            action=action,
            target_kind=target_kind,
            target_id=target_id,
            payload=json.dumps(payload or {}),
        )
    )


def _msg_out(
    m: Message,
    viewer_id: str | None = None,
    reactions: list[ReactionAggOut] | None = None,
) -> MessageOut:
    text_value = "" if m.deleted_at else m.text
    sealed = bool(getattr(m, "sealed", False))
    # Sealed messages: the server still records the real author privately for
    # permission checks (edit/delete) and every other observer (anonymous
    # API access, WebSocket broadcast, server logs) sees an empty authorId.
    # The author themselves still sees their own id back so that client UIs
    # (history, last-message preview, reload) can attribute their own messages
    # without resorting to fragile heuristics.
    if sealed and viewer_id != m.author_id:
        public_author = ""
    else:
        public_author = m.author_id
    return MessageOut(
        id=m.id,
        authorId=public_author,
        text=text_value,
        at=m.created_at,
        editedAt=m.edited_at,
        deletedAt=m.deleted_at,
        replyToId=m.reply_to_id,
        sealed=sealed,
        pinned=bool(getattr(m, "pinned", False)),
        pinnedAt=getattr(m, "pinned_at", None),
        topicId=getattr(m, "topic_id", None),
        reactions=reactions or [],
    )


def _reactions_by_message(
    db: Session, message_ids: list[str], viewer_id: str
) -> dict[str, list[ReactionAggOut]]:
    """Aggregate reactions per (message_id, emoji) and tag the viewer's votes."""
    if not message_ids:
        return {}
    rows = (
        db.query(MessageReaction)
        .filter(MessageReaction.message_id.in_(message_ids))
        .all()
    )
    # message_id -> emoji -> {count, mine}
    by_msg: dict[str, dict[str, dict[str, object]]] = defaultdict(dict)
    for r in rows:
        bucket = by_msg[r.message_id].setdefault(r.emoji, {"count": 0, "mine": False})
        bucket["count"] = int(bucket["count"]) + 1  # type: ignore[arg-type]
        if r.user_id == viewer_id:
            bucket["mine"] = True
    out: dict[str, list[ReactionAggOut]] = {}
    for mid, emojis in by_msg.items():
        out[mid] = [
            ReactionAggOut(emoji=e, count=int(v["count"]), mine=bool(v["mine"]))
            for e, v in sorted(emojis.items(), key=lambda kv: -int(kv[1]["count"]))
        ]
    return out


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
        rmap = _reactions_by_message(db, [m.id for m in rows], me_id)
        msgs = [_msg_out(m, viewer_id=me_id, reactions=rmap.get(m.id)) for m in rows]

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
        slowModeSeconds=int(getattr(chat, "slow_mode_seconds", 0) or 0),
        subscribersOnly=bool(getattr(chat, "subscribers_only", False)),
        signedPosts=bool(getattr(chat, "signed_posts", False)),
        autoDeleteSeconds=int(getattr(chat, "auto_delete_seconds", 0) or 0),
        banMedia=bool(getattr(chat, "ban_media", False)),
        banVoice=bool(getattr(chat, "ban_voice", False)),
        banStickers=bool(getattr(chat, "ban_stickers", False)),
        banLinks=bool(getattr(chat, "ban_links", False)),
        topicsEnabled=bool(getattr(chat, "topics_enabled", False)),
        createdBy=chat.created_by,
        participants=members,
        pinned=bool(membership and membership.pinned),
        muted=bool(membership and membership.muted),
        role=membership.role if membership else "member",
        updatedAt=chat.updated_at,
        lastMessage=_msg_out(last, viewer_id=me_id) if last else None,
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


@router.get("/saved", response_model=ChatOut)
def saved_chat(
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> ChatOut:
    """Return (and lazily create) the user's personal Saved Messages chat.

    Saved Messages is a single-member chat (kind="saved") used as a personal
    notepad. Unlike DMs it has only the owner as a member, and pin/edit/delete
    are unrestricted within it.
    """
    chat = (
        db.query(Chat)
        .join(ChatMember, ChatMember.chat_id == Chat.id)
        .filter(Chat.kind == "saved", ChatMember.user_id == me.id)
        .first()
    )
    if not chat:
        chat = Chat(kind="saved", title="Saved Messages", created_by=me.id)
        db.add(chat)
        db.flush()
        db.add(ChatMember(chat_id=chat.id, user_id=me.id, role="owner"))
        db.commit()
        db.refresh(chat)
    return _chat_out(db, chat, me.id, with_history=True)


class _SearchHit(BaseModel):
    chatId: str
    chatTitle: str
    message: MessageOut


@router.get("/search", response_model=list[_SearchHit])
def search_messages(
    q: str = "",
    chat_id: str | None = None,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[_SearchHit]:
    """Global / per-chat plaintext search across the user's messages.

    Sealed (E2E-encrypted) DMs are excluded server-side: their `text` is the
    Signal envelope, never plaintext.
    """
    qn = q.strip()
    if len(qn) < 2:
        return []
    member_chat_ids = [
        cid for (cid,) in db.query(ChatMember.chat_id).filter(ChatMember.user_id == me.id).all()
    ]
    if not member_chat_ids:
        return []
    if chat_id:
        if chat_id not in member_chat_ids:
            raise HTTPException(status_code=403, detail="Not a member")
        member_chat_ids = [chat_id]
    pat = f"%{qn.replace(chr(92), chr(92) * 2).replace('%', chr(92) + '%').replace('_', chr(92) + '_')}%"
    rows = (
        db.query(Message)
        .filter(
            Message.chat_id.in_(member_chat_ids),
            Message.deleted_at.is_(None),
            Message.sealed.is_(False),
            Message.text.ilike(pat, escape="\\"),
        )
        .order_by(Message.created_at.desc())
        .limit(80)
        .all()
    )
    rmap = _reactions_by_message(db, [m.id for m in rows], me.id)
    chat_titles: dict[str, str] = {}
    for c in db.query(Chat).filter(Chat.id.in_({m.chat_id for m in rows})).all():
        chat_titles[c.id] = c.title or ("Saved Messages" if c.kind == "saved" else "Chat")
    out: list[_SearchHit] = []
    for m in rows:
        out.append(
            _SearchHit(
                chatId=m.chat_id,
                chatTitle=chat_titles.get(m.chat_id, "Chat"),
                message=_msg_out(m, viewer_id=me.id, reactions=rmap.get(m.id)),
            )
        )
    return out


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
    topicId: str | None = None,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[MessageOut]:
    _require_member(db, chat_id, me.id)
    q = db.query(Message).filter(Message.chat_id == chat_id)
    if topicId is not None:
        # Empty string explicitly means "main feed only" (no topic).
        if topicId == "":
            q = q.filter(Message.topic_id.is_(None))
        else:
            q = q.filter(Message.topic_id == topicId)
    if before is not None:
        q = q.filter(Message.created_at < before)
    rows = q.order_by(Message.created_at.desc()).limit(max(1, min(limit, 500))).all()
    rows.reverse()
    rmap = _reactions_by_message(db, [m.id for m in rows], me.id)
    return [_msg_out(m, viewer_id=me.id, reactions=rmap.get(m.id)) for m in rows]


@router.post("/{chat_id}/messages", response_model=MessageOut)
async def post_message(
    chat_id: str,
    body: MessageIn,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> MessageOut:
    chat = _require_member(db, chat_id, me.id)
    mem = (
        db.query(ChatMember)
        .filter(ChatMember.chat_id == chat.id, ChatMember.user_id == me.id)
        .first()
    )
    is_admin = bool(mem and mem.role in ("owner", "admin"))
    if chat.kind == "channel" and not is_admin:
        raise HTTPException(status_code=403, detail="Only admins can post in channels")
    if (
        chat.kind == "group"
        and bool(getattr(chat, "subscribers_only", False))
        and not is_admin
    ):
        raise HTTPException(status_code=403, detail="Only admins can post (subscribers-only)")
    slow = int(getattr(chat, "slow_mode_seconds", 0) or 0)
    if slow > 0 and not is_admin:
        # Cheapest enforcement: look at the user's most recent post and
        # reject if it's within the slow-mode window.
        last_msg = (
            db.query(Message)
            .filter(
                Message.chat_id == chat.id,
                Message.author_id == me.id,
                Message.deleted_at.is_(None),
            )
            .order_by(Message.created_at.desc())
            .first()
        )
        if last_msg is not None:
            elapsed_ms = now_ms() - int(last_msg.created_at or 0)
            if elapsed_ms < slow * 1000:
                wait_s = max(1, (slow * 1000 - elapsed_ms) // 1000)
                raise HTTPException(
                    status_code=429,
                    detail=f"Slow mode: wait {wait_s}s before posting again",
                )
    reply_to_id = None
    if body.replyToId:
        ref = db.get(Message, body.replyToId)
        if ref and ref.chat_id == chat.id:
            reply_to_id = ref.id
    # Sealed-sender is only meaningful in DM where the recipient can infer the
    # sender from chat membership. Reject it elsewhere so callers don't end up
    # with a permanently-anonymous group/channel post.
    sealed = bool(body.sealed) and chat.kind == "dm"
    # Enforce admin-set content gates. Admins/owners are exempt so they can
    # always moderate (e.g. paste a rules link in a no-links chat).
    if not is_admin and not sealed:
        text_for_check = body.text or ""
        if bool(getattr(chat, "ban_links", False)) and _looks_like_link(text_for_check):
            raise HTTPException(status_code=403, detail="Links are not allowed in this chat")
        if bool(getattr(chat, "ban_stickers", False)) and text_for_check.startswith("__sticker:"):
            raise HTTPException(status_code=403, detail="Stickers are not allowed in this chat")
        if bool(getattr(chat, "ban_voice", False)) and text_for_check.startswith("__voice:"):
            raise HTTPException(status_code=403, detail="Voice messages are not allowed in this chat")
        if bool(getattr(chat, "ban_media", False)) and text_for_check.startswith(
            ("__media:", "__file:", "__image:", "__video:")
        ):
            raise HTTPException(status_code=403, detail="Media is not allowed in this chat")
    # Resolve the optional thread (topic) — only when the chat enabled topics
    # and the topic exists, belongs to the same chat, and is not closed.
    topic_id: str | None = None
    if body.topicId:
        if not bool(getattr(chat, "topics_enabled", False)):
            raise HTTPException(status_code=400, detail="Topics are not enabled in this chat")
        topic = db.get(Topic, body.topicId)
        if not topic or topic.chat_id != chat.id:
            raise HTTPException(status_code=404, detail="Topic not found")
        if topic.closed and not is_admin:
            raise HTTPException(status_code=403, detail="Topic is closed")
        topic_id = topic.id
        topic.last_message_at = now_ms()
        db.add(topic)
    msg = Message(
        chat_id=chat.id,
        author_id=me.id,
        text=body.text,
        reply_to_id=reply_to_id,
        sealed=sealed,
        topic_id=topic_id,
    )
    chat.updated_at = msg.created_at or now_ms()
    db.add(msg)
    db.add(chat)
    db.commit()
    db.refresh(msg)
    # WebSocket broadcasts use the anonymous projection; the response goes
    # back to the author themselves and therefore exposes the real authorId.
    payload = {"type": "message", "chatId": chat.id, "message": _msg_out(msg).model_dump()}
    await hub.broadcast(chat.id, payload)
    return _msg_out(msg, viewer_id=me.id)


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
    return _msg_out(msg, viewer_id=me.id)


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


@router.post("/{chat_id}/messages/{message_id}/pin", response_model=MessageOut)
async def pin_message(
    chat_id: str,
    message_id: str,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> MessageOut:
    _require_member(db, chat_id, me.id)
    msg = db.get(Message, message_id)
    if not msg or msg.chat_id != chat_id:
        raise HTTPException(status_code=404, detail="Message not found")
    chat = db.get(Chat, chat_id)
    mem = (
        db.query(ChatMember)
        .filter(ChatMember.chat_id == chat_id, ChatMember.user_id == me.id)
        .first()
    )
    is_admin = bool(mem and mem.role in ("owner", "admin"))
    # In DMs / saved both participants can pin; in groups/channels only admins.
    if chat and chat.kind not in ("dm", "saved") and not is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    if not msg.pinned:
        msg.pinned = True
        msg.pinned_at = now_ms()
        db.commit()
    await hub.broadcast(
        chat_id,
        {"type": "message_pinned", "chatId": chat_id, "messageId": message_id, "pinnedAt": msg.pinned_at},
    )
    return _msg_out(msg, viewer_id=me.id)


@router.delete("/{chat_id}/messages/{message_id}/pin", response_model=MessageOut)
async def unpin_message(
    chat_id: str,
    message_id: str,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> MessageOut:
    _require_member(db, chat_id, me.id)
    msg = db.get(Message, message_id)
    if not msg or msg.chat_id != chat_id:
        raise HTTPException(status_code=404, detail="Message not found")
    chat = db.get(Chat, chat_id)
    mem = (
        db.query(ChatMember)
        .filter(ChatMember.chat_id == chat_id, ChatMember.user_id == me.id)
        .first()
    )
    is_admin = bool(mem and mem.role in ("owner", "admin"))
    if chat and chat.kind not in ("dm", "saved") and not is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    if msg.pinned:
        msg.pinned = False
        msg.pinned_at = None
        db.commit()
    await hub.broadcast(
        chat_id,
        {"type": "message_unpinned", "chatId": chat_id, "messageId": message_id},
    )
    return _msg_out(msg, viewer_id=me.id)


@router.get("/{chat_id}/pins", response_model=list[MessageOut])
def list_pins(
    chat_id: str,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[MessageOut]:
    _require_member(db, chat_id, me.id)
    rows = (
        db.query(Message)
        .filter(
            Message.chat_id == chat_id,
            Message.pinned.is_(True),
            Message.deleted_at.is_(None),
        )
        .order_by(Message.pinned_at.desc())
        .limit(100)
        .all()
    )
    rmap = _reactions_by_message(db, [m.id for m in rows], me.id)
    return [_msg_out(m, viewer_id=me.id, reactions=rmap.get(m.id)) for m in rows]


@router.post(
    "/{chat_id}/messages/{message_id}/reactions",
    response_model=list[ReactionAggOut],
)
async def toggle_reaction(
    chat_id: str,
    message_id: str,
    body: ReactionIn,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[ReactionAggOut]:
    _require_member(db, chat_id, me.id)
    msg = db.get(Message, message_id)
    if not msg or msg.chat_id != chat_id:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.deleted_at:
        raise HTTPException(status_code=410, detail="Message deleted")
    emoji = body.emoji.strip()
    if not emoji:
        raise HTTPException(status_code=400, detail="Empty emoji")

    existing = (
        db.query(MessageReaction)
        .filter(
            MessageReaction.message_id == message_id,
            MessageReaction.user_id == me.id,
            MessageReaction.emoji == emoji,
        )
        .first()
    )
    if existing:
        db.delete(existing)
    else:
        db.add(
            MessageReaction(
                chat_id=chat_id,
                message_id=message_id,
                user_id=me.id,
                emoji=emoji,
            )
        )
    db.commit()

    aggregated = _reactions_by_message(db, [message_id], me.id).get(message_id, [])
    # Broadcast a viewer-neutral aggregate (no `mine` field bias). Each client
    # recomputes `mine` locally from the diff event.
    payload = {
        "type": "reactions_updated",
        "chatId": chat_id,
        "messageId": message_id,
        "userId": me.id,
        "emoji": emoji,
        "added": existing is None,
    }
    await hub.broadcast(chat_id, payload)
    return aggregated


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
    if body.slowModeSeconds is not None:
        chat.slow_mode_seconds = int(body.slowModeSeconds)
    if body.subscribersOnly is not None:
        chat.subscribers_only = bool(body.subscribersOnly)
    if body.signedPosts is not None:
        chat.signed_posts = bool(body.signedPosts)
    if body.autoDeleteSeconds is not None:
        chat.auto_delete_seconds = int(body.autoDeleteSeconds)
    if body.banMedia is not None:
        chat.ban_media = bool(body.banMedia)
    if body.banVoice is not None:
        chat.ban_voice = bool(body.banVoice)
    if body.banStickers is not None:
        chat.ban_stickers = bool(body.banStickers)
    if body.banLinks is not None:
        chat.ban_links = bool(body.banLinks)
    if body.topicsEnabled is not None:
        chat.topics_enabled = bool(body.topicsEnabled)
    chat.updated_at = now_ms()
    _audit(
        db,
        chat.id,
        me.id,
        "chat_settings",
        target_kind="chat",
        target_id=chat.id,
        payload={k: v for k, v in body.model_dump(exclude_none=True).items()},
    )
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
    prev_role = target.role
    if body.role == "owner":
        my_mem.role = "admin"
    target.role = body.role
    _audit(
        db,
        chat.id,
        me.id,
        "role_change",
        target_kind="user",
        target_id=target.user_id,
        payload={"from": prev_role, "to": target.role},
    )
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
    if target.user_id != me.id:
        _audit(
            db,
            chat.id,
            me.id,
            "member_kick",
            target_kind="user",
            target_id=target.user_id,
            payload={"role": target.role},
        )
    else:
        _audit(db, chat.id, me.id, "member_leave", target_kind="user", target_id=me.id)
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


# ---------------------------------------------------------------------------
# Topics (threads inside a group/channel)
# ---------------------------------------------------------------------------


def _topic_out(t: Topic) -> TopicOut:
    return TopicOut(
        id=t.id,
        chatId=t.chat_id,
        title=t.title,
        icon=t.icon,
        createdBy=t.created_by,
        createdAt=t.created_at,
        closed=bool(t.closed),
        lastMessageAt=int(t.last_message_at or t.created_at),
    )


def _require_chat_admin(db: Session, chat: Chat, user_id: str) -> ChatMember:
    mem = (
        db.query(ChatMember)
        .filter(ChatMember.chat_id == chat.id, ChatMember.user_id == user_id)
        .first()
    )
    if not mem or mem.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin only")
    return mem


@router.get("/{chat_id}/topics", response_model=list[TopicOut])
def list_topics(
    chat_id: str,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[TopicOut]:
    _require_member(db, chat_id, me.id)
    rows = (
        db.query(Topic)
        .filter(Topic.chat_id == chat_id)
        .order_by(Topic.last_message_at.desc())
        .limit(500)
        .all()
    )
    return [_topic_out(t) for t in rows]


@router.post("/{chat_id}/topics", response_model=TopicOut)
def create_topic(
    chat_id: str,
    body: TopicCreateIn,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> TopicOut:
    chat = _require_member(db, chat_id, me.id)
    if chat.kind == "dm":
        raise HTTPException(status_code=400, detail="Topics are not available in DMs")
    if not bool(getattr(chat, "topics_enabled", False)):
        raise HTTPException(status_code=400, detail="Topics are not enabled in this chat")
    _require_chat_admin(db, chat, me.id)
    t = Topic(
        chat_id=chat.id,
        title=body.title.strip()[:120],
        icon=(body.icon or "")[:8],
        created_by=me.id,
    )
    db.add(t)
    db.flush()
    _audit(
        db,
        chat.id,
        me.id,
        "topic_create",
        target_kind="topic",
        target_id=t.id,
        payload={"title": t.title},
    )
    db.commit()
    db.refresh(t)
    return _topic_out(t)


@router.patch("/{chat_id}/topics/{topic_id}", response_model=TopicOut)
def update_topic(
    chat_id: str,
    topic_id: str,
    body: TopicPatchIn,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> TopicOut:
    chat = _require_member(db, chat_id, me.id)
    _require_chat_admin(db, chat, me.id)
    t = db.get(Topic, topic_id)
    if not t or t.chat_id != chat.id:
        raise HTTPException(status_code=404, detail="Topic not found")
    changes: dict[str, object] = {}
    if body.title is not None:
        t.title = body.title.strip()[:120]
        changes["title"] = t.title
    if body.icon is not None:
        t.icon = body.icon[:8]
        changes["icon"] = t.icon
    if body.closed is not None:
        t.closed = bool(body.closed)
        changes["closed"] = t.closed
    _audit(
        db,
        chat.id,
        me.id,
        "topic_update",
        target_kind="topic",
        target_id=t.id,
        payload=changes,
    )
    db.commit()
    db.refresh(t)
    return _topic_out(t)


@router.delete("/{chat_id}/topics/{topic_id}")
def delete_topic(
    chat_id: str,
    topic_id: str,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    chat = _require_member(db, chat_id, me.id)
    _require_chat_admin(db, chat, me.id)
    t = db.get(Topic, topic_id)
    if not t or t.chat_id != chat.id:
        raise HTTPException(status_code=404, detail="Topic not found")
    db.delete(t)
    _audit(db, chat.id, me.id, "topic_delete", target_kind="topic", target_id=topic_id)
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Admin action log
# ---------------------------------------------------------------------------


@router.get("/{chat_id}/admin-log", response_model=list[AdminLogOut])
def list_admin_log(
    chat_id: str,
    before: int | None = None,
    limit: int = 100,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[AdminLogOut]:
    chat = _require_member(db, chat_id, me.id)
    _require_chat_admin(db, chat, me.id)
    q = db.query(AdminLog).filter(AdminLog.chat_id == chat_id)
    if before is not None:
        q = q.filter(AdminLog.created_at < before)
    rows = q.order_by(AdminLog.created_at.desc()).limit(max(1, min(limit, 500))).all()
    out: list[AdminLogOut] = []
    for r in rows:
        try:
            payload = json.loads(r.payload) if r.payload else {}
        except (ValueError, TypeError):
            payload = {}
        out.append(
            AdminLogOut(
                id=r.id,
                chatId=r.chat_id,
                actorId=r.actor_id,
                targetKind=r.target_kind or "",
                targetId=r.target_id or "",
                action=r.action,
                payload=payload,
                createdAt=r.created_at,
            )
        )
    return out


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
