import { Link } from 'react-router-dom'
import { useApp } from '../store'
import { t } from '../i18n'
import { Avatar } from '../components/Avatar'

export function MenuScreen() {
  const { state } = useApp()
  const items = [
    { to: '/chats?folder=saved', label: t('menu.saved', state.lang) },
    { to: '/menu/contacts', label: t('menu.contacts', state.lang) },
    { to: '/menu/archive', label: t('menu.archive', state.lang) },
    { to: '/settings', label: t('menu.settings', state.lang) },
    { to: '/menu/about', label: t('menu.about', state.lang) },
  ]
  return (
    <div className="flex flex-col bg-white text-black">
      <section className="flex items-center gap-4 border-b-2 border-black p-5">
        <Avatar name={state.me.name} size={64} />
        <div className="flex-1">
          <div className="text-lg font-black">{state.me.name}</div>
          <div className="text-sm text-black/70">{state.me.handle}</div>
          <div className="mt-1 text-xs text-black/60 line-clamp-2">{state.me.bio}</div>
        </div>
      </section>
      <ul>
        {items.map((it) => (
          <li key={it.to} className="border-b border-black/20">
            <Link
              to={it.to}
              className="flex items-center justify-between px-5 py-4 font-bold hover:bg-black hover:text-white"
            >
              <span>{it.label}</span>
              <span aria-hidden>›</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="px-5 py-6 text-xs uppercase tracking-[0.3em] text-black/50">
        docot · all in one · v0.1
      </p>
    </div>
  )
}
