from __future__ import annotations

import re
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..models import (
    Community,
    CommunityMember,
    Post,
    PostComment,
    PostCommentVote,
    PostMedia,
    PostRepost,
    PostVote,
    User,
)
from ..schemas import (
    CommunityIn,
    CommunityOut,
    PostCommentIn,
    PostCommentOut,
    PostIn,
    PostMediaOut,
    PostOut,
    VoteIn,
)

router = APIRouter(prefix="/posts", tags=["posts"])
communities_router = APIRouter(prefix="/communities", tags=["communities"])

_SLUG_RE = re.compile(r"^[a-z0-9_-]+$")

SortBy = Literal["hot", "new", "top"]


# ---------- helpers ---------------------------------------------------------


def _media_for(db: Session, post_id: str) -> list[PostMediaOut]:
    rows = (
        db.query(PostMedia)
        .filter(PostMedia.post_id == post_id)
        .order_by(PostMedia.id.asc())
        .all()
    )
    return [
        PostMediaOut(url=m.url, kind=m.kind, name=m.name, mime=m.mime, size=m.size)
        for m in rows
    ]


def _vote_aggs(db: Session, post_id: str, me_id: str) -> tuple[int, int, int]:
    rows = (
        db.query(PostVote.value, func.count(PostVote.id))
        .filter(PostVote.post_id == post_id)
        .group_by(PostVote.value)
        .all()
    )
    ups = sum(c for v, c in rows if v > 0)
    downs = sum(c for v, c in rows if v < 0)
    mine = (
        db.query(PostVote)
        .filter(PostVote.post_id == post_id, PostVote.user_id == me_id)
        .first()
    )
    return ups, downs, (mine.value if mine else 0)


def _post_out(db: Session, p: Post, me_id: str) -> PostOut:
    ups, downs, my = _vote_aggs(db, p.id, me_id)
    reposts = (
        db.query(func.count(PostRepost.id)).filter(PostRepost.post_id == p.id).scalar() or 0
    )
    reposted = (
        db.query(PostRepost)
        .filter(PostRepost.post_id == p.id, PostRepost.user_id == me_id)
        .first()
        is not None
    )
    replies = (
        db.query(func.count(PostComment.id))
        .filter(PostComment.post_id == p.id, PostComment.deleted_at.is_(None))
        .scalar()
        or 0
    )
    return PostOut(
        id=p.id,
        authorId=p.author_id,
        text=p.text,
        at=p.created_at,
        likes=ups,
        reposts=reposts,
        replies=replies,
        liked=my == 1,
        reposted=reposted,
        media=_media_for(db, p.id),
        communityId=p.community_id or "",
        title=p.title or "",
        score=ups - downs,
        ups=ups,
        downs=downs,
        myVote=my,
    )


def _community_out(db: Session, c: Community, me_id: str) -> CommunityOut:
    members = (
        db.query(func.count(CommunityMember.id))
        .filter(CommunityMember.community_id == c.id)
        .scalar()
        or 0
    )
    mem = (
        db.query(CommunityMember)
        .filter(CommunityMember.community_id == c.id, CommunityMember.user_id == me_id)
        .first()
    )
    return CommunityOut(
        id=c.id,
        slug=c.slug,
        name=c.name,
        description=c.description,
        createdBy=c.created_by,
        createdAt=c.created_at,
        members=members,
        joined=mem is not None,
        role=mem.role if mem else "",
    )


def _comment_out(db: Session, c: PostComment, me_id: str) -> PostCommentOut:
    rows = (
        db.query(PostCommentVote.value, func.count(PostCommentVote.id))
        .filter(PostCommentVote.comment_id == c.id)
        .group_by(PostCommentVote.value)
        .all()
    )
    score = sum(v * cnt for v, cnt in rows)
    mine = (
        db.query(PostCommentVote)
        .filter(
            PostCommentVote.comment_id == c.id,
            PostCommentVote.user_id == me_id,
        )
        .first()
    )
    return PostCommentOut(
        id=c.id,
        postId=c.post_id,
        parentId=c.parent_id or "",
        authorId=c.author_id,
        text="" if c.deleted_at else c.text,
        at=c.created_at,
        score=score,
        myVote=mine.value if mine else 0,
        deleted=c.deleted_at is not None,
    )


