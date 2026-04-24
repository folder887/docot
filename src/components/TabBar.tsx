import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { IconCalendar, IconChat, IconMenu, IconNews, IconNote } from './Icons'
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
    <nav className="sticky bottom-0 z-10 border-t-2 border-black bg-white">
      <ul className="grid grid-cols-5">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <li key={tab.to} className="flex">
              <NavLink
                to={tab.to}
                className={({ isActive }) =>
                  `flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-bold uppercase tracking-wide ${
                    isActive ? 'bg-black text-white' : 'text-black'
                  }`
                }
                aria-label={t(tab.labelKey, state.lang)}
              >
                <Icon size={22} />
                <span>{t(tab.labelKey, state.lang)}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
