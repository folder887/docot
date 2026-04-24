import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../store'
import { t } from '../i18n'
import { ScreenHeader } from '../components/ScreenHeader'
import { Avatar } from '../components/Avatar'
import {
  IconBattery,
  IconBell,
  IconChevron,
  IconFolder,
  IconLock,
  IconPalette,
  IconQR,
  IconSliders,
  IconSpeaker,
  IconUser,
} from '../components/Icons'

type Row = {
  to: string
  labelKey: string
  icon: React.ReactNode
}

const SECTIONS: Row[] = [
  { to: '/profile/me', labelKey: 'settings.myAccount', icon: <IconUser size={20} /> },
  { to: '/settings/notifications', labelKey: 'settings.notifications', icon: <IconBell size={20} /> },
  { to: '/settings/privacy', labelKey: 'settings.privacy', icon: <IconLock size={20} /> },
  { to: '/settings/chat', labelKey: 'settings.chatSettings', icon: <IconPalette size={20} /> },
  { to: '/settings/folders', labelKey: 'settings.folders', icon: <IconFolder size={20} /> },
  { to: '/settings/advanced', labelKey: 'settings.advanced', icon: <IconSliders size={20} /> },
  { to: '/settings/speakers', labelKey: 'settings.speakers', icon: <IconSpeaker size={20} /> },
  { to: '/settings/battery', labelKey: 'settings.battery', icon: <IconBattery size={20} /> },
]

export function SettingsScreen() {
  const { state, logout } = useApp()
  const navigate = useNavigate()

  return (
    <div className="flex min-h-0 flex-col bg-paper">
      <ScreenHeader title={t('settings.title', state.lang)} />

      <Link
        to="/profile/me"
        className="row-press mx-4 mt-2 flex items-center gap-3 rounded-2xl border-2 border-ink bg-paper p-3"
      >
        <Avatar name={state.me.name} size={56} filled />
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-black italic">{state.me.name}</div>
          <div className="truncate text-sm text-muted">{state.me.handle}</div>
        </div>
        <button
          aria-label="QR"
          className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink"
          onClick={(e) => {
            e.preventDefault()
            window.alert(state.me.handle)
          }}
        >
          <IconQR size={16} />
        </button>
      </Link>

      <ul className="mt-4 flex flex-col gap-0 border-y border-line bg-paper">
        {SECTIONS.map((row) => (
          <li key={row.to}>
            <Link
              to={row.to}
              className="row-press flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-ink">
                {row.icon}
              </span>
              <span className="flex-1 text-[15px] font-bold">{t(row.labelKey, state.lang)}</span>
              <IconChevron size={16} />
            </Link>
          </li>
        ))}
      </ul>

      <div className="mx-4 mt-6 flex flex-col gap-3">
        <button
          className="bw-btn-ghost"
          onClick={() => {
            logout()
            navigate('/welcome', { replace: true })
          }}
        >
          {t('settings.logout', state.lang)}
        </button>
        <div className="text-center text-xs text-muted">
          {t('settings.version', state.lang)} 0.1.0
        </div>
      </div>
      <div className="h-10" />
    </div>
  )
}
