from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..models import Contact, User
from ..schemas import UserOut, UserUpdateIn

router = APIRouter(prefix="/users", tags=["users"])


def _out(
    u: User,
    me_contacts: dict[str, Contact] | None = None,
    *,
    is_self: bool = False,
) -> UserOut:
    info = me_contacts.get(u.id) if me_contacts else None
    raw_links = (getattr(u, "links", "") or "").split("\n")
    links = [ln.strip() for ln in raw_links if ln and ln.strip()]
    avatar_url = getattr(u, "avatar_url", "") or None
    avatar_svg = getattr(u, "avatar_svg", "") or None
    status = getattr(u, "status", "") or None
    presence = getattr(u, "presence", "everyone") or "everyone"
    # Honour presence privacy. The user themselves and their contacts always
    # see lastSeen; everyone else may be filtered depending on the setting.
    last_seen: int | None = u.last_seen_at
    if not is_self:
        if presence == "nobody":
            last_seen = None
        elif presence == "contacts" and not info:
            last_seen = None
    return UserOut(
        id=u.id,
        handle=u.handle,
        name=u.name,
        bio=u.bio,
        kind=u.kind,
        phone=u.phone,
        avatarUrl=avatar_url,
        avatarSvg=avatar_svg,
        status=status,
        presence=presence,
        links=links,
        lastSeen=last_seen,
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
    return _out(u, {u.id: c} if c else None, is_self=u.id == me.id)


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
    if body.avatarSvg is not None:
        me.avatar_svg = body.avatarSvg.strip()
    if body.status is not None:
        me.status = body.status.strip()[:140]
    if body.presence is not None:
        me.presence = body.presence
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
    return _out(me, is_self=True)


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


@router.get("/me/blocked", response_model=list[UserOut])
def list_blocked(
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[UserOut]:
    rows = (
        db.query(Contact, User)
        .join(User, User.id == Contact.contact_id)
        .filter(Contact.owner_id == me.id, Contact.blocked.is_(True))
        .all()
    )
    return [_out(u, {u.id: c}) for c, u in rows]


class _DeleteAccountIn(BaseModel):
    handle: str


@router.delete("/me")
def delete_account(
    body: _DeleteAccountIn,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Permanent account deletion.

    Requires the caller to retype their @handle as a confirmation token. We
    null out the user's PII in place rather than deleting the row so that
    foreign-key references (messages, posts, chat membership) remain valid;
    chats containing only the deleted user are left dangling but become
    orphaned (no other member can re-join).
    """
    expected = me.handle.lstrip("@").lower()
    given = body.handle.strip().lstrip("@").lower()
    if not given or given != expected:
        raise HTTPException(status_code=400, detail="Handle does not match")
    me.handle = f"deleted_{me.id[:8]}"
    me.name = "Deleted user"
    me.password_hash = ""
    me.bio = ""
    me.phone = ""
    me.avatar_url = ""
    me.avatar_svg = ""
    me.status = ""
    me.links = ""
    db.commit()
    return {"ok": True}


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

from pydantic import Field

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
