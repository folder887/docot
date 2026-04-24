from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..models import Post, PostLike, User
from ..schemas import PostIn, PostOut

router = APIRouter(prefix="/posts", tags=["posts"])


def _out(db: Session, p: Post, me_id: str) -> PostOut:
    likes = db.query(func.count(PostLike.id)).filter(PostLike.post_id == p.id).scalar() or 0
    liked = (
        db.query(PostLike)
        .filter(PostLike.post_id == p.id, PostLike.user_id == me_id)
        .first()
        is not None
    )
    return PostOut(
        id=p.id,
        authorId=p.author_id,
        text=p.text,
        at=p.created_at,
        likes=likes,
        reposts=p.reposts,
        replies=p.replies,
        liked=liked,
    )


@router.get("", response_model=list[PostOut])
def list_posts(me: User = Depends(current_user), db: Session = Depends(get_db)) -> list[PostOut]:
    rows = db.query(Post).order_by(Post.created_at.desc()).limit(200).all()
    return [_out(db, p, me.id) for p in rows]


@router.post("", response_model=PostOut)
def create_post(
    body: PostIn, me: User = Depends(current_user), db: Session = Depends(get_db)
) -> PostOut:
    p = Post(author_id=me.id, text=body.text)
    db.add(p)
    db.commit()
    db.refresh(p)
    return _out(db, p, me.id)


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
    p = db.get(Post, post_id)
    if not p:
        raise HTTPException(status_code=404, detail="Post not found")
    p.reposts += 1
    db.commit()
    db.refresh(p)
    return _out(db, p, me.id)
