import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { IconCalendar, IconChat, IconMenu, IconNews, IconNote, IconSettings } from './Icons'
import { Logo } from './Logo'
import { useApp } from '../store'
import { t } from '../i18n'

type Tab = {
  to: string
  labelKey: string
  icon: (p: { size?: number; className?: string }) => ReactNode
}

const TABS: Tab[] = [
  { to: '/menu', labelKey: 'tabs.menu', icon: IconMenu },
  { to: '/chats', labelKey: 'tabs.chats', icon: IconChat },
  { to: '/calendar', labelKey: 'tabs.calendar', icon: IconCalendar },
  { to: '/notes', labelKey: 'tabs.notes', icon: IconNote },
  { to: '/news', labelKey: 'tabs.news', icon: IconNews },
]

export function TabBar() {
  const { state } = useApp()
  return (
    <nav className="tabbar-bottom sticky bottom-0 z-10 border-t-2 border-ink bg-paper">
      <ul className="grid grid-cols-5">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <li key={tab.to} className="flex">
              <NavLink
                to={tab.to}
                className={({ isActive }) =>
                  `ripple relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-bold uppercase tracking-wide transition-colors duration-200 ${
                    isActive ? 'bg-ink text-paper' : 'text-ink'
                  }`
                }
                aria-label={t(tab.labelKey, state.lang)}
              >
                {({ isActive }) => (
                  <>
                    <span className={isActive ? 'tab-active' : ''} style={{ transition: 'transform 200ms var(--ease)' }}>
                      <Icon size={22} />
                    </span>
                    <span>{t(tab.labelKey, state.lang)}</span>
                  </>
                )}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function DesktopSidebar() {
  const { state } = useApp()
  return (
    <aside className="desktop-sidebar">
      <Link
        to="/menu"
        className="flex items-center gap-3 border-b-2 border-ink px-5 py-4"
      >
        <Logo size={32} />
        <span className="italic-display text-xl">docot</span>
      </Link>
      <nav className="flex-1 overflow-y-auto py-2">
        <ul className="flex flex-col">
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <li key={tab.to}>
                <NavLink
                  to={tab.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-5 py-3 text-sm font-bold uppercase tracking-wide transition-colors ${
                      isActive ? 'bg-ink text-paper' : 'text-ink hover:bg-ink/10'
                    }`
                  }
                >
                  <Icon size={20} />
                  <span>{t(tab.labelKey, state.lang)}</span>
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>
      <NavLink
        to="/settings"
        className={({ isActive }) =>
          `flex items-center gap-3 border-t-2 border-ink px-5 py-3 text-sm font-bold uppercase tracking-wide ${
            isActive ? 'bg-ink text-paper' : 'text-ink hover:bg-ink/10'
          }`
        }
      >
        <IconSettings size={20} />
        <span>{t('settings.title', state.lang)}</span>
      </NavLink>
    </aside>
  )
}
