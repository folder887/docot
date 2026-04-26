from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..models import Note, User, now_ms
from ..schemas import NoteIn, NoteOut, NotePatch

router = APIRouter(prefix="/notes", tags=["notes"])


def _out(n: Note) -> NoteOut:
    return NoteOut(
        id=n.id,
        title=n.title,
        body=n.body,
        tags=[t for t in n.tags.split(",") if t],
        createdAt=n.created_at,
        updatedAt=n.updated_at,
    )


@router.get("/tags", response_model=list[dict])
def list_tags(me: User = Depends(current_user), db: Session = Depends(get_db)) -> list[dict]:
    """Aggregate distinct tags across the caller's notes with usage counts."""
    rows = db.query(Note.tags).filter(Note.owner_id == me.id).all()
    counts: dict[str, int] = {}
    for (tags,) in rows:
        for t in (tags or "").split(","):
            t = t.strip()
            if not t:
                continue
            counts[t] = counts.get(t, 0) + 1
    return [{"tag": k, "count": v} for k, v in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))]


@router.get("/{note_id}/backlinks", response_model=list[NoteOut])
def list_backlinks(
    note_id: str,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[NoteOut]:
    """Find every other note (owned by caller) whose body contains
    `[[<title>]]` for this note's title. O(N) scan over the note set;
    fine for personal note volumes."""
    target = db.get(Note, note_id)
    if not target or target.owner_id != me.id:
        raise HTTPException(status_code=404, detail="Note not found")
    needle = f"[[{target.title}]]".lower()
    rows = (
        db.query(Note)
        .filter(Note.owner_id == me.id, Note.id != note_id)
        .all()
    )
    out = [n for n in rows if needle in (n.body or "").lower()]
    out.sort(key=lambda n: n.updated_at, reverse=True)
    return [_out(n) for n in out]


@router.get("", response_model=list[NoteOut])
def list_notes(me: User = Depends(current_user), db: Session = Depends(get_db)) -> list[NoteOut]:
    rows = db.query(Note).filter(Note.owner_id == me.id).order_by(Note.updated_at.desc()).all()
    return [_out(n) for n in rows]


@router.post("", response_model=NoteOut)
def create_note(body: NoteIn, me: User = Depends(current_user), db: Session = Depends(get_db)) -> NoteOut:
    n = Note(
        owner_id=me.id,
        title=body.title,
        body=body.body,
        tags=",".join([t.strip() for t in body.tags if t.strip()]),
    )
    db.add(n)
    db.commit()
    db.refresh(n)
    return _out(n)


@router.patch("/{note_id}", response_model=NoteOut)
def update_note(
    note_id: str,
    body: NotePatch,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> NoteOut:
    n = db.get(Note, note_id)
    if not n or n.owner_id != me.id:
        raise HTTPException(status_code=404, detail="Note not found")
    if body.title is not None:
        n.title = body.title
    if body.body is not None:
        n.body = body.body
    if body.tags is not None:
        n.tags = ",".join([t.strip() for t in body.tags if t.strip()])
    n.updated_at = now_ms()
    db.commit()
    db.refresh(n)
    return _out(n)


@router.delete("/{note_id}")
def delete_note(
    note_id: str,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    n = db.get(Note, note_id)
    if not n or n.owner_id != me.id:
        raise HTTPException(status_code=404, detail="Note not found")
    db.delete(n)
    db.commit()
    return {"ok": True}
