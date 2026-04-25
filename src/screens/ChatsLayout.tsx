import { Outlet, useMatch } from 'react-router-dom'
import { ChatsScreen } from './ChatsScreen'
import { Logo } from '../components/Logo'
import { useApp } from '../store'
import { t } from '../i18n'

export function ChatsLayout() {
  const detailMatch = useMatch('/chats/:id')
  const onDetail = !!detailMatch
  const { state } = useApp()

  return (
    <div className="chats-layout flex flex-1 min-h-0" data-detail={onDetail ? 'true' : 'false'}>
      <aside className="chats-list-pane flex flex-col min-h-0 min-w-0">
        <ChatsScreen />
      </aside>
      <section className="chats-detail-pane flex flex-1 min-h-0 min-w-0 flex-col">
        {onDetail ? (
          <Outlet />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-paper text-center text-muted">
            <Logo size={56} className="opacity-25" />
            <p className="text-sm">{t('chats.empty.detail', state.lang)}</p>
          </div>
        )}
      </section>
    </div>
  )
}
