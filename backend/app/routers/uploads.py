from __future__ import annotations

import mimetypes
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
_CHUNK = 64 * 1024

# Allow-list of upload content types. We deliberately do NOT accept
# `application/octet-stream` because it is the universal escape hatch a
# malicious client would use to bypass any prefix check (the browser would
# then happily store and re-serve the file). Only real media MIME types are
# accepted; anything else is rejected at upload time.
_ALLOWED_PREFIXES = ("audio/", "image/", "video/")
_ALLOWED_EXACT: set[str] = set()

# Allow-list of extensions we are willing to serve with their real MIME type.
# Anything not on this list is forced to `application/octet-stream` +
# `Content-Disposition: attachment` at download time, so even if a malicious
# upload slipped through it cannot execute in the browser.
_SAFE_DOWNLOAD_EXTS = {
    "png", "jpg", "jpeg", "gif", "webp", "bmp", "ico",
    "mp4", "webm", "mov", "m4v", "ogv",
    "mp3", "ogg", "oga", "wav", "m4a", "aac", "flac", "opus",
}


def _safe_ext(filename: str | None, content_type: str | None) -> str:
    if filename and "." in filename:
        ext = filename.rsplit(".", 1)[-1].lower()
        if ext.isalnum() and len(ext) <= 5:
            return ext
    if content_type and "/" in content_type:
        sub = content_type.split("/", 1)[1].lower()
        if sub.isalnum() and len(sub) <= 8:
            return sub
    return "bin"


@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    user: User = Depends(current_user),
) -> dict:
    ct = (file.content_type or "").lower()
    if not (ct.startswith(_ALLOWED_PREFIXES) or ct in _ALLOWED_EXACT):
        raise HTTPException(status_code=415, detail=f"Unsupported media type: {ct}")

    # Stream the upload to disk in chunks, aborting as soon as the cap is hit
    # so attackers cannot exhaust server memory with a giant request body.
    uid = secrets.token_urlsafe(12)
    ext = _safe_ext(file.filename, ct)
    name = f"{uid}.{ext}"
    path = _UPLOAD_DIR / name
    total = 0
    try:
        with path.open("wb") as out:
            while True:
                chunk = await file.read(_CHUNK)
                if not chunk:
                    break
                total += len(chunk)
                if total > _MAX_BYTES:
                    out.close()
                    try:
                        path.unlink(missing_ok=True)
                    except OSError:
                        pass
                    raise HTTPException(status_code=413, detail="file too large")
                out.write(chunk)
    except HTTPException:
        raise
    except Exception:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass
        raise

    if total == 0:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass
        raise HTTPException(status_code=400, detail="empty upload")

    return {
        "id": uid,
        "name": name,
        "url": f"/uploads/{name}",
        "size": total,
        "type": ct,
        "ownerId": user.id,
    }


def _safe_media_type(name: str) -> str:
    """Only serve allow-listed extensions with their real MIME type. Anything
    else (including unknown / future MIME types) is forced to
    `application/octet-stream` and downloaded as an attachment by the caller.
    """
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if ext not in _SAFE_DOWNLOAD_EXTS:
        return "application/octet-stream"
    guessed, _ = mimetypes.guess_type(name)
    if not guessed:
        return "application/octet-stream"
    return guessed


@router.get("/{name}")
def get_file(name: str) -> FileResponse:
    # Block path traversal
    if "/" in name or ".." in name or name.startswith("."):
        raise HTTPException(status_code=400, detail="bad name")
    path = _UPLOAD_DIR / name
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="not found")
    media_type = _safe_media_type(name)
    headers = {
        # Force download for anything the browser might execute; harmless for media.
        "Content-Disposition": f'inline; filename="{name}"'
        if media_type.startswith(("image/", "audio/", "video/"))
        else f'attachment; filename="{name}"',
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=86400",
    }
    return FileResponse(path, media_type=media_type, headers=headers)
