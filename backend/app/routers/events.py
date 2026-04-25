from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..models import Event, User
from ..schemas import EventIn, EventOut

router = APIRouter(prefix="/events", tags=["events"])


def _out(e: Event) -> EventOut:
    return EventOut(id=e.id, title=e.title, date=e.date, start=e.start, end=e.end, note=e.note)


@router.get("", response_model=list[EventOut])
def list_events(me: User = Depends(current_user), db: Session = Depends(get_db)) -> list[EventOut]:
    rows = (
        db.query(Event)
        .filter(Event.owner_id == me.id)
        .order_by(Event.date.asc(), Event.start.asc())
        .all()
    )
    return [_out(e) for e in rows]


@router.post("", response_model=EventOut)
def create_event(
    body: EventIn, me: User = Depends(current_user), db: Session = Depends(get_db)
) -> EventOut:
    e = Event(
        owner_id=me.id,
        title=body.title,
        date=body.date,
        start=body.start,
        end=body.end,
        note=body.note,
    )
    db.add(e)
    db.commit()
    db.refresh(e)
    return _out(e)


@router.patch("/{event_id}", response_model=EventOut)
def update_event(
    event_id: str,
    body: EventIn,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> EventOut:
    e = db.get(Event, event_id)
    if not e or e.owner_id != me.id:
        raise HTTPException(status_code=404, detail="Event not found")
    e.title = body.title
    e.date = body.date
    e.start = body.start
    e.end = body.end
    e.note = body.note
    db.commit()
    db.refresh(e)
    return _out(e)


@router.delete("/{event_id}")
def delete_event(
    event_id: str, me: User = Depends(current_user), db: Session = Depends(get_db)
) -> dict:
    e = db.get(Event, event_id)
    if not e or e.owner_id != me.id:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(e)
    db.commit()
    return {"ok": True}
