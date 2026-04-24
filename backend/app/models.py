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


Index("ix_messages_chat_created", Message.chat_id, Message.created_at)
