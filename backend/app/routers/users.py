from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..models import Contact, User
from ..schemas import UserOut, UserUpdateIn

router = APIRouter(prefix="/users", tags=["users"])


def _out(u: User, me_contacts: dict[str, Contact] | None = None) -> UserOut:
    info = me_contacts.get(u.id) if me_contacts else None
    raw_links = (getattr(u, "links", "") or "").split("\n")
    links = [ln.strip() for ln in raw_links if ln and ln.strip()]
    avatar_url = getattr(u, "avatar_url", "") or None
    return UserOut(
        id=u.id,
        handle=u.handle,
        name=u.name,
        bio=u.bio,
        kind=u.kind,
        phone=u.phone,
        avatarUrl=avatar_url,
        links=links,
        lastSeen=u.last_seen_at,
        isContact=bool(info),
        blocked=bool(info and info.blocked),
    )


@router.get("/search", response_model=list[UserOut])
def search(
    q: str = "",
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[UserOut]:
    qn = q.strip().lstrip("@").lower()
    if len(qn) < 1:
        return []
    # Escape SQL LIKE wildcards in user input so `%` / `_` don't broaden the match.
    def _esc(s: str) -> str:
        return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")

    handle_pat = f"%{_esc(qn)}%"
    name_pat = f"%{_esc(q.strip())}%"
    rows = (
        db.query(User)
        .filter(
            User.id != me.id,
            or_(
                User.handle.like(handle_pat, escape="\\"),
                User.name.ilike(name_pat, escape="\\"),
            ),
        )
        .order_by(User.handle)
        .limit(20)
        .all()
    )
    contacts = {
        c.contact_id: c
        for c in db.query(Contact).filter(Contact.owner_id == me.id).all()
    }
    return [_out(u, contacts) for u in rows]


@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: str,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> UserOut:
    if user_id == "me":
        user_id = me.id
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    c = (
        db.query(Contact)
        .filter(Contact.owner_id == me.id, Contact.contact_id == u.id)
        .first()
    )
    return _out(u, {u.id: c} if c else None)


@router.patch("/me", response_model=UserOut)
def update_me(
    body: UserUpdateIn,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> UserOut:
    if body.name is not None:
        me.name = body.name.strip()
    if body.bio is not None:
        me.bio = body.bio
    if body.phone is not None:
        me.phone = body.phone
    if body.avatarUrl is not None:
        me.avatar_url = body.avatarUrl.strip()
    if body.links is not None:
        cleaned = [ln.strip() for ln in body.links if ln and ln.strip()]
        # Validate each link is an absolute http(s) URL — keeps the API from
        # storing arbitrary text and prevents javascript: scheme abuse.
        for ln in cleaned:
            if not (ln.startswith("http://") or ln.startswith("https://")):
                raise HTTPException(status_code=400, detail=f"Invalid link: {ln}")
            if len(ln) > 300:
                raise HTTPException(status_code=400, detail="Link too long")
        me.links = "\n".join(cleaned)
    db.add(me)
    db.commit()
    db.refresh(me)
    return _out(me)


@router.post("/{user_id}/contact", response_model=UserOut)
def add_contact(
    user_id: str,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> UserOut:
    if user_id == me.id:
        raise HTTPException(status_code=400, detail="Cannot add self")
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    existing = (
        db.query(Contact)
        .filter(Contact.owner_id == me.id, Contact.contact_id == target.id)
        .first()
    )
    if existing:
        existing.blocked = False
        contact = existing
    else:
        contact = Contact(owner_id=me.id, contact_id=target.id)
        db.add(contact)
    db.commit()
    db.refresh(contact)
    return _out(target, {target.id: contact})


@router.delete("/{user_id}/contact", response_model=UserOut)
def remove_contact(
    user_id: str,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> UserOut:
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    db.query(Contact).filter(
        Contact.owner_id == me.id, Contact.contact_id == target.id
    ).delete()
    db.commit()
    return _out(target)


@router.post("/{user_id}/block", response_model=UserOut)
def block(
    user_id: str,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> UserOut:
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    c = (
        db.query(Contact)
        .filter(Contact.owner_id == me.id, Contact.contact_id == target.id)
        .first()
    )
    if c is None:
        c = Contact(owner_id=me.id, contact_id=target.id, blocked=True)
        db.add(c)
    else:
        c.blocked = True
    db.commit()
    db.refresh(c)
    return _out(target, {target.id: c})


@router.post("/{user_id}/unblock", response_model=UserOut)
def unblock(
    user_id: str,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> UserOut:
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    c = (
        db.query(Contact)
        .filter(Contact.owner_id == me.id, Contact.contact_id == target.id)
        .first()
    )
    if c:
        c.blocked = False
        db.commit()
    return _out(target, {target.id: c} if c else None)


@router.get("", response_model=list[UserOut])
def list_contacts(
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[UserOut]:
    rows = (
        db.query(Contact, User)
        .join(User, User.id == Contact.contact_id)
        .filter(Contact.owner_id == me.id)
        .all()
    )
    return [_out(u, {u.id: c}) for c, u in rows]


# --- Bot creation -----------------------------------------------------------
import re as _re

from pydantic import BaseModel, Field

from ..auth import hash_password


class BotCreateIn(BaseModel):
    handle: str = Field(min_length=3, max_length=32)
    name: str = Field(min_length=1, max_length=80)


_HANDLE_RE = _re.compile(r"^[A-Za-z0-9_]+$")


@router.post("/bots", response_model=UserOut)
def create_bot(
    body: BotCreateIn,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> UserOut:
    raw = body.handle.strip().lstrip("@")
    if not _HANDLE_RE.match(raw):
        raise HTTPException(status_code=400, detail="Bot handle must be ASCII letters/digits/underscore")
    handle = raw if raw.lower().endswith("bot") else f"{raw}_bot"
    if db.query(User).filter(User.handle == handle).first():
        raise HTTPException(status_code=409, detail="Bot handle already taken")
    bot = User(
        handle=handle,
        name=body.name.strip(),
        password_hash=hash_password("!bot-no-login"),
        kind="bot",
        bot_owner_id=me.id,
    )
    db.add(bot)
    db.flush()
    # Owner becomes a "contact" of the bot so it shows up in contacts.
    own = Contact(owner_id=me.id, contact_id=bot.id, blocked=False)
    db.add(own)
    db.commit()
    db.refresh(bot)
    return _out(bot, {bot.id: own})
