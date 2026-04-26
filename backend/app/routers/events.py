from __future__ import annotations

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..models import Event, Note, Post, ChatMember, Message, User
from ..schemas import EventIn, EventOut

router = APIRouter(prefix="/events", tags=["events"])


def _out(e: Event) -> EventOut:
    return EventOut(id=e.id, title=e.title, date=e.date, start=e.start, end=e.end, note=e.note)


class EventRef(BaseModel):
    kind: str  # "note" | "post" | "message"
    id: str
    title: str
    snippet: str
    chatId: str = ""
    createdAt: int = 0


class EventRefsOut(BaseModel):
    eventId: str
    notes: list[EventRef]
    posts: list[EventRef]
    messages: list[EventRef]


@router.get("", response_model=list[EventOut])
def list_events(me: User = Depends(current_user), db: Session = Depends(get_db)) -> list[EventOut]:
    rows = (
        db.query(Event)
        .filter(Event.owner_id == me.id)
        .order_by(Event.date.asc(), Event.start.asc())
        .all()
    )
    return [_out(e) for e in rows]


@router.post("", response_model=EventOut)
def create_event(
    body: EventIn, me: User = Depends(current_user), db: Session = Depends(get_db)
) -> EventOut:
    e = Event(
        owner_id=me.id,
        title=body.title,
        date=body.date,
        start=body.start,
        end=body.end,
        note=body.note,
    )
    db.add(e)
    db.commit()
    db.refresh(e)
    return _out(e)


@router.patch("/{event_id}", response_model=EventOut)
def update_event(
    event_id: str,
    body: EventIn,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> EventOut:
    e = db.get(Event, event_id)
    if not e or e.owner_id != me.id:
        raise HTTPException(status_code=404, detail="Event not found")
    e.title = body.title
    e.date = body.date
    e.start = body.start
    e.end = body.end
    e.note = body.note
    db.commit()
    db.refresh(e)
    return _out(e)


@router.delete("/{event_id}")
def delete_event(
    event_id: str, me: User = Depends(current_user), db: Session = Depends(get_db)
) -> dict:
    e = db.get(Event, event_id)
    if not e or e.owner_id != me.id:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(e)
    db.commit()
    return {"ok": True}


def _snippet(text: str, needle: str, span: int = 80) -> str:
    if not text:
        return ""
    idx = text.lower().find(needle.lower())
    if idx < 0:
        return text[:span]
    a = max(0, idx - span // 2)
    b = min(len(text), idx + len(needle) + span // 2)
    return ("…" if a > 0 else "") + text[a:b] + ("…" if b < len(text) else "")


@router.get("/{event_id}/refs", response_model=EventRefsOut)
def event_refs(
    event_id: str,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> EventRefsOut:
    """Find every place that mentions an event via the `[[event:<id>]]`
    cross-link syntax. Scoped to content the caller can see: own notes,
    posts in the global feed (or any community they're a member of — for now
    we just include any post; the body is public), and messages in chats
    they belong to."""
    e = db.get(Event, event_id)
    if not e or e.owner_id != me.id:
        raise HTTPException(status_code=404, detail="Event not found")

    needle = f"[[event:{event_id}]]"

    note_rows = (
        db.query(Note)
        .filter(Note.owner_id == me.id, Note.body.contains(needle))
        .order_by(Note.updated_at.desc())
        .limit(50)
        .all()
    )
    notes_out = [
        EventRef(kind="note", id=n.id, title=n.title, snippet=_snippet(n.body, needle), createdAt=n.updated_at)
        for n in note_rows
    ]

    post_rows = (
        db.query(Post)
        .filter(or_(Post.text.contains(needle), Post.title.contains(needle)))
        .order_by(Post.created_at.desc())
        .limit(50)
        .all()
    )
    posts_out = [
        EventRef(kind="post", id=p.id, title=p.title or "", snippet=_snippet(p.text, needle), createdAt=p.created_at)
        for p in post_rows
    ]

    # Only show messages from chats the caller is a member of.
    chat_ids = [
        row[0]
        for row in db.query(ChatMember.chat_id).filter(ChatMember.user_id == me.id).all()
    ]
    msg_rows: list[Message] = []
    if chat_ids:
        msg_rows = (
            db.query(Message)
            .filter(Message.chat_id.in_(chat_ids), Message.text.contains(needle))
            .order_by(Message.created_at.desc())
            .limit(50)
            .all()
        )
    messages_out = [
        EventRef(
            kind="message",
            id=m.id,
            title="",
            snippet=_snippet(m.text, needle),
            chatId=m.chat_id,
            createdAt=m.created_at,
        )
        for m in msg_rows
    ]

    return EventRefsOut(eventId=event_id, notes=notes_out, posts=posts_out, messages=messages_out)