# ---------- post listing / sorting ------------------------------------------


def _apply_sort(query, sort: SortBy, db: Session):
    if sort == "new":
        return query.order_by(Post.created_at.desc())
    if sort == "top":
        # Top by net score: subquery aggregating votes per post.
        sub = (
            db.query(
                PostVote.post_id.label("pid"),
                func.coalesce(func.sum(PostVote.value), 0).label("score"),
            )
            .group_by(PostVote.post_id)
            .subquery()
        )
        return (
            query.outerjoin(sub, sub.c.pid == Post.id)
            .order_by(func.coalesce(sub.c.score, 0).desc(), Post.created_at.desc())
        )
    # hot: blend score with recency. We approximate Reddit's hot algorithm by
    # ordering on `score * 10000 + created_at_minutes`. Newer posts and
    # higher-scored posts both bubble up; recency dominates only when scores
    # are tied.
    sub = (
        db.query(
            PostVote.post_id.label("pid"),
            func.coalesce(func.sum(PostVote.value), 0).label("score"),
        )
        .group_by(PostVote.post_id)
        .subquery()
    )
    return (
        query.outerjoin(sub, sub.c.pid == Post.id)
        .order_by(
            (func.coalesce(sub.c.score, 0) * 10000 + Post.created_at / 60000).desc()
        )
    )


@router.get("", response_model=list[PostOut])
def list_posts(
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
    community: str = "",
    sort: SortBy = "hot",
    limit: int = Query(default=50, ge=1, le=200),
) -> list[PostOut]:
    q = db.query(Post)
    if community:
        # Allow either slug or id.
        c = db.query(Community).filter(Community.slug == community).first()
        if c is None:
            c = db.get(Community, community)
        if c is None:
            return []
        q = q.filter(Post.community_id == c.id)
    q = _apply_sort(q, sort, db)
    rows = q.limit(limit).all()
    return [_post_out(db, p, me.id) for p in rows]


@router.get("/mine", response_model=list[PostOut])
def list_my_posts(
    me: User = Depends(current_user), db: Session = Depends(get_db)
) -> list[PostOut]:
    rows = (
        db.query(Post)
        .filter(Post.author_id == me.id)
        .order_by(Post.created_at.desc())
        .limit(200)
        .all()
    )
    return [_post_out(db, p, me.id) for p in rows]


@router.get("/reposted", response_model=list[PostOut])
def list_reposted_posts(
    me: User = Depends(current_user), db: Session = Depends(get_db)
) -> list[PostOut]:
    rows = (
        db.query(Post)
        .join(PostRepost, PostRepost.post_id == Post.id)
        .filter(PostRepost.user_id == me.id)
        .order_by(PostRepost.created_at.desc())
        .limit(200)
        .all()
    )
    return [_post_out(db, p, me.id) for p in rows]


@router.get("/{post_id}", response_model=PostOut)
def get_post(
    post_id: str, me: User = Depends(current_user), db: Session = Depends(get_db)
) -> PostOut:
    p = db.get(Post, post_id)
    if not p:
        raise HTTPException(status_code=404, detail="Post not found")
    return _post_out(db, p, me.id)


# ---------- create / delete -------------------------------------------------


@router.post("", response_model=PostOut)
def create_post(
    body: PostIn, me: User = Depends(current_user), db: Session = Depends(get_db)
) -> PostOut:
    if not body.text.strip() and not body.media and not body.title.strip():
        raise HTTPException(status_code=400, detail="Empty post")
    community_id = ""
    if body.communityId:
        c = db.query(Community).filter(Community.slug == body.communityId).first()
        if c is None:
            c = db.get(Community, body.communityId)
        if c is None:
            raise HTTPException(status_code=404, detail="Community not found")
        community_id = c.id
    p = Post(
        author_id=me.id,
        text=body.text,
        title=body.title.strip(),
        community_id=community_id,
    )
    db.add(p)
    db.flush()
    for m in body.media:
        db.add(
            PostMedia(
                post_id=p.id,
                url=m.url,
                kind=m.kind,
                name=m.name,
                mime=m.mime,
                size=m.size,
            )
        )
    db.commit()
    db.refresh(p)
    return _post_out(db, p, me.id)


