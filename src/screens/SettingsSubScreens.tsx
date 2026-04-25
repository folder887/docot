import { useParams } from 'react-router-dom'
import { useApp } from '../store'
import { t } from '../i18n'
import type { Theme, Wallpaper } from '../types'
import { ScreenHeader } from '../components/ScreenHeader'

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
    case 'speakers':
      return <Section title={t('settings.speakers', lang)}><SpeakersSection /></Section>
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
      <Toggle label={t('settings.lastSeen', lang)} value={state.prefs.lastSeen} onChange={(v) => setPrefs({ lastSeen: v })} />
      <Toggle label={t('settings.readReceipts', lang)} value={state.prefs.readReceipts} onChange={(v) => setPrefs({ readReceipts: v })} />
      <Toggle label={t('settings.twoStep', lang)} value={state.prefs.twoStep} onChange={(v) => setPrefs({ twoStep: v })} />
      <Toggle label={t('settings.passcode', lang)} value={state.prefs.passcode} onChange={(v) => setPrefs({ passcode: v })} />
    </div>
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

/* ------------ SPEAKERS ------------ */
function SpeakersSection() {
  return (
    <div className="p-4 text-sm text-muted">
      Voice and video settings are not available in this demo build. Docot works fully offline and
      does not capture any audio/video.
    </div>
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
