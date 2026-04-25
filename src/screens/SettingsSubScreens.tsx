import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../store'
import { t } from '../i18n'
import type { Theme, Wallpaper } from '../types'
import { ScreenHeader } from '../components/ScreenHeader'
import { QRCode } from '../components/QRCode'

export function SettingsSubScreen() {
  const { section } = useParams<{ section: string }>()
  const { state } = useApp()
  const lang = state.lang
  switch (section) {
    case 'notifications':
      return <Section title={t('settings.notifications', lang)}><NotificationsSection /></Section>
    case 'privacy':
      return <Section title={t('settings.privacy', lang)}><PrivacySection /></Section>
    case 'chat':
      return <Section title={t('settings.chatSettings', lang)}><ChatSection /></Section>
    case 'folders':
      return <Section title={t('settings.folders', lang)}><FoldersSection /></Section>
    case 'advanced':
      return <Section title={t('settings.advanced', lang)}><AdvancedSection /></Section>
    case 'storage':
      return <Section title={t('settings.storage', lang)}><StorageSection /></Section>
    case 'devices':
      return <Section title={t('settings.devices', lang)}><DevicesSection /></Section>
    case 'battery':
      return <Section title={t('settings.battery', lang)}><BatterySection /></Section>
    default:
      return <Section title="Settings"><div className="p-6 text-muted">Unknown section.</div></Section>
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-col bg-paper">
      <ScreenHeader title={title} />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint?: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="row-press flex w-full items-center justify-between border-b border-line px-4 py-3 text-left"
    >
      <div className="min-w-0 flex-1 pr-4">
        <div className="font-bold">{label}</div>
        {hint && <div className="text-xs text-muted">{hint}</div>}
      </div>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full border-2 border-ink transition-colors ${value ? 'bg-ink' : 'bg-paper'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full border-2 border-ink transition-all ${value ? 'left-[22px] bg-paper' : 'left-0.5 bg-ink'}`}
        />
      </span>
    </button>
  )
}

function Radio({
  label,
  value,
  selected,
  onSelect,
  preview,
}: {
  label: string
  value: string
  selected: boolean
  onSelect: (v: string) => void
  preview?: React.ReactNode
}) {
  return (
    <button
      onClick={() => onSelect(value)}
      className="row-press flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left"
    >
      {preview && <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border-2 border-ink">{preview}</span>}
      <span className="flex-1 font-bold">{label}</span>
      <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink ${selected ? 'bg-ink text-paper' : 'bg-paper'}`}>
        {selected && <span className="block h-2.5 w-2.5 rounded-full bg-paper" />}
      </span>
    </button>
  )
}

function SectionHeader({ text }: { text: string }) {
  return <div className="px-4 pb-1 pt-5 text-[11px] font-black uppercase tracking-[0.2em] text-muted">{text}</div>
}

/* ------------ NOTIFICATIONS ------------ */
function NotificationsSection() {
  const { state, setPrefs } = useApp()
  const lang = state.lang
  return (
    <div>
      <SectionHeader text={t('settings.notifications', lang)} />
      <Toggle label={t('settings.sounds', lang)} value={state.prefs.sounds} onChange={(v) => setPrefs({ sounds: v })} />
      <Toggle label={t('settings.muteAll', lang)} value={state.prefs.muteAll} onChange={(v) => setPrefs({ muteAll: v })} />
    </div>
  )
}

/* ------------ PRIVACY ------------ */
function PrivacySection() {
  const { state, setPrefs } = useApp()
  const lang = state.lang
  return (
    <div>
      <SectionHeader text={t('settings.privacy', lang)} />
      <Toggle
        label={t('settings.lastSeen', lang)}
        hint={lang === 'ru' ? 'Показывать другим время вашего последнего захода' : 'Show last-seen time to others'}
        value={state.prefs.lastSeen}
        onChange={(v) => setPrefs({ lastSeen: v })}
      />
      <Toggle
        label={t('settings.readReceipts', lang)}
        hint={lang === 'ru' ? 'Отправлять отчёт о прочтении в DM' : 'Send read receipts in DMs'}
        value={state.prefs.readReceipts}
        onChange={(v) => setPrefs({ readReceipts: v })}
      />
      <PasscodeRow />
    </div>
  )
}

