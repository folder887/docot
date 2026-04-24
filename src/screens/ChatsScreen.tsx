import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../store'
import { relTime, t } from '../i18n'
import { Avatar } from '../components/Avatar'
import { IconPin, IconPlus } from '../components/Icons'
import type { Chat } from '../types'

const FOLDERS = [
  { id: 'all', labelKey: 'chats.all' },
  { id: 'groups', labelKey: 'chats.groups' },
  { id: 'work', labelKey: 'chats.work' },
  { id: 'bots', labelKey: 'chats.bots' },
]

function filterChats(chats: Chat[], folder: string, query: string) {
  const q = query.trim().toLowerCase()
  return chats.filter((c) => {
    if (folder === 'groups' && c.kind !== 'group' && c.kind !== 'channel') return false
    if (folder === 'work' && !/work|design|launch|team|nomad|bit/i.test(c.title)) return false
    if (folder === 'bots' && !/bot/i.test(c.title)) return false
    if (!q) return true
    return (
      c.title.toLowerCase().includes(q) ||
      c.messages.some((m) => m.text.toLowerCase().includes(q))
    )
  })
}

export function ChatsScreen() {
  const { state, addChat } = useApp()
  const [folder, setFolder] = useState('all')
  const [query, setQuery] = useState('')

  const visible = useMemo(() => filterChats(state.chats, folder, query), [state.chats, folder, query])

  const pinned = visible.filter((c) => c.pinned)
  const rest = visible.filter((c) => !c.pinned)

  return (
    <div className="flex flex-col bg-white">
      <div className="sticky top-[57px] z-[5] border-b-2 border-black bg-white">
        <div className="px-3 pt-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('top.search', state.lang)}
            className="bw-input py-2 text-sm"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto px-3 py-3">
          {FOLDERS.map((f) => {
            const active = folder === f.id
            return (
              <button
                key={f.id}
                onClick={() => setFolder(f.id)}
                className={`flex-shrink-0 rounded-full border-2 border-black px-4 py-1 text-sm font-bold ${
                  active ? 'bg-black text-white' : 'bg-white text-black'
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
        <p className="p-6 text-center text-sm text-black/60">{t('chats.empty', state.lang)}</p>
      ) : (
        <ul>
          {rest.map((c) => (
            <ChatRow key={c.id} chat={c} lang={state.lang} />
          ))}
        </ul>
      )}

      <button
        aria-label={t('chats.new', state.lang)}
        onClick={() => {
          const title = window.prompt(t('chats.new', state.lang))
          if (title) addChat(title)
        }}
        className="fixed bottom-24 right-[calc(50%-220px+16px)] z-20 flex h-14 w-14 items-center justify-center rounded-full border-2 border-black bg-black text-white md:right-[calc(50%-220px+16px)]"
        style={{ right: 'max(16px, calc(50vw - 204px))' }}
      >
        <IconPlus size={26} />
      </button>
    </div>
  )
}

function ChatRow({ chat, lang }: { chat: Chat; lang: 'en' | 'ru' }) {
  const last = chat.messages[chat.messages.length - 1]
  return (
    <li className="border-b border-black/15">
      <Link to={`/chats/${chat.id}`} className="flex gap-3 px-4 py-3 hover:bg-black hover:text-white">
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
