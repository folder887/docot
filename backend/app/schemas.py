from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


HandleStr = str  # validated in endpoints


class SignupIn(BaseModel):
    handle: str = Field(min_length=2, max_length=32)
    name: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=6, max_length=128)

    @field_validator("handle")
    @classmethod
    def normalize_handle(cls, v: str) -> str:
        v = v.strip().lstrip("@").lower()
        if not v.replace("_", "").isalnum():
            raise ValueError("Handle must be alphanumeric/underscore only")
        return v


class LoginIn(BaseModel):
    handle: str
    password: str

    @field_validator("handle")
    @classmethod
    def normalize_handle(cls, v: str) -> str:
        return v.strip().lstrip("@").lower()


class AuthOut(BaseModel):
    token: str
    user: "UserOut"


class UserOut(BaseModel):
    id: str
    handle: str
    name: str
    bio: str = ""
    kind: str = "user"
    phone: str = ""
    avatarUrl: str | None = None
    links: list[str] = []
    lastSeen: int | None = None
    isContact: bool = False
    blocked: bool = False

    class Config:
        from_attributes = True


class UserUpdateIn(BaseModel):
    name: str | None = None
    bio: str | None = None
    phone: str | None = None
    avatarUrl: str | None = Field(default=None, max_length=500)
    links: list[str] | None = Field(default=None, max_length=10)


class ReactionAggOut(BaseModel):
    emoji: str
    count: int
    mine: bool


class MessageOut(BaseModel):
    id: str
    authorId: str
    text: str
    at: int
    editedAt: int | None = None
    deletedAt: int | None = None
    replyToId: str | None = None
    sealed: bool = False
    reactions: list[ReactionAggOut] = []

    class Config:
        from_attributes = True


class ReactionIn(BaseModel):
    emoji: str = Field(min_length=1, max_length=32)


class MessageIn(BaseModel):
    # 64 KB accommodates plaintext (≤4000 chars) plus the ~1.78× expansion of a
    # double-base64 Signal envelope, multiplied by up to ~16 sibling devices when
    # using the multi-device fanout envelope (`__sig1m:`).
    text: str = Field(min_length=1, max_length=65000)
    replyToId: str | None = None
    # When true (DM only), the server stores the real author privately but the
    # public `authorId` field is blanked in API responses and WS events.
    sealed: bool = False


class MessagePatch(BaseModel):
    text: str = Field(min_length=1, max_length=65000)
    sealed: bool | None = None


class ChatOut(BaseModel):
    id: str
    kind: str
    title: str
    description: str = ""
    isPublic: bool = False
    slowModeSeconds: int = 0
    subscribersOnly: bool = False
    signedPosts: bool = False
    createdBy: str | None = None
    participants: list[str]
    pinned: bool = False
    muted: bool = False
    role: str = "member"
    updatedAt: int
    lastMessage: MessageOut | None = None
    messages: list[MessageOut] = []


class ChatCreateIn(BaseModel):
    kind: Literal["dm", "group", "channel"] = "dm"
    title: str | None = None
    description: str | None = None
    isPublic: bool | None = None
    participantIds: list[str] = []


class ChatPatch(BaseModel):
    title: str | None = None
    description: str | None = None
    isPublic: bool | None = None
    slowModeSeconds: int | None = Field(default=None, ge=0, le=3600)
    subscribersOnly: bool | None = None
    signedPosts: bool | None = None


class ChatMemberOut(BaseModel):
    userId: str
    role: str
    joinedAt: int


class ChatMemberPatch(BaseModel):
    role: Literal["owner", "admin", "member"]


class InviteOut(BaseModel):
    token: str
    chatId: str
    createdBy: str
    createdAt: int
    expiresAt: int | None = None
    maxUses: int | None = None
    uses: int = 0
    revoked: bool = False
    url: str = ""


class InviteCreateIn(BaseModel):
    expiresAt: int | None = None
    maxUses: int | None = None


