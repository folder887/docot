from __future__ import annotations

import os
import secrets
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from ..auth import current_user
from ..models import User

router = APIRouter(prefix="/uploads", tags=["uploads"])

_UPLOAD_DIR = Path(os.environ.get("DOCOT_UPLOAD_DIR", "/data/uploads"))
_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

_MAX_BYTES = 25 * 1024 * 1024  # 25 MB
_ALLOWED_PREFIXES = ("audio/", "image/", "video/")
_ALLOWED_NAMES = {"application/octet-stream"}


def _safe_ext(filename: str | None, content_type: str | None) -> str:
    if filename and "." in filename:
        ext = filename.rsplit(".", 1)[-1].lower()
        if ext.isalnum() and len(ext) <= 5:
            return ext
    if content_type:
        if "/" in content_type:
            sub = content_type.split("/", 1)[1]
            if sub.isalnum() and len(sub) <= 8:
                return sub
    return "bin"


@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    user: User = Depends(current_user),
) -> dict:
    ct = (file.content_type or "").lower()
    if not (ct.startswith(_ALLOWED_PREFIXES) or ct in _ALLOWED_NAMES):
        raise HTTPException(status_code=415, detail=f"Unsupported media type: {ct}")

    data = await file.read()
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="empty upload")
    if len(data) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="file too large")

    uid = secrets.token_urlsafe(12)
    ext = _safe_ext(file.filename, ct)
    name = f"{uid}.{ext}"
    path = _UPLOAD_DIR / name
    path.write_bytes(data)

    return {
        "id": uid,
        "name": name,
        "url": f"/uploads/{name}",
        "size": len(data),
        "type": ct,
        "ownerId": user.id,
    }


@router.get("/{name}")
def get_file(name: str) -> FileResponse:
    # block path traversal
    if "/" in name or ".." in name or name.startswith("."):
        raise HTTPException(status_code=400, detail="bad name")
    path = _UPLOAD_DIR / name
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="not found")
    return FileResponse(path)
