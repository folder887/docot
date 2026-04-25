from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..models import Post, PostLike, PostMedia, PostRepost, User
from ..schemas import PostIn, PostMediaOut, PostOut

router = APIRouter(prefix="/posts", tags=["posts"])


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


def _out(db: Session, p: Post, me_id: str) -> PostOut:
    likes = db.query(func.count(PostLike.id)).filter(PostLike.post_id == p.id).scalar() or 0
    reposts = db.query(func.count(PostRepost.id)).filter(PostRepost.post_id == p.id).scalar() or 0
    liked = (
        db.query(PostLike)
        .filter(PostLike.post_id == p.id, PostLike.user_id == me_id)
        .first()
        is not None
    )
    reposted = (
        db.query(PostRepost)
        .filter(PostRepost.post_id == p.id, PostRepost.user_id == me_id)
        .first()
        is not None
    )
    return PostOut(
        id=p.id,
        authorId=p.author_id,
        text=p.text,
        at=p.created_at,
        likes=likes,
        reposts=reposts,
        replies=p.replies,
        liked=liked,
        reposted=reposted,
        media=_media_for(db, p.id),
    )


@router.get("", response_model=list[PostOut])
def list_posts(me: User = Depends(current_user), db: Session = Depends(get_db)) -> list[PostOut]:
    rows = db.query(Post).order_by(Post.created_at.desc()).limit(200).all()
    return [_out(db, p, me.id) for p in rows]


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
    return [_out(db, p, me.id) for p in rows]


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
    return [_out(db, p, me.id) for p in rows]


@router.post("", response_model=PostOut)
def create_post(
    body: PostIn, me: User = Depends(current_user), db: Session = Depends(get_db)
) -> PostOut:
    if not body.text.strip() and not body.media:
        raise HTTPException(status_code=400, detail="Empty post")
    p = Post(author_id=me.id, text=body.text)
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
    return _out(db, p, me.id)


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


@router.post("/{post_id}/like", response_model=PostOut)
def like_post(
    post_id: str,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> PostOut:
    p = db.get(Post, post_id)
    if not p:
        raise HTTPException(status_code=404, detail="Post not found")
    existing = (
        db.query(PostLike)
        .filter(PostLike.post_id == post_id, PostLike.user_id == me.id)
        .first()
    )
    if existing:
        db.delete(existing)
    else:
        db.add(PostLike(post_id=post_id, user_id=me.id))
    db.commit()
    return _out(db, p, me.id)


@router.post("/{post_id}/repost", response_model=PostOut)
def repost(
    post_id: str, me: User = Depends(current_user), db: Session = Depends(get_db)
) -> PostOut:
    """Toggle a repost. One repost per (user, post) — repeated taps no longer inflate the counter."""
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
    return _out(db, p, me.id)
