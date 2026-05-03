import { memo, useEffect, useState } from 'react'
import { api } from '../api'
import type { ApiLinkPreview } from '../api'

// Tiny in-tab cache to avoid re-fetching identical URLs across many bubbles.
// Browsers also cache the response naturally; this just dedups concurrent
// renders and the round-trip cost.
const cache = new Map<string, Promise<ApiLinkPreview>>()

function fetchPreview(url: string): Promise<ApiLinkPreview> {
  let p = cache.get(url)
  if (!p) {
    p = api.linkPreview(url).catch((e) => {
      // Drop the failure from the cache so a future bubble can retry.
      cache.delete(url)
      throw e
    })
    cache.set(url, p)
  }
  return p
}

/** Pick the first http(s) URL out of a chunk of plaintext. We render at most
 * one preview per message to keep bubbles compact. */
export function firstUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"']+/)
  return m ? m[0] : null
}

export const LinkPreview = memo(function LinkPreview({ url }: { url: string }) {
  const [data, setData] = useState<ApiLinkPreview | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    let cancelled = false
    fetchPreview(url)
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch(() => {
        if (!cancelled) setErr(true)
      })
    return () => {
      cancelled = true
    }
  }, [url])

  if (err || !data) return null
  if (!data.title && !data.description && !data.image) return null
  const host = (() => {
    try {
      return new URL(data.finalUrl || data.url).hostname.replace(/^www\./, '')
    } catch {
      return data.siteName || ''
    }
  })()
  return (
    <a
      href={data.finalUrl || data.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 block overflow-hidden rounded-2xl border-2 border-current/20 bg-current/5 transition hover:bg-current/10"
    >
      {data.image && (
        <img
          src={data.image}
          alt=""
          className="aspect-[1.91/1] w-full object-cover"
          loading="lazy"
          onError={(e) => {
            ;(e.currentTarget as HTMLImageElement).style.display = 'none'
          }}
        />
      )}
      <div className="px-3 py-2">
        {host && (
          <div className="truncate text-[11px] font-bold uppercase tracking-wider opacity-70">
            {host}
          </div>
        )}
        {data.title && (
          <div className="line-clamp-2 font-bold leading-tight">{data.title}</div>
        )}
        {data.description && (
          <div className="mt-0.5 line-clamp-2 text-sm opacity-80">{data.description}</div>
        )}
      </div>
    </a>
  )
})