class InviteInfoOut(BaseModel):
    token: str
    chatId: str
    title: str
    kind: str
    description: str = ""
    memberCount: int = 0
    valid: bool = True


class NoteOut(BaseModel):
    id: str
    title: str
    body: str
    tags: list[str] = []
    createdAt: int
    updatedAt: int

    class Config:
        from_attributes = True


class NoteIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = ""
    tags: list[str] = []


class NotePatch(BaseModel):
    title: str | None = None
    body: str | None = None
    tags: list[str] | None = None


class EventOut(BaseModel):
    id: str
    title: str
    date: str
    start: str
    end: str
    note: str = ""

    class Config:
        from_attributes = True


class EventIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    date: str
    start: str
    end: str
    note: str = ""


class PostMediaOut(BaseModel):
    url: str
    kind: Literal["image", "video", "audio", "file"]
    name: str = ""
    mime: str = ""
    size: int = 0


class PostMediaIn(BaseModel):
    url: str = Field(min_length=1, max_length=400)
    kind: Literal["image", "video", "audio", "file"]
    name: str = ""
    mime: str = ""
    size: int = 0


class PostOut(BaseModel):
    id: str
    authorId: str
    text: str
    at: int
    likes: int
    reposts: int
    replies: int
    liked: bool = False
    reposted: bool = False
    media: list[PostMediaOut] = []


class PostIn(BaseModel):
    text: str = Field(min_length=0, max_length=1000, default="")
    media: list[PostMediaIn] = []


class FolderOut(BaseModel):
    id: str
    name: str
    sortOrder: int
    chatIds: list[str] = []


class FolderIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    chatIds: list[str] = []


class FolderPatch(BaseModel):
    name: str | None = None
    chatIds: list[str] | None = None


class PreKeyOut(BaseModel):
    keyId: int
    publicKey: str


class KeyBundleIn(BaseModel):
    """Identity + signed prekey + initial OTP pool, scoped to a single device.

    Uploaded once per device (signup or new login on a fresh browser/app); OTPs
    are replenished separately via /keys/onetime."""

    deviceId: int = Field(ge=1, le=2**31 - 1)
    registrationId: int = Field(ge=1)
    identityKey: str
    signedPreKeyId: int = Field(ge=0)
    signedPreKey: str
    signedPreKeySignature: str
    oneTimePreKeys: list[PreKeyOut] = Field(default_factory=list)


class OneTimePreKeysIn(BaseModel):
    deviceId: int = Field(ge=1, le=2**31 - 1)
    keys: list[PreKeyOut]


class KeyBundleOut(BaseModel):
    """A consumable bundle for a single device: identity + signed prekey + one OTP."""

    userId: str
    deviceId: int
    registrationId: int
    identityKey: str
    signedPreKeyId: int
    signedPreKey: str
    signedPreKeySignature: str
    preKey: PreKeyOut | None = None


class KeyStatusOut(BaseModel):
    hasBundle: bool
    deviceId: int | None = None
    oneTimeRemaining: int


class DeviceOut(BaseModel):
    deviceId: int
    registrationId: int
    updatedAt: int


class DeviceListOut(BaseModel):
    userId: str
    devices: list[DeviceOut] = []


class PairStartOut(BaseModel):
    token: str
    expires: int


class PairClaimIn(BaseModel):
    token: str = Field(min_length=8, max_length=64)


class PollOptionOut(BaseModel):
    id: int
    text: str
    votes: int
    mine: bool


class PollOut(BaseModel):
    id: str
    chatId: str
    messageId: str
    question: str
    multiple: bool
    anonymous: bool
    createdBy: str
    createdAt: int
    closedAt: int | None = None
    options: list[PollOptionOut]
    totalVoters: int


class PollCreateIn(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    options: list[str] = Field(min_length=2, max_length=12)
    multiple: bool = False
    anonymous: bool = True


class PollVoteIn(BaseModel):
    optionIds: list[int] = Field(min_length=0, max_length=12)


AuthOut.model_rebuild()
