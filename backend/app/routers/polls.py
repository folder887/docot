from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..models import Chat, ChatMember, Message, Poll, PollOption, PollVote, User, now_ms
from ..schemas import (
    PollCreateIn,
    PollOptionOut,
    PollOut,
    PollVoteIn,
)
from ..ws import hub

router = APIRouter(tags=["polls"])


def _require_member(db: Session, chat_id: str, user_id: str) -> Chat:
    chat = db.get(Chat, chat_id)
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found")
    member = (
        db.query(ChatMember)
        .filter(ChatMember.chat_id == chat_id, ChatMember.user_id == user_id)
        .first()
    )
    if member is None:
        raise HTTPException(status_code=403, detail="Not a member")
    return chat


def _poll_out(db: Session, poll: Poll, viewer_id: str) -> PollOut:
    """Aggregate vote counts per option and tag the viewer's votes. Cheap
    enough to run synchronously: polls are bounded to 12 options."""
    options_out: list[PollOptionOut] = []
    voter_ids: set[str] = set()
    for opt in poll.options:
        votes = db.query(PollVote).filter(PollVote.option_id == opt.id).all()
        mine = any(v.user_id == viewer_id for v in votes)
        for v in votes:
            voter_ids.add(v.user_id)
        options_out.append(
            PollOptionOut(id=opt.id, text=opt.text, votes=len(votes), mine=mine)
        )
    return PollOut(
        id=poll.id,
        chatId=poll.chat_id,
        messageId=poll.message_id,
        question=poll.question,
        multiple=poll.multiple,
        anonymous=poll.anonymous,
        createdBy=poll.created_by,
        createdAt=poll.created_at,
        closedAt=poll.closed_at,
        options=options_out,
        totalVoters=len(voter_ids),
    )


@router.post("/chats/{chat_id}/polls", response_model=PollOut)
async def create_poll(
    chat_id: str,
    body: PollCreateIn,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> PollOut:
    _require_member(db, chat_id, me.id)
    options = [o.strip() for o in body.options if o and o.strip()]
    if len(options) < 2:
        raise HTTPException(status_code=400, detail="At least 2 options required")
    poll_id = uuid.uuid4().hex
    msg_id = uuid.uuid4().hex
    # Marker message — clients render a `__poll:<id>` text as a poll card.
    msg = Message(
        id=msg_id,
        chat_id=chat_id,
        author_id=me.id,
        text=f"__poll:{poll_id}",
        created_at=now_ms(),
    )
    db.add(msg)
    poll = Poll(
        id=poll_id,
        chat_id=chat_id,
        message_id=msg_id,
        question=body.question.strip(),
        multiple=body.multiple,
        anonymous=body.anonymous,
        created_by=me.id,
    )
    db.add(poll)
    db.flush()  # ensure poll exists before options
    for i, text in enumerate(options):
        db.add(PollOption(poll_id=poll_id, idx=i, text=text))
    db.commit()
    db.refresh(poll)
    out = _poll_out(db, poll, me.id)
    # Broadcast as a normal message so the chat stream renders the marker
    # immediately on every device; clients will fetch the poll detail on
    # demand.
    payload = {
        "type": "message",
        "chatId": chat_id,
        "message": {
            "id": msg.id,
            "authorId": me.id,
            "text": msg.text,
            "at": msg.created_at,
            "editedAt": None,
            "deletedAt": None,
            "replyToId": None,
            "sealed": False,
            "reactions": [],
        },
    }
    await hub.broadcast(chat_id, payload)
    return out


@router.get("/polls/{poll_id}", response_model=PollOut)
def get_poll(
    poll_id: str,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> PollOut:
    poll = db.get(Poll, poll_id)
    if poll is None:
        raise HTTPException(status_code=404, detail="Poll not found")
    _require_member(db, poll.chat_id, me.id)
    return _poll_out(db, poll, me.id)


@router.post("/polls/{poll_id}/vote", response_model=PollOut)
async def vote_poll(
    poll_id: str,
    body: PollVoteIn,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> PollOut:
    poll = db.get(Poll, poll_id)
    if poll is None:
        raise HTTPException(status_code=404, detail="Poll not found")
    if poll.closed_at:
        raise HTTPException(status_code=410, detail="Poll closed")
    _require_member(db, poll.chat_id, me.id)

    valid_ids = {opt.id for opt in poll.options}
    requested = set(body.optionIds)
    if not requested.issubset(valid_ids):
        raise HTTPException(status_code=400, detail="Unknown option")
    if not poll.multiple and len(requested) > 1:
        raise HTTPException(status_code=400, detail="Single-choice poll")

    # Replace the user's vote set atomically: drop existing rows, insert new.
    db.query(PollVote).filter(
        PollVote.poll_id == poll_id, PollVote.user_id == me.id
    ).delete()
    for oid in requested:
        db.add(PollVote(poll_id=poll_id, option_id=oid, user_id=me.id))
    db.commit()
    db.refresh(poll)
    out = _poll_out(db, poll, me.id)
    payload = {
        "type": "poll_updated",
        "chatId": poll.chat_id,
        "pollId": poll_id,
        "messageId": poll.message_id,
    }
    await hub.broadcast(poll.chat_id, payload)
    return out


@router.post("/polls/{poll_id}/close", response_model=PollOut)
async def close_poll(
    poll_id: str,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> PollOut:
    poll = db.get(Poll, poll_id)
    if poll is None:
        raise HTTPException(status_code=404, detail="Poll not found")
    if poll.created_by != me.id:
        raise HTTPException(status_code=403, detail="Only creator can close")
    if poll.closed_at:
        return _poll_out(db, poll, me.id)
    poll.closed_at = now_ms()
    db.commit()
    out = _poll_out(db, poll, me.id)
    payload = {
        "type": "poll_updated",
        "chatId": poll.chat_id,
        "pollId": poll_id,
        "messageId": poll.message_id,
    }
    await hub.broadcast(poll.chat_id, payload)
    return out