function PasscodeRow() {
  const { state, setPasscode, clearPasscode } = useApp()
  const lang = state.lang
  const [open, setOpen] = useState(false)
  const [pin, setPin] = useState('')
  const enabled = !!state.prefs.passcode
  return (
    <>
      <button
        onClick={() => {
          if (enabled) {
            clearPasscode()
          } else {
            setOpen(true)
          }
        }}
        className="row-press flex w-full items-center justify-between border-b border-line px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1 pr-4">
          <div className="font-bold">{t('settings.passcode', lang)}</div>
          <div className="text-xs text-muted">
            {lang === 'ru'
              ? 'Локальный 4-значный PIN при открытии'
              : 'Local 4-digit PIN on app open'}
          </div>
        </div>
        <span
          className={`relative h-7 w-12 shrink-0 rounded-full border-2 border-ink transition-colors ${enabled ? 'bg-ink' : 'bg-paper'}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full border-2 border-ink transition-all ${enabled ? 'left-[22px] bg-paper' : 'left-0.5 bg-ink'}`}
          />
        </span>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs rounded-3xl border-2 border-ink bg-paper p-5"
          >
            <div className="mb-3 text-center text-base font-black uppercase tracking-wide">
              {t('settings.passcode', lang)}
            </div>
            <input
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric"
              maxLength={4}
              placeholder="••••"
              className="bw-input mb-4 text-center text-2xl tracking-[0.6em]"
            />
            <div className="flex gap-3">
              <button className="bw-btn-ghost flex-1" onClick={() => setOpen(false)}>
                {t('common.cancel', lang)}
              </button>
              <button
                disabled={pin.length !== 4}
                className="bw-btn-primary flex-1 disabled:opacity-50"
                onClick={() => {
                  setPasscode(pin)
                  setPin('')
                  setOpen(false)
                }}
              >
                {t('common.save', lang)}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ------------ CHAT SETTINGS (theme + wallpaper + compact) ------------ */
const THEMES: { value: Theme; labelKey: string }[] = [
  { value: 'light', labelKey: 'settings.theme.light' },
  { value: 'dark', labelKey: 'settings.theme.dark' },
  { value: 'paper', labelKey: 'settings.theme.paper' },
  { value: 'inverse', labelKey: 'settings.theme.inverse' },
]

const WALLPAPERS: { value: Wallpaper; labelKey: string; preview: React.CSSProperties }[] = [
  { value: 'none', labelKey: 'settings.wallpaper.none', preview: { background: 'var(--paper)' } },
  { value: 'dots', labelKey: 'settings.wallpaper.dots', preview: { backgroundImage: 'radial-gradient(var(--ink) 1px, transparent 1.4px)', backgroundSize: '6px 6px' } },
  { value: 'grid', labelKey: 'settings.wallpaper.grid', preview: { backgroundImage: 'linear-gradient(to right, var(--ink) 1px, transparent 1px), linear-gradient(to bottom, var(--ink) 1px, transparent 1px)', backgroundSize: '8px 8px' } },
  { value: 'lines', labelKey: 'settings.wallpaper.lines', preview: { backgroundImage: 'repeating-linear-gradient(45deg, var(--ink) 0 1px, transparent 1px 5px)' } },
  { value: 'waves', labelKey: 'settings.wallpaper.waves', preview: { backgroundImage: 'radial-gradient(circle at 30% 30%, var(--ink) 0 1.5px, transparent 1.5px 10px), radial-gradient(circle at 70% 70%, var(--ink) 0 1.5px, transparent 1.5px 10px)' } },
  { value: 'noise', labelKey: 'settings.wallpaper.noise', preview: { backgroundImage: 'repeating-radial-gradient(circle at 0 0, var(--ink) 0 0.5px, transparent 0.5px 3px)' } },
  { value: 'ink', labelKey: 'settings.wallpaper.ink', preview: { backgroundImage: 'radial-gradient(ellipse at 30% 40%, var(--ink) 0 2px, transparent 2px 20px), radial-gradient(ellipse at 70% 60%, var(--ink) 0 2px, transparent 2px 20px)' } },
]

function ChatSection() {
  const { state, setPrefs } = useApp()
  const lang = state.lang
  return (
    <div>
      <SectionHeader text={t('settings.appearance', lang)} />
      {THEMES.map((opt) => (
        <Radio
          key={opt.value}
          label={t(opt.labelKey, lang)}
          value={opt.value}
          selected={state.prefs.theme === opt.value}
          onSelect={(v) => setPrefs({ theme: v as Theme })}
          preview={<ThemePreview value={opt.value} />}
        />
      ))}

      <SectionHeader text={t('settings.wallpaper', lang)} />
      {WALLPAPERS.map((opt) => (
        <Radio
          key={opt.value}
          label={t(opt.labelKey, lang)}
          value={opt.value}
          selected={state.prefs.wallpaper === opt.value}
          onSelect={(v) => setPrefs({ wallpaper: v as Wallpaper })}
          preview={<span className="block h-full w-full" style={opt.preview} />}
        />
      ))}

      <SectionHeader text="Chat list" />
      <Toggle label={t('settings.compact', lang)} value={state.prefs.compactMode} onChange={(v) => setPrefs({ compactMode: v })} />
    </div>
  )
}

function ThemePreview({ value }: { value: Theme }) {
  const map: Record<Theme, { bg: string; fg: string }> = {
    light: { bg: '#fff', fg: '#000' },
    dark: { bg: '#0b0b0b', fg: '#fff' },
    paper: { bg: '#f5f1e8', fg: '#1a1a1a' },
    inverse: { bg: '#000', fg: '#fff' },
  }
  const c = map[value]
  return (
    <span className="flex h-full w-full items-center justify-center" style={{ background: c.bg, color: c.fg }}>
      <span className="italic-display text-sm" style={{ color: c.fg }}>Aa</span>
    </span>
  )
}

/* ------------ FOLDERS ------------ */
function FoldersSection() {
  const { state } = useApp()
  const lang = state.lang
  const builtIn: Array<{ key: string; en: string; ru: string }> = [
    { key: 'all', en: 'All', ru: 'Все' },
    { key: 'groups', en: 'Groups', ru: 'Группы' },
    { key: 'bots', en: 'Bots', ru: 'Боты' },
  ]
  return (
    <div className="p-4">
      <p className="text-sm text-muted">
        {lang === 'ru'
          ? 'Папки можно создавать и менять прямо из списка чатов: жми + → Папки.'
          : 'Folders can be created and edited from the chat list: tap + → Folders.'}
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {builtIn.map((f) => (
          <div
            key={f.key}
            className="flex items-center justify-between rounded-2xl border-2 border-ink px-4 py-3"
          >
            <div>
              <div className="font-bold">{lang === 'ru' ? f.ru : f.en}</div>
              <div className="text-xs text-muted">
                {lang === 'ru' ? 'Встроенный фильтр' : 'Built-in filter'}
              </div>
            </div>
          </div>
        ))}
        {state.folders.map((f) => (
          <div
            key={f.id}
            className="flex items-center justify-between rounded-2xl border-2 border-ink px-4 py-3"
          >
            <div>
              <div className="font-bold">{f.name}</div>
              <div className="text-xs text-muted">
                {f.chatIds.length}{' '}
                {lang === 'ru' ? 'чата(ов)' : 'chats'}
              </div>
            </div>
            <span className="text-xs font-bold uppercase tracking-wide text-muted">
              {lang === 'ru' ? 'свой' : 'custom'}
            </span>
          </div>
        ))}
        {state.folders.length === 0 && (
          <p className="text-xs text-muted">
            {lang === 'ru' ? 'Своих папок пока нет.' : 'No custom folders yet.'}
          </p>
        )}
      </div>
    </div>
  )
}

/* ------------ ADVANCED ------------ */
function AdvancedSection() {
  const { state } = useApp()
  const lang = state.lang
  return (
    <div>
      <SectionHeader text={t('settings.language', lang)} />
      <div className="flex gap-2 p-4">
        {(['en', 'ru'] as const).map((code) => (
          <LangButton key={code} code={code} />
        ))}
      </div>
    </div>
  )
}

function LangButton({ code }: { code: 'en' | 'ru' }) {
  const { state, setLang } = useApp()
  return (
    <button
      onClick={() => setLang(code)}
      className={`flex-1 rounded-full border-2 border-ink px-4 py-2 font-bold transition-colors ${state.lang === code ? 'bg-ink text-paper' : 'bg-paper text-ink'}`}
    >
      {code.toUpperCase()}
    </button>
  )
}

/* ------------ STORAGE ------------ */
function StorageSection() {
  const { state } = useApp()
  const lang = state.lang
  const [used, setUsed] = useState<number | null>(null)
  const [quota, setQuota] = useState<number | null>(null)
  const [breakdown, setBreakdown] = useState<{ idb: number; cache: number; ls: number }>({ idb: 0, cache: 0, ls: 0 })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const refresh = () => {
    void (async () => {
      try {
        const est = await navigator.storage?.estimate?.()
        if (est) {
          setUsed(est.usage ?? null)
          setQuota(est.quota ?? null)
        }
        let lsBytes = 0
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)
          if (!k) continue
          const v = localStorage.getItem(k) ?? ''
          lsBytes += k.length + v.length
        }
        let cacheBytes = 0
        try {
          const names = await caches.keys()
          for (const n of names) {
            const c = await caches.open(n)
            const reqs = await c.keys()
            for (const r of reqs) {
              const res = await c.match(r)
              const blob = res ? await res.blob() : null
              cacheBytes += blob?.size ?? 0
            }
          }
        } catch {
          /* ignore */
        }
        const idbBytes = Math.max(0, (est?.usage ?? 0) - cacheBytes - lsBytes)
        setBreakdown({ idb: idbBytes, cache: cacheBytes, ls: lsBytes })
      } catch {
        /* ignore */
      }
    })()
  }

  useEffect(() => {
    refresh()
  }, [])

  const fmt = (n: number | null) => {
    if (n === null) return '—'
    if (n < 1024) return `${n} B`
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
    if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
    return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
  }

  const clearCache = async () => {
    setBusy(true)
    try {
      const names = await caches.keys()
      await Promise.all(names.map((n) => caches.delete(n)))
      setMsg(lang === 'ru' ? 'Кэш очищен' : 'Cache cleared')
    } finally {
      setBusy(false)
      refresh()
      setTimeout(() => setMsg(null), 2500)
    }
  }

  const clearLocalCaches = () => {
    setBusy(true)
    try {
      // Don't delete auth token, prefs, lang or passcode hashes.
      const keep = new Set([
        'docot.token',
        'docot.prefs',
        'docot.lang',
        'docot.passcode.hash',
        'docot.passcode.salt',
      ])
      const toRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && !keep.has(k)) toRemove.push(k)
      }
      toRemove.forEach((k) => localStorage.removeItem(k))
      setMsg(lang === 'ru' ? 'Локальное хранилище очищено' : 'Local storage cleared')
    } finally {
      setBusy(false)
      refresh()
      setTimeout(() => setMsg(null), 2500)
    }
  }

  const clearE2E = async () => {
    setBusy(true)
    try {
      const dbs = await (indexedDB as unknown as { databases?: () => Promise<{ name?: string }[]> }).databases?.()
      const names = dbs?.map((d) => d.name).filter((n): n is string => !!n) ?? ['keyval-store']
      await Promise.all(
        names.map(
          (n) =>
            new Promise<void>((resolve) => {
              const req = indexedDB.deleteDatabase(n)
              req.onsuccess = () => resolve()
              req.onerror = () => resolve()
              req.onblocked = () => resolve()
            }),
        ),
      )
      setMsg(lang === 'ru' ? 'E2E ключи и сессии удалены — перезайдите' : 'E2E keys & sessions wiped — sign in again')
    } finally {
      setBusy(false)
      refresh()
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="rounded-2xl border-2 border-ink p-4">
        <div className="text-xs uppercase tracking-wide text-muted">
          {lang === 'ru' ? 'Использовано' : 'Used'}
        </div>
        <div className="mt-1 text-2xl font-black">{fmt(used)}</div>
        <div className="mt-1 text-xs text-muted">
          {lang === 'ru' ? 'из' : 'of'} {fmt(quota)}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-xl border border-line p-2">
            <div className="text-muted">IndexedDB</div>
            <div className="font-bold">{fmt(breakdown.idb)}</div>
          </div>
          <div className="rounded-xl border border-line p-2">
            <div className="text-muted">{lang === 'ru' ? 'Кэш' : 'Cache'}</div>
            <div className="font-bold">{fmt(breakdown.cache)}</div>
          </div>
          <div className="rounded-xl border border-line p-2">
            <div className="text-muted">localStorage</div>
            <div className="font-bold">{fmt(breakdown.ls)}</div>
          </div>
        </div>
      </div>

      <button
        disabled={busy}
        className="bw-btn-ghost w-full"
        onClick={() => void clearCache()}
      >
        {lang === 'ru' ? 'Очистить HTTP-кэш' : 'Clear HTTP cache'}
      </button>
      <button
        disabled={busy}
        className="bw-btn-ghost w-full"
        onClick={clearLocalCaches}
      >
        {lang === 'ru'
          ? 'Очистить локальные данные (кроме входа)'
          : 'Clear local data (keep login)'}
      </button>
      <button
        disabled={busy}
        className="bw-btn-ghost w-full"
        onClick={() => void clearE2E()}
      >
        {lang === 'ru'
          ? 'Сбросить E2E ключи и сессии Signal'
          : 'Reset E2E keys & Signal sessions'}
      </button>
      {msg && (
        <div className="text-center text-sm font-bold text-ink">{msg}</div>
      )}
    </div>
  )
}

