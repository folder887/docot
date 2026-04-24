import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../store'
import { relTime, t } from '../i18n'
import { Avatar } from '../components/Avatar'
import { IconPin, IconPlus } from '../components/Icons'
import type { Chat, User } from '../types'

const FOLDERS = [
  { id: 'all', labelKey: 'chats.all' },
  { id: 'groups', labelKey: 'chats.groups' },
  { id: 'bots', labelKey: 'chats.bots' },
]

function filterChats(chats: Chat[], folder: string, query: string, userKindOfPeer: (c: Chat) => string) {
  const q = query.trim().toLowerCase()
  return chats.filter((c) => {
    if (folder === 'groups' && c.kind !== 'group' && c.kind !== 'channel') return false
    if (folder === 'bots' && userKindOfPeer(c) !== 'bot') return false
    if (!q) return true
    return (
      c.title.toLowerCase().includes(q) ||
      c.messages.some((m) => m.text.toLowerCase().includes(q))
    )
  })
}

export function ChatsScreen() {
  const { state, peerOf, createChat, searchUsers } = useApp()
  const [folder, setFolder] = useState('all')
  const [query, setQuery] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)

  const userKindOfPeer = (c: Chat) => {
    const peer = peerOf(c)
    return peer?.kind ?? 'user'
  }

  const visible = useMemo(
    () => filterChats(state.chats, folder, query, userKindOfPeer),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.chats, folder, query],
  )
  const pinned = visible.filter((c) => c.pinned)
  const rest = visible.filter((c) => !c.pinned)

  return (
    <div className="relative flex flex-col bg-paper text-ink">
      <div className="sticky top-[57px] z-[5] border-b-2 border-ink bg-paper">
        <div className="flex items-center gap-2 px-3 pt-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('top.search', state.lang)}
            className="bw-input py-2 text-sm"
          />
          <button
            aria-label={t('chats.new', state.lang)}
            onClick={() => setComposerOpen(true)}
            className="flex h-[44px] w-[44px] flex-shrink-0 items-center justify-center rounded-xl border-2 border-ink bg-ink text-paper transition-transform active:scale-95"
          >
            <IconPlus size={20} />
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto px-3 py-3">
          {FOLDERS.map((f) => {
            const active = folder === f.id
            return (
              <button
                key={f.id}
                onClick={() => setFolder(f.id)}
                className={`flex-shrink-0 rounded-full border-2 border-ink px-4 py-1 text-sm font-bold ${
                  active ? 'bg-ink text-paper' : 'bg-paper text-ink'
                }`}
              >
                {t(f.labelKey, state.lang)}
              </button>
            )
          })}
        </div>
      </div>

      {pinned.length > 0 && (
        <ul>
          {pinned.map((c) => (
            <ChatRow key={c.id} chat={c} lang={state.lang} />
          ))}
        </ul>
      )}

      {rest.length === 0 && pinned.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted">{t('empty.chats', state.lang)}</p>
      ) : (
        <ul>
          {rest.map((c) => (
            <ChatRow key={c.id} chat={c} lang={state.lang} />
          ))}
        </ul>
      )}

      {composerOpen && (
        <NewChatSheet
          onClose={() => setComposerOpen(false)}
          onPick={async (peer) => {
            setComposerOpen(false)
            const id = await createChat([peer.id], 'dm')
            return id
          }}
          search={searchUsers}
        />
      )}
    </div>
  )
}

function NewChatSheet({
  onClose,
  onPick,
  search,
}: {
  onClose: () => void
  onPick: (u: User) => Promise<string>
  search: (q: string) => Promise<User[]>
}) {
  const { state } = useApp()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<User[]>([])
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (q.trim().length < 1) {
      const h = window.setTimeout(() => setResults([]), 0)
      return () => window.clearTimeout(h)
    }
    const handle = window.setTimeout(() => {
      setBusy(true)
      search(q)
        .then((list) => setResults(list))
        .finally(() => setBusy(false))
    }, 200)
    return () => window.clearTimeout(handle)
  }, [q, search])

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/40" onClick={onClose}>
      <div
        className="sheet-in w-full max-w-[440px] rounded-t-2xl border-t-2 border-ink bg-paper p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <h2 className="italic-display flex-1 text-xl">{t('common.newChat', state.lang)}</h2>
          <button
            onClick={onClose}
            className="rounded-full border-2 border-ink px-3 py-1 text-xs font-bold"
          >
            {t('common.cancel', state.lang)}
          </button>
        </div>
        <input
          autoFocus
          className="bw-input w-full text-sm normal-case"
          placeholder={t('chats.findUser', state.lang)}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="mt-3 max-h-[50vh] overflow-y-auto">
          {busy && <div className="py-3 text-center text-xs text-muted">{t('common.loading', state.lang)}</div>}
          {!busy && q && results.length === 0 && (
            <div className="py-3 text-center text-xs text-muted">{t('chats.noResults', state.lang)}</div>
          )}
          {results.map((u) => (
            <button
              key={u.id}
              onClick={async () => {
                const id = await onPick(u)
                navigate(`/chats/${id}`)
              }}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-ink/5"
            >
              <Avatar name={u.name} size={44} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{u.name}</div>
                <div className="truncate text-xs text-muted">{u.handle}</div>
              </div>
              <span className="rounded-full border-2 border-ink px-3 py-1 text-xs font-bold">
                {t('chats.start', state.lang)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ChatRow({ chat, lang }: { chat: Chat; lang: 'en' | 'ru' }) {
  const last = chat.lastMessage ?? chat.messages[chat.messages.length - 1]
  return (
    <li className="border-b border-ink/15">
      <Link to={`/chats/${chat.id}`} className="flex gap-3 px-4 py-3 hover:bg-ink hover:text-paper">
        <Avatar name={chat.title} size={48} filled={chat.kind === 'channel'} />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            <div className="flex-1 truncate font-bold">{chat.title}</div>
            {chat.pinned && <IconPin size={14} />}
            {last && <div className="text-xs opacity-70">{relTime(last.at, lang)}</div>}
          </div>
          <div className="flex items-center gap-2 text-sm opacity-80">
            {chat.kind !== 'dm' && (
              <span className="bw-chip !border !border-current !bg-transparent !px-1.5 !py-0 text-[10px]">
                {chat.kind}
              </span>
            )}
            <span className="truncate">{last?.text ?? ' '}</span>
          </div>
        </div>
      </Link>
    </li>
  )
}
