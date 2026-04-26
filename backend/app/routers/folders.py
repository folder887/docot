from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..models import ChatFolder, ChatFolderMember, ChatMember, User
from ..schemas import FolderIn, FolderOut, FolderPatch

router = APIRouter(prefix="/folders", tags=["folders"])


def _to_out(f: ChatFolder, chat_ids: list[str]) -> FolderOut:
    return FolderOut(id=f.id, name=f.name, sortOrder=f.sort_order, chatIds=chat_ids)


def _user_chat_ids(db: Session, user_id: str) -> set[str]:
    rows = db.query(ChatMember.chat_id).filter(ChatMember.user_id == user_id).all()
    return {r[0] for r in rows}


@router.get("", response_model=list[FolderOut])
def list_folders(
    me: User = Depends(current_user), db: Session = Depends(get_db)
) -> list[FolderOut]:
    folders = (
        db.query(ChatFolder)
        .filter(ChatFolder.owner_id == me.id)
        .order_by(ChatFolder.sort_order.asc(), ChatFolder.created_at.asc())
        .all()
    )
    out: list[FolderOut] = []
    for f in folders:
        chat_ids = [
            r[0]
            for r in db.query(ChatFolderMember.chat_id)
            .filter(ChatFolderMember.folder_id == f.id)
            .all()
        ]
        out.append(_to_out(f, chat_ids))
    return out


@router.post("", response_model=FolderOut)
def create_folder(
    body: FolderIn, me: User = Depends(current_user), db: Session = Depends(get_db)
) -> FolderOut:
    user_chats = _user_chat_ids(db, me.id)
    f = ChatFolder(owner_id=me.id, name=body.name.strip())
    db.add(f)
    db.flush()
    for cid in body.chatIds:
        if cid in user_chats:
            db.add(ChatFolderMember(folder_id=f.id, chat_id=cid))
    db.commit()
    db.refresh(f)
    return _to_out(f, [c for c in body.chatIds if c in user_chats])


@router.patch("/{folder_id}", response_model=FolderOut)
def update_folder(
    folder_id: str,
    body: FolderPatch,
    me: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> FolderOut:
    f = db.get(ChatFolder, folder_id)
    if not f or f.owner_id != me.id:
        raise HTTPException(status_code=404, detail="Folder not found")
    if body.name is not None:
        f.name = body.name.strip()
    if body.chatIds is not None:
        user_chats = _user_chat_ids(db, me.id)
        db.query(ChatFolderMember).filter(ChatFolderMember.folder_id == f.id).delete()
        for cid in body.chatIds:
            if cid in user_chats:
                db.add(ChatFolderMember(folder_id=f.id, chat_id=cid))
    db.commit()
    db.refresh(f)
    chat_ids = [
        r[0]
        for r in db.query(ChatFolderMember.chat_id)
        .filter(ChatFolderMember.folder_id == f.id)
        .all()
    ]
    return _to_out(f, chat_ids)


@router.delete("/{folder_id}")
def delete_folder(
    folder_id: str, me: User = Depends(current_user), db: Session = Depends(get_db)
) -> dict:
    f = db.get(ChatFolder, folder_id)
    if not f or f.owner_id != me.id:
        raise HTTPException(status_code=404, detail="Folder not found")
    db.delete(f)
    db.commit()
    return {"ok": True}
