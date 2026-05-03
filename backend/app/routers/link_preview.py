from __future__ import annotations

import ipaddress
import re
import socket
import time
from html.parser import HTMLParser
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException

from ..auth import current_user
from ..models import User

router = APIRouter(prefix="/link-preview", tags=["link-preview"])

# Trim parsed responses aggressively — landing pages get huge fast and we only
# need <head>. 256 KB is enough for every real-world OG document.
MAX_BYTES = 256 * 1024
# Most upstream sites respond in <1s; anything slower is bad UX inline in
# chat. Cap hard so we never block on a pathological host.
TIMEOUT_S = 4.0

_CACHE: dict[str, tuple[float, dict]] = {}
CACHE_TTL_S = 60 * 60  # 1h


class _MetaCollector(HTMLParser):
    """Pull <title> + og:/twitter: meta tags out of a truncated HTML blob.
    We deliberately only scan as far as </head> (or the 256 KB cap) so a
    late `<meta name=...>` past a 5 MB inline-image preload never delays us.
    """

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.meta: dict[str, str] = {}
        self.title: str = ""
        self._in_title = False
        self._done = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if self._done:
            return
        t = tag.lower()
        if t == "title":
            self._in_title = True
            return
        if t != "meta":
            return
        a = {k.lower(): (v or "") for k, v in attrs}
        key = (a.get("property") or a.get("name") or "").lower()
        val = a.get("content") or ""
        if key and val and key not in self.meta:
            self.meta[key] = val

    def handle_endtag(self, tag: str) -> None:
        t = tag.lower()
        if t == "title":
            self._in_title = False
        if t == "head":
            self._done = True

    def handle_data(self, data: str) -> None:
        if self._in_title and not self.title:
            self.title = (data or "").strip()[:300]


def _is_safe_host(host: str) -> bool:
    """Block SSRF to RFC1918 / link-local / loopback / metadata IPs. Best
    effort — we resolve once and reject if ANY A/AAAA is private."""
    if not host:
        return False
    try:
        infos = socket.getaddrinfo(host, None)
    except Exception:
        return False
    for info in infos:
        ip_str = info[4][0]
        try:
            ip = ipaddress.ip_address(ip_str)
        except Exception:
            return False
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            return False
        # AWS / GCP / Azure metadata endpoints
        if ip_str == "169.254.169.254":
            return False
    return True


_IMG_SRC_RE = re.compile(r"<img[^>]+src=['\"]([^'\"]+)['\"]", re.IGNORECASE)


def _fallback_image(html: str) -> str:
    """If no og:image, take the first <img src> that looks like a real URL."""
    m = _IMG_SRC_RE.search(html[:32_000])
    if not m:
        return ""
    src = m.group(1)
    if src.startswith("http://") or src.startswith("https://"):
        return src
    return ""


def _fetch(url: str) -> dict:
    now = time.time()
    cached = _CACHE.get(url)
    if cached and now - cached[0] < CACHE_TTL_S:
        return cached[1]
    # The normaliser already enforces https, but double-check:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Unsupported URL scheme")
    if not parsed.hostname or not _is_safe_host(parsed.hostname):
        raise HTTPException(status_code=400, detail="Host not allowed")
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; DocotLinkPreview/1.0)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en;q=0.9, *;q=0.5",
    }
    try:
        with httpx.Client(
            follow_redirects=True,
            timeout=TIMEOUT_S,
            headers=headers,
            max_redirects=5,
        ) as client:
            with client.stream("GET", url) as resp:
                if resp.status_code >= 400:
                    raise HTTPException(
                        status_code=502,
                        detail=f"Upstream returned {resp.status_code}",
                    )
                ctype = resp.headers.get("content-type", "")
                if "text/html" not in ctype and "xhtml" not in ctype:
                    raise HTTPException(status_code=415, detail="Not an HTML page")
                # Re-check the resolved host after redirects so we don't let
                # `http://example.com` bounce us into `http://169.254.169.254`.
                final_host = resp.url.host or ""
                if not _is_safe_host(final_host):
                    raise HTTPException(status_code=400, detail="Redirect to blocked host")
                buf = bytearray()
                for chunk in resp.iter_bytes():
                    buf.extend(chunk)
                    if len(buf) >= MAX_BYTES:
                        break
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=504, detail=f"Fetch failed: {exc}") from exc

    html = buf.decode("utf-8", errors="replace")
    parser = _MetaCollector()
    try:
        parser.feed(html)
    except Exception:
        # If a malformed page breaks the parser, fall through with what we
        # already parsed — empty is better than 500.
        pass

    meta = parser.meta
    title = (
        meta.get("og:title")
        or meta.get("twitter:title")
        or parser.title
        or urlparse(url).hostname
        or url
    )
    description = (
        meta.get("og:description")
        or meta.get("twitter:description")
        or meta.get("description")
        or ""
    )
    image = meta.get("og:image") or meta.get("twitter:image") or _fallback_image(html)
    site = meta.get("og:site_name") or (urlparse(url).hostname or "")

    # Resolve relative og:image URLs against the final redirected URL.
    if image and not image.startswith(("http://", "https://")):
        image = str(httpx.URL(str(resp.url)).join(image))

    data = {
        "url": url,
        "finalUrl": str(resp.url),
        "title": title[:300],
        "description": description[:500],
        "image": image[:800] if image else "",
        "siteName": site[:100],
    }
    _CACHE[url] = (now, data)
    # Evict old entries opportunistically to avoid unbounded memory.
    if len(_CACHE) > 1024:
        cutoff = now - CACHE_TTL_S
        for k in [k for k, (t, _) in _CACHE.items() if t < cutoff]:
            _CACHE.pop(k, None)
    return data


@router.get("")
def link_preview(
    url: str,
    _me: User = Depends(current_user),
) -> dict:
    """Return OpenGraph metadata for `url`. Auth required (only our users
    can spray the fetcher) + SSRF-safe (private IPs blocked pre- and
    post-redirect). Responses cached 1h in-memory."""
    url = url.strip()
    if len(url) > 2000:
        raise HTTPException(status_code=400, detail="URL too long")
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Only http(s) URLs")
    return _fetch(url)