@router.delete("/{post_id}")
def delete_post(
    post_id: str,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    p = db.get(Post, post_id)
    if not p:
        raise HTTPException(status_code=404, detail="Post not found")
    if p.author_id != me.id:
        raise HTTPException(status_code=403, detail="Not your post")
    db.delete(p)
    db.commit()
    return {"ok": True}


# ---------- voting ----------------------------------------------------------


def _set_vote(db: Session, post_id: str, user_id: str, value: int) -> None:
    if value not in (-1, 0, 1):
        raise HTTPException(status_code=400, detail="Invalid vote")
    existing = (
        db.query(PostVote)
        .filter(PostVote.post_id == post_id, PostVote.user_id == user_id)
        .first()
    )
    if value == 0:
        if existing:
            db.delete(existing)
    else:
        if existing:
            existing.value = value
        else:
            db.add(PostVote(post_id=post_id, user_id=user_id, value=value))


@router.post("/{post_id}/vote", response_model=PostOut)
def vote_post(
    post_id: str,
    body: VoteIn,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> PostOut:
    p = db.get(Post, post_id)
    if not p:
        raise HTTPException(status_code=404, detail="Post not found")
    _set_vote(db, post_id, me.id, body.value)
    db.commit()
    return _post_out(db, p, me.id)


@router.post("/{post_id}/like", response_model=PostOut)
def like_post(
    post_id: str,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> PostOut:
    """Legacy endpoint — toggles between up-vote and clear."""
    p = db.get(Post, post_id)
    if not p:
        raise HTTPException(status_code=404, detail="Post not found")
    existing = (
        db.query(PostVote)
        .filter(PostVote.post_id == post_id, PostVote.user_id == me.id)
        .first()
    )
    new_value = 0 if (existing and existing.value == 1) else 1
    _set_vote(db, post_id, me.id, new_value)
    db.commit()
    return _post_out(db, p, me.id)


@router.post("/{post_id}/repost", response_model=PostOut)
def repost(
    post_id: str, me: User = Depends(current_user), db: Session = Depends(get_db)
) -> PostOut:
    p = db.get(Post, post_id)
    if not p:
        raise HTTPException(status_code=404, detail="Post not found")
    existing = (
        db.query(PostRepost)
        .filter(PostRepost.post_id == post_id, PostRepost.user_id == me.id)
        .first()
    )
    if existing:
        db.delete(existing)
    else:
        db.add(PostRepost(post_id=post_id, user_id=me.id))
    db.commit()
    db.refresh(p)
    return _post_out(db, p, me.id)


# ---------- comments --------------------------------------------------------


@router.get("/{post_id}/comments", response_model=list[PostCommentOut])
def list_comments(
    post_id: str,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[PostCommentOut]:
    if not db.get(Post, post_id):
        raise HTTPException(status_code=404, detail="Post not found")
    rows = (
        db.query(PostComment)
        .filter(PostComment.post_id == post_id)
        .order_by(PostComment.created_at.asc())
        .all()
    )
    return [_comment_out(db, c, me.id) for c in rows]


@router.post("/{post_id}/comments", response_model=PostCommentOut)
def create_comment(
    post_id: str,
    body: PostCommentIn,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> PostCommentOut:
    p = db.get(Post, post_id)
    if not p:
        raise HTTPException(status_code=404, detail="Post not found")
    parent_id = ""
    if body.parentId:
        parent = db.get(PostComment, body.parentId)
        if not parent or parent.post_id != post_id:
            raise HTTPException(status_code=400, detail="Invalid parent")
        parent_id = parent.id
    c = PostComment(
        post_id=post_id, author_id=me.id, text=body.text, parent_id=parent_id
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return _comment_out(db, c, me.id)


@router.delete("/{post_id}/comments/{comment_id}")
def delete_comment(
    post_id: str,
    comment_id: str,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    c = db.get(PostComment, comment_id)
    if not c or c.post_id != post_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    if c.author_id != me.id:
        raise HTTPException(status_code=403, detail="Not your comment")
    from ..models import now_ms as _now

    c.deleted_at = _now()
    c.text = ""
    db.commit()
    return {"ok": True}


@router.post("/{post_id}/comments/{comment_id}/vote", response_model=PostCommentOut)
def vote_comment(
    post_id: str,
    comment_id: str,
    body: VoteIn,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> PostCommentOut:
    c = db.get(PostComment, comment_id)
    if not c or c.post_id != post_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    if body.value not in (-1, 0, 1):
        raise HTTPException(status_code=400, detail="Invalid vote")
    existing = (
        db.query(PostCommentVote)
        .filter(
            PostCommentVote.comment_id == comment_id,
            PostCommentVote.user_id == me.id,
        )
        .first()
    )
    if body.value == 0:
        if existing:
            db.delete(existing)
    else:
        if existing:
            existing.value = body.value
        else:
            db.add(
                PostCommentVote(
                    comment_id=comment_id, user_id=me.id, value=body.value
                )
            )
    db.commit()
    return _comment_out(db, c, me.id)


# ---------- communities -----------------------------------------------------


@communities_router.get("", response_model=list[CommunityOut])
def list_communities(
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
    joined_only: bool = False,
    q: str = "",
) -> list[CommunityOut]:
    query = db.query(Community)
    if joined_only:
        query = query.join(
            CommunityMember,
            (CommunityMember.community_id == Community.id)
            & (CommunityMember.user_id == me.id),
        )
    if q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(
            (Community.slug.ilike(like)) | (Community.name.ilike(like))
        )
    rows = query.order_by(Community.created_at.desc()).limit(200).all()
    return [_community_out(db, c, me.id) for c in rows]


@communities_router.post("", response_model=CommunityOut)
def create_community(
    body: CommunityIn,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> CommunityOut:
    slug = body.slug.strip().lower().lstrip("/")
    if not _SLUG_RE.match(slug):
        raise HTTPException(
            status_code=400,
            detail="Slug must be lowercase ASCII letters, digits, dashes, or underscores",
        )
    if db.query(Community).filter(Community.slug == slug).first():
        raise HTTPException(status_code=409, detail="Slug already taken")
    c = Community(
        slug=slug,
        name=body.name.strip(),
        description=body.description,
        created_by=me.id,
    )
    db.add(c)
    db.flush()
    db.add(CommunityMember(community_id=c.id, user_id=me.id, role="moderator"))
    db.commit()
    db.refresh(c)
    return _community_out(db, c, me.id)


@communities_router.get("/{slug}", response_model=CommunityOut)
def get_community(
    slug: str,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> CommunityOut:
    c = db.query(Community).filter(Community.slug == slug).first()
    if c is None:
        c = db.get(Community, slug)
    if c is None:
        raise HTTPException(status_code=404, detail="Community not found")
    return _community_out(db, c, me.id)


@communities_router.post("/{slug}/join", response_model=CommunityOut)
def join_community(
    slug: str,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> CommunityOut:
    c = db.query(Community).filter(Community.slug == slug).first()
    if c is None:
        c = db.get(Community, slug)
    if c is None:
        raise HTTPException(status_code=404, detail="Community not found")
    existing = (
        db.query(CommunityMember)
        .filter(
            CommunityMember.community_id == c.id, CommunityMember.user_id == me.id
        )
        .first()
    )
    if not existing:
        db.add(CommunityMember(community_id=c.id, user_id=me.id))
        db.commit()
    return _community_out(db, c, me.id)


@communities_router.post("/{slug}/leave", response_model=CommunityOut)
def leave_community(
    slug: str,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> CommunityOut:
    c = db.query(Community).filter(Community.slug == slug).first()
    if c is None:
        c = db.get(Community, slug)
    if c is None:
        raise HTTPException(status_code=404, detail="Community not found")
    existing = (
        db.query(CommunityMember)
        .filter(
            CommunityMember.community_id == c.id, CommunityMember.user_id == me.id
        )
        .first()
    )
    if existing and c.created_by != me.id:
        db.delete(existing)
        db.commit()
    return _community_out(db, c, me.id)
