from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..models import Report, User

router = APIRouter(prefix="/reports", tags=["reports"])


SubjectKind = Literal["user", "message", "chat", "post", "comment"]
Reason = Literal["spam", "abuse", "illegal", "impersonation", "other"]


class ReportIn(BaseModel):
    subjectKind: SubjectKind
    subjectId: str = Field(..., min_length=1, max_length=80)
    reason: Reason
    note: str = Field("", max_length=2000)


class ReportOut(BaseModel):
    id: str
    status: str


@router.post("", response_model=ReportOut)
def create_report(
    body: ReportIn,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> ReportOut:
    # Light rate-limit: block if this user already filed ≥10 reports in the
    # last hour against anything. Abuse of the abuse system is abuse.
    from ..models import now_ms

    hour_ago = now_ms() - 3600 * 1000
    recent = (
        db.query(Report)
        .filter(Report.reporter_id == me.id, Report.created_at >= hour_ago)
        .count()
    )
    if recent >= 10:
        raise HTTPException(status_code=429, detail="Too many reports")
    # Refuse self-report.
    if body.subjectKind == "user" and body.subjectId == me.id:
        raise HTTPException(status_code=400, detail="Cannot report yourself")
    r = Report(
        reporter_id=me.id,
        subject_kind=body.subjectKind,
        subject_id=body.subjectId,
        reason=body.reason,
        note=body.note.strip(),
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return ReportOut(id=r.id, status=r.status)
