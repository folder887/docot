import { Link } from 'react-router-dom'
import { useApp } from '../store'
import { t } from '../i18n'
import { Avatar } from '../components/Avatar'

export function MenuScreen() {
  const { state } = useApp()
  const me = state.me
  const items = [
    { to: me ? `/profile/${me.id}` : '/settings', label: t('settings.myAccount', state.lang) },
    { to: '/settings/edit-profile', label: t('settings.editProfile', state.lang) },
    { to: '/settings', label: t('menu.settings', state.lang) },
  ]
  return (
    <div className="flex flex-col bg-paper text-ink">
      <section className="flex items-center gap-4 border-b-2 border-ink p-5">
        <Avatar name={me?.name ?? '?'} size={64} src={me?.avatarUrl} />
        <div className="flex-1">
          <div className="text-lg font-black">{me?.name ?? '—'}</div>
          <div className="text-sm text-muted">{me?.handle ? `@${me.handle}` : ''}</div>
          {me?.bio && <div className="mt-1 line-clamp-2 text-xs text-muted">{me.bio}</div>}
        </div>
      </section>
      <ul>
        {items.map((it) => (
          <li key={it.to} className="border-b border-line">
            <Link
              to={it.to}
              className="flex items-center justify-between px-5 py-4 font-bold hover:bg-ink hover:text-paper"
            >
              <span>{it.label}</span>
              <span aria-hidden>›</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="px-5 py-6 text-xs uppercase tracking-[0.3em] text-muted">
        docot · all in one · v1.0
      </p>
    </div>
  )
}