/* ------------ DEVICES (active sessions / linked devices) ------------ */
function DevicesSection() {
  const { state } = useApp()
  const lang = state.lang
  const [pairing, setPairing] = useState<{ token: string; expires: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const start = async () => {
    setBusy(true)
    setErr(null)
    try {
      const mod = await import('../api')
      const r = await mod.api.pairStart()
      setPairing(r)
    } catch {
      setErr(lang === 'ru' ? 'Не удалось создать токен' : 'Failed to start pairing')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-4 text-sm">
      <p className="mb-3 text-muted">
        {lang === 'ru'
          ? 'Каждый браузер/инсталл — это отдельное устройство в Signal. Сообщения шифруются для всех ваших устройств.'
          : 'Each browser/install is a separate Signal device. Messages encrypt to all your devices.'}
      </p>
      <DevicesList userId={state.me?.id ?? null} />

      <div className="mt-6 border-t-2 border-ink pt-4">
        <h3 className="mb-2 font-black uppercase tracking-wide">
          {lang === 'ru' ? 'Добавить устройство по QR' : 'Add device by QR'}
        </h3>
        {!pairing ? (
          <>
            <p className="mb-3 text-xs text-muted">
              {lang === 'ru'
                ? 'Откройте Docot на новом устройстве → "Войти по QR" → отсканируйте код. Код активен 90 секунд и работает один раз.'
                : 'Open Docot on the new device → "Sign in with QR" → scan the code. The code lasts 90 s and is single-use.'}
            </p>
            <button disabled={busy} className="bw-btn-primary" onClick={() => void start()}>
              {lang === 'ru' ? 'Показать QR' : 'Show QR'}
            </button>
          </>
        ) : (
          <PairQRDisplay
            token={pairing.token}
            expires={pairing.expires}
            onClose={() => setPairing(null)}
          />
        )}
        {err && <div className="mt-2 text-xs text-red-600">{err}</div>}
      </div>
    </div>
  )
}

function PairQRDisplay({
  token,
  expires,
  onClose,
}: {
  token: string
  expires: number
  onClose: () => void
}) {
  const { state } = useApp()
  const lang = state.lang
  const [now, setNow] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [])
  const remaining = now === 0 ? null : Math.max(0, Math.floor((expires - now) / 1000))
  const expired = remaining !== null && remaining <= 0
  // Use a docot:// URI so a future deep-link handler can claim automatically.
  const payload = `docot://pair?token=${encodeURIComponent(token)}`
  return (
    <div className="flex flex-col items-center gap-3">
      {expired ? (
        <div className="rounded-xl border-2 border-ink bg-paper px-4 py-3 text-center">
          <div className="font-bold">
            {lang === 'ru' ? 'Срок токена истёк' : 'Token expired'}
          </div>
        </div>
      ) : (
        <PairQRCanvas text={payload} />
      )}
      <div className="text-xs text-muted">
        {expired
          ? lang === 'ru'
            ? 'Перезапустите'
            : 'Restart'
          : remaining === null
            ? '…'
            : `${remaining}s ${lang === 'ru' ? 'осталось' : 'left'}`}
      </div>
      <button className="bw-btn-ghost w-full" onClick={onClose}>
        {t('common.close', lang)}
      </button>
    </div>
  )
}

function PairQRCanvas({ text }: { text: string }) {
  return <QRCode text={text} size={220} />
}

function DevicesList({ userId }: { userId: string | null }) {
  const [items, setItems] = useState<{ deviceId: number; registrationId: number; updatedAt: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [myDevice, setMyDevice] = useState<number | null>(null)
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void (async () => {
      try {
        const mod = await import('../api')
        const list = await mod.api.listUserDevices(userId)
        if (!cancelled) setItems(list.devices ?? [])
        try {
          const id = await import('../crypto/identity')
          const did = await id.localDeviceId()
          if (!cancelled) setMyDevice(did ?? null)
        } catch {
          /* ignore */
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])
  if (!userId) return null
  if (loading) return <div className="text-muted">…</div>
  if (items.length === 0) return <div className="text-muted">—</div>
  return (
    <ul className="space-y-2">
      {items.map((d) => (
        <li
          key={d.deviceId}
          className="flex items-center justify-between rounded-2xl border-2 border-ink px-3 py-2"
        >
          <div>
            <div className="font-bold">
              Device #{d.deviceId}
              {myDevice === d.deviceId && (
                <span className="ml-2 rounded border border-ink px-1.5 py-0.5 text-[10px]">this</span>
              )}
            </div>
            <div className="text-[11px] text-muted">
              reg id {d.registrationId} · updated{' '}
              {new Date(d.updatedAt).toLocaleString()}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

/* ------------ BATTERY & ANIMATIONS ------------ */
function BatterySection() {
  const { state, setPrefs } = useApp()
  const lang = state.lang
  return (
    <div>
      <SectionHeader text={t('settings.battery', lang)} />
      <Toggle
        label={t('settings.animations', lang)}
        value={state.prefs.animations}
        onChange={(v) => setPrefs({ animations: v })}
      />
      <Toggle
        label={t('settings.reduceMotion', lang)}
        hint="Disable page transitions and decorative motion"
        value={state.prefs.reduceMotion}
        onChange={(v) => setPrefs({ reduceMotion: v })}
      />
    </div>
  )
}
