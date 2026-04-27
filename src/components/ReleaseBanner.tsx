import { useEffect, useState } from 'react'
import { useApp } from '../store'
import { t } from '../i18n'

const REPO = 'folder887/docot'
const DISMISS_KEY = 'docot:release_dismissed'
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6h

declare const __APP_VERSION__: string

type GhRelease = {
  tag_name: string
  html_url: string
  name: string | null
  assets: { name: string; browser_download_url: string; size: number }[]
}

/** Lexicographic-friendly semver compare. Treats e.g. v0.1.10 > v0.1.2 by
 * splitting on dots and parsing each segment as int. Pre-release tags
 * (`-rc.1`) lose to clean versions, matching common expectations. */
function newer(remote: string, local: string): boolean {
  const norm = (s: string) =>
    s
      .replace(/^v/i, '')
      .split('-')[0]
      .split('.')
      .map((p) => Number.parseInt(p, 10) || 0)
  const a = norm(remote)
  const b = norm(local)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x !== y) return x > y
  }
  return false
}

/** Picks the asset most relevant for the running platform. We can't trust
 * navigator.userAgent fully but the broad fingerprint is sufficient — the
 * banner offers a single "best guess" download plus a "see all" link to
 * the releases page. */
function pickAsset(assets: GhRelease['assets']): { url: string; name: string } | null {
  const ua = navigator.userAgent.toLowerCase()
  let preferred: RegExp[] = []
  if (ua.includes('windows')) preferred = [/setup\.exe$/i, /\.msi$/i, /\.exe$/i]
  else if (ua.includes('android')) preferred = [/\.apk$/i]
  else if (ua.includes('mac')) preferred = [/\.dmg$/i]
  else if (ua.includes('linux')) preferred = [/\.AppImage$/i, /\.deb$/i]
  else preferred = [/\.AppImage$/i, /setup\.exe$/i, /\.dmg$/i, /\.apk$/i]
  for (const re of preferred) {
    const hit = assets.find((a) => re.test(a.name))
    if (hit) return { url: hit.browser_download_url, name: hit.name }
  }
  return null
}

export function ReleaseBanner() {
  const { state } = useApp()
  const lang = state.lang
  const [release, setRelease] = useState<GhRelease | null>(null)
  const [dismissed, setDismissed] = useState<string | null>(() =>
    localStorage.getItem(DISMISS_KEY),
  )

  useEffect(() => {
    let cancelled = false
    const local =
      typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'
    const fetchRelease = async () => {
      try {
        const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
          headers: { Accept: 'application/vnd.github+json' },
        })
        if (!r.ok) return
        const data = (await r.json()) as GhRelease
        if (cancelled) return
        if (newer(data.tag_name, local)) setRelease(data)
      } catch {
        // Offline / rate-limited — silently ignore; banner just doesn't show.
      }
    }
    void fetchRelease()
    const id = setInterval(fetchRelease, CHECK_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  if (!release) return null
  if (dismissed === release.tag_name) return null

  const asset = pickAsset(release.assets)
  return (
    <div
      className="fixed left-0 right-0 z-[80] mx-auto flex max-w-md flex-col gap-2 rounded-2xl border-2 border-ink bg-paper p-3 shadow-[0_4px_0_0_var(--ink)]"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 4.5rem)',
        marginInline: '12px',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider text-muted">
            {t('release.available', lang)}
          </div>
          <div className="truncate text-base font-black">
            docot {release.tag_name}
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, release.tag_name)
            setDismissed(release.tag_name)
          }}
          className="row-press shrink-0 rounded-full border-2 border-ink px-2 py-1 text-xs font-bold"
        >
          ✕
        </button>
      </div>
      <div className="flex gap-2">
        {asset && (
          <a
            href={asset.url}
            target="_blank"
            rel="noopener noreferrer"
            className="bw-btn-primary flex-1 text-sm"
          >
            {t('release.install', lang)}
          </a>
        )}
        <a
          href={release.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="bw-btn-ghost flex-1 text-sm"
        >
          {t('release.notes', lang)}
        </a>
      </div>
    </div>
  )
}
