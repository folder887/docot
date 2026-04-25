from __future__ import annotations

import time
import uuid
from typing import Literal

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def gen_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:12]}"


def now_ms() -> int:
    return int(time.time() * 1000)


ChatKind = Literal["dm", "group", "channel", "saved"]
UserKind = Literal["user", "bot", "channel", "group"]


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: gen_id("u_"))
    handle: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(80))
    password_hash: Mapped[str] = mapped_column(String(200))
    bio: Mapped[str] = mapped_column(Text, default="")
    kind: Mapped[str] = mapped_column(String(16), default="user")
    phone: Mapped[str] = mapped_column(String(32), default="")
    created_at: Mapped[int] = mapped_column(Integer, default=now_ms)
    last_seen_at: Mapped[int] = mapped_column(Integer, default=now_ms)

    chats: Mapped[list[ChatMember]] = relationship(back_populates="user")


class Chat(Base):
    __tablename__ = "chats"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: gen_id("c_"))
    kind: Mapped[str] = mapped_column(String(16), default="dm")
    title: Mapped[str] = mapped_column(String(120), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    created_at: Mapped[int] = mapped_column(Integer, default=now_ms)
    updated_at: Mapped[int] = mapped_column(Integer, default=now_ms)
    pinned_by_creator: Mapped[bool] = mapped_column(Boolean, default=False)

    members: Mapped[list[ChatMember]] = relationship(back_populates="chat", cascade="all, delete-orphan")
    messages: Mapped[list[Message]] = relationship(back_populates="chat", cascade="all, delete-orphan")


class ChatMember(Base):
    __tablename__ = "chat_members"
    __table_args__ = (UniqueConstraint("chat_id", "user_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    chat_id: Mapped[str] = mapped_column(String, ForeignKey("chats.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(16), default="member")  # owner|admin|member
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    muted: Mapped[bool] = mapped_column(Boolean, default=False)
    joined_at: Mapped[int] = mapped_column(Integer, default=now_ms)

    chat: Mapped[Chat] = relationship(back_populates="members")
    user: Mapped[User] = relationship(back_populates="chats")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: gen_id("m_"))
    chat_id: Mapped[str] = mapped_column(String, ForeignKey("chats.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    text: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[int] = mapped_column(Integer, default=now_ms, index=True)
    edited_at: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    deleted_at: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    reply_to_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("messages.id", ondelete="SET NULL"), nullable=True, default=None
    )
    # Sealed-sender flag: when true, API responses and WebSocket broadcasts
    # strip `author_id` so other clients (and any third party reading the
    # protocol stream) cannot see who sent the message; the recipient infers
    # the sender from chat context (DM has only two participants) and the
    # Signal PreKey envelope carries the verified sender identity key.
    sealed: Mapped[bool] = mapped_column(Boolean, default=False)

    chat: Mapped[Chat] = relationship(back_populates="messages")


class Contact(Base):
    __tablename__ = "contacts"
    __table_args__ = (UniqueConstraint("owner_id", "contact_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    contact_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    blocked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[int] = mapped_column(Integer, default=now_ms)


class Note(Base):
    __tablename__ = "notes"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: gen_id("n_"))
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text, default="")
    tags: Mapped[str] = mapped_column(Text, default="")  # comma-separated
    created_at: Mapped[int] = mapped_column(Integer, default=now_ms)
    updated_at: Mapped[int] = mapped_column(Integer, default=now_ms)


class Event(Base):
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: gen_id("e_"))
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    date: Mapped[str] = mapped_column(String(10))  # YYYY-MM-DD
    start: Mapped[str] = mapped_column(String(5))  # HH:MM
    end: Mapped[str] = mapped_column(String(5))
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[int] = mapped_column(Integer, default=now_ms)


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: gen_id("p_"))
    author_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[int] = mapped_column(Integer, default=now_ms, index=True)
    reposts: Mapped[int] = mapped_column(Integer, default=0)
    replies: Mapped[int] = mapped_column(Integer, default=0)


class PostLike(Base):
    __tablename__ = "post_likes"
    __table_args__ = (UniqueConstraint("post_id", "user_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    post_id: Mapped[str] = mapped_column(String, ForeignKey("posts.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[int] = mapped_column(Integer, default=now_ms)


class PostRepost(Base):
    __tablename__ = "post_reposts"
    __table_args__ = (UniqueConstraint("post_id", "user_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    post_id: Mapped[str] = mapped_column(String, ForeignKey("posts.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[int] = mapped_column(Integer, default=now_ms)


class ChatFolder(Base):
    __tablename__ = "chat_folders"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: gen_id("f_"))
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(40))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[int] = mapped_column(Integer, default=now_ms)


class ChatInvite(Base):
    __tablename__ = "chat_invites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    token: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    chat_id: Mapped[str] = mapped_column(String, ForeignKey("chats.id", ondelete="CASCADE"), index=True)
    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"))
    created_at: Mapped[int] = mapped_column(Integer, default=now_ms)
    expires_at: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    max_uses: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    uses: Mapped[int] = mapped_column(Integer, default=0)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)


class PostMedia(Base):
    __tablename__ = "post_media"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    post_id: Mapped[str] = mapped_column(String, ForeignKey("posts.id", ondelete="CASCADE"), index=True)
    url: Mapped[str] = mapped_column(String(400))
    kind: Mapped[str] = mapped_column(String(16))  # image|video|audio|file
    name: Mapped[str] = mapped_column(String(200), default="")
    size: Mapped[int] = mapped_column(Integer, default=0)
    mime: Mapped[str] = mapped_column(String(80), default="")
    created_at: Mapped[int] = mapped_column(Integer, default=now_ms)


class ChatFolderMember(Base):
    __tablename__ = "chat_folder_members"
    __table_args__ = (UniqueConstraint("folder_id", "chat_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    folder_id: Mapped[str] = mapped_column(String, ForeignKey("chat_folders.id", ondelete="CASCADE"), index=True)
    chat_id: Mapped[str] = mapped_column(String, ForeignKey("chats.id", ondelete="CASCADE"), index=True)


class UserKeys(Base):
    """Public Signal-protocol key bundle for a single (user, device) pair.

    Private keys never leave the client; only public/signed values are stored here.
    Encoded as base64-url strings. A single user may have multiple device rows
    (phone + laptop + desktop, etc.), each with its own identity key.
    """

    __tablename__ = "user_keys"

    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    device_id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    registration_id: Mapped[int] = mapped_column(Integer)
    identity_key: Mapped[str] = mapped_column(Text)
    signed_pre_key_id: Mapped[int] = mapped_column(Integer)
    signed_pre_key: Mapped[str] = mapped_column(Text)
    signed_pre_key_signature: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[int] = mapped_column(Integer, default=now_ms)


class OneTimePreKey(Base):
    """Pool of one-time prekeys; consumed atomically when a peer fetches a bundle.

    Each device of a user maintains its own pool of OTPs.
    """

    __tablename__ = "one_time_prekeys"
    __table_args__ = (UniqueConstraint("user_id", "device_id", "key_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    device_id: Mapped[int] = mapped_column(Integer, default=1, index=True)
    key_id: Mapped[int] = mapped_column(Integer)
    public_key: Mapped[str] = mapped_column(Text)
    consumed: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[int] = mapped_column(Integer, default=now_ms)


Index("ix_messages_chat_created", Message.chat_id, Message.created_at)
