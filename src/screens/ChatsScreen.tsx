import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../store'
import { relTime, t } from '../i18n'
import { Avatar } from '../components/Avatar'
import { IconChat, IconChannel, IconFolder, IconPin, IconPlus, IconUser } from '../components/Icons'
import { Modal, PromptDialog, ConfirmDialog } from '../components/Modal'
import type { Chat, ChatFolder as ChatFolderT, User } from '../types'

const SYSTEM_FOLDERS = [
  { id: 'all', labelKey: 'chats.all' },
  { id: 'groups', labelKey: 'chats.groups' },
  { id: 'bots', labelKey: 'chats.bots' },
] as const

function applySystemFolder(
  chats: Chat[],
  folder: string,
  customFolders: ChatFolderT[],
  userKindOfPeer: (c: Chat) => string,
): Chat[] {
  if (folder === 'all') return chats
  if (folder === 'groups') return chats.filter((c) => c.kind === 'group' || c.kind === 'channel')
  if (folder === 'bots') return chats.filter((c) => userKindOfPeer(c) === 'bot')
  const f = customFolders.find((x) => x.id === folder)
  if (!f) return chats
  const set = new Set(f.chatIds)
  return chats.filter((c) => set.has(c.id))
}

export function ChatsScreen() {
  const { state, peerOf, createChat, searchUsers } = useApp()
  const navigate = useNavigate()
  const [folder, setFolder] = useState('all')
  const [query, setQuery] = useState('')
  const [plusOpen, setPlusOpen] = useState(false)
  const [newChatOpen, setNewChatOpen] = useState(false)
  const [newGroupOpen, setNewGroupOpen] = useState(false)
  const [newGroupKind, setNewGroupKind] = useState<'group' | 'channel'>('group')
  const [newBotOpen, setNewBotOpen] = useState(false)
  const [foldersOpen, setFoldersOpen] = useState(false)
  const [globalResults, setGlobalResults] = useState<User[]>([])
  const [searching, setSearching] = useState(false)

  const userKindOfPeer = (c: Chat) => peerOf(c)?.kind ?? 'user'

  // Global search: show results for any non-empty query
  useEffect(() => {
    const q = query.trim()
    if (q.length < 1) {
      const reset = window.setTimeout(() => setGlobalResults([]), 0)
      return () => window.clearTimeout(reset)
    }
    const startSearch = window.setTimeout(() => setSearching(true), 0)
    const h = window.setTimeout(() => {
      void searchUsers(q)
        .then((users) => {
          const meId = state.me?.id
          setGlobalResults(users.filter((u) => u.id !== meId))
        })
        .finally(() => setSearching(false))
    }, 200)
    return () => {
      window.clearTimeout(startSearch)
      window.clearTimeout(h)
    }
  }, [query, searchUsers, state.me?.id])

  const visible = useMemo(() => {
    const filtered = applySystemFolder(state.chats, folder, state.folders, userKindOfPeer)
    const q = query.trim().toLowerCase()
    if (!q) return filtered
    return filtered.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some((m) => m.text.toLowerCase().includes(q)),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.chats, state.folders, folder, query])

  const pinned = visible.filter((c) => c.pinned)
  const rest = visible.filter((c) => !c.pinned)

  const onPickUser = async (u: User) => {
    const existing = state.chats.find(
      (c) => c.kind === 'dm' && c.participants.includes(u.id),
    )
    if (existing) {
      navigate(`/chats/${existing.id}`)
    } else {
      const id = await createChat([u.id], 'dm')
      navigate(`/chats/${id}`)
    }
  }

  return (
    <div className="relative flex flex-col bg-paper text-ink">
      <div className="sticky top-[57px] z-[5] border-b-2 border-ink bg-paper">
        <div className="flex items-center gap-2 px-3 pt-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('chats.search.global', state.lang)}
            className="bw-input py-2 text-sm"
          />
          <button
            aria-label={t('chats.new', state.lang)}
            onClick={() => setPlusOpen((v) => !v)}
            className="flex h-[44px] w-[44px] flex-shrink-0 items-center justify-center rounded-xl border-2 border-ink bg-ink text-paper transition-transform active:scale-95"
          >
            <IconPlus size={20} />
          </button>
          {plusOpen && (
            <PlusMenu
              onClose={() => setPlusOpen(false)}
              items={[
                {
                  label: t('chats.newChat', state.lang),
                  icon: <IconChat size={18} />,
                  onClick: () => setNewChatOpen(true),
                },
                {
                  label: t('chats.newGroup', state.lang),
                  icon: <IconUser size={18} />,
                  onClick: () => {
                    setNewGroupKind('group')
                    setNewGroupOpen(true)
                  },
                },
                {
                  label: t('chats.newChannel', state.lang),
                  icon: <IconChannel size={18} />,
                  onClick: () => {
                    setNewGroupKind('channel')
                    setNewGroupOpen(true)
                  },
                },
                {
                  label: t('chats.newBot', state.lang),
                  icon: <IconChat size={18} />,
                  onClick: () => setNewBotOpen(true),
                },
                {
                  label: t('settings.folders', state.lang),
                  icon: <IconFolder size={18} />,
                  onClick: () => setFoldersOpen(true),
                },
              ]}
            />
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto px-3 py-3">
          {SYSTEM_FOLDERS.map((f) => (
            <FolderChip
              key={f.id}
              active={folder === f.id}
              onClick={() => setFolder(f.id)}
              label={t(f.labelKey, state.lang)}
            />
          ))}
          {state.folders.map((f) => (
            <FolderChip
              key={f.id}
              active={folder === f.id}
              onClick={() => setFolder(f.id)}
              label={f.name}
            />
          ))}
          <button
            aria-label={t('chats.folder.add', state.lang)}
            onClick={() => setFoldersOpen(true)}
            className="flex-shrink-0 rounded-full border-2 border-ink bg-paper px-3 py-1 text-sm font-bold"
          >
            +
          </button>
        </div>
      </div>

      {/* Global user-search results, only when typing */}
      {query && (
        <GlobalSearchResults
          users={globalResults}
          searching={searching}
          onPick={onPickUser}
          lang={state.lang}
        />
      )}

      {pinned.length > 0 && (
        <ul>
          {pinned.map((c) => (
            <ChatRow key={c.id} chat={c} lang={state.lang} />
          ))}
        </ul>
      )}

      {rest.length === 0 && pinned.length === 0 && !query ? (
        <p className="p-6 text-center text-sm text-muted">{t('empty.chats', state.lang)}</p>
      ) : (
        <ul>
          {rest.map((c) => (
            <ChatRow key={c.id} chat={c} lang={state.lang} />
          ))}
        </ul>
      )}

      {newChatOpen && (
        <NewChatSheet
          onClose={() => setNewChatOpen(false)}
          onPick={async (u) => {
            setNewChatOpen(false)
            await onPickUser(u)
          }}
        />
      )}
      {newGroupOpen && (
        <NewGroupSheet
          kind={newGroupKind}
          onClose={() => setNewGroupOpen(false)}
        />
      )}
      {newBotOpen && (
        <Modal open={newBotOpen} onClose={() => setNewBotOpen(false)} title={t('chats.newBot', state.lang)}>
          <p className="text-sm text-muted">
            {state.lang === 'ru'
              ? 'Создание собственных ботов появится в следующем апдейте. Сейчас вы можете найти существующих ботов через глобальный поиск.'
              : 'Custom bot creation lands in the next update. For now, find existing bots via global search.'}
          </p>
          <button className="bw-btn-primary mt-4" onClick={() => setNewBotOpen(false)}>
            {t('common.close', state.lang)}
          </button>
        </Modal>
      )}
      {foldersOpen && <FoldersSheet onClose={() => setFoldersOpen(false)} />}
    </div>
  )
}

function FolderChip({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 rounded-full border-2 border-ink px-4 py-1 text-sm font-bold ${
        active ? 'bg-ink text-paper' : 'bg-paper text-ink'
      }`}
    >
      {label}
    </button>
  )
}

function PlusMenu({
  onClose,
  items,
}: {
  onClose: () => void
  items: { label: string; icon: React.ReactNode; onClick: () => void }[]
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [onClose])
  return (
    <div
      ref={ref}
      className="sheet-in absolute right-3 top-[60px] z-[12] w-[220px] overflow-hidden rounded-2xl border-2 border-ink bg-paper shadow-[6px_6px_0_var(--ink)]"
    >
      {items.map((it) => (
        <button
          key={it.label}
          className="row-press flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left text-sm font-bold last:border-b-0"
          onClick={() => {
            onClose()
            it.onClick()
          }}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </div>
  )
}

function GlobalSearchResults({
  users,
  searching,
  onPick,
  lang,
}: {
  users: User[]
  searching: boolean
  onPick: (u: User) => void
  lang: 'en' | 'ru'
}) {
  if (!searching && users.length === 0) return null
  return (
    <div className="border-b-2 border-ink/30 bg-paper px-3 py-2">
      <div className="mb-1 px-1 text-[11px] font-black uppercase tracking-[0.2em] text-muted">
        {t('chats.search.global', lang)}
      </div>
      {searching && <div className="px-2 py-2 text-xs text-muted">{t('common.loading', lang)}</div>}
      {!searching &&
        users.slice(0, 8).map((u) => (
          <button
            key={u.id}
            onClick={() => onPick(u)}
            className="row-press flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left"
          >
            <Avatar name={u.name} size={40} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{u.name}</div>
              <div className="truncate text-xs text-muted">@{u.handle}</div>
            </div>
            <span className="rounded-full border-2 border-ink px-3 py-1 text-xs font-bold">
              {t('chats.start', lang)}
            </span>
          </button>
        ))}
    </div>
  )
}

function NewChatSheet({
  onClose,
  onPick,
}: {
  onClose: () => void
  onPick: (u: User) => void
}) {
  const { state, searchUsers } = useApp()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<User[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (q.trim().length < 1) {
      const reset = window.setTimeout(() => setResults([]), 0)
      return () => window.clearTimeout(reset)
    }
    const handle = window.setTimeout(() => {
      setBusy(true)
      searchUsers(q)
        .then((list) => setResults(list.filter((u) => u.id !== state.me?.id)))
        .finally(() => setBusy(false))
    }, 200)
    return () => window.clearTimeout(handle)
  }, [q, searchUsers, state.me?.id])

  return (
    <Modal open onClose={onClose} title={t('common.newChat', state.lang)}>
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
            onClick={() => onPick(u)}
            className="row-press flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left"
          >
            <Avatar name={u.name} size={44} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{u.name}</div>
              <div className="truncate text-xs text-muted">@{u.handle}</div>
            </div>
            <span className="rounded-full border-2 border-ink px-3 py-1 text-xs font-bold">
              {t('chats.start', state.lang)}
            </span>
          </button>
        ))}
      </div>
    </Modal>
  )
}

function NewGroupSheet({
  onClose,
  kind,
}: {
  onClose: () => void
  kind: 'group' | 'channel'
}) {
  const { state, searchUsers, createChat } = useApp()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [q, setQ] = useState('')
  const [results, setResults] = useState<User[]>([])
  const [picked, setPicked] = useState<User[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!q.trim()) {
      const reset = window.setTimeout(() => setResults([]), 0)
      return () => window.clearTimeout(reset)
    }
    const h = window.setTimeout(() => {
      void searchUsers(q).then((list) =>
        setResults(list.filter((u) => u.id !== state.me?.id && !picked.some((p) => p.id === u.id))),
      )
    }, 200)
    return () => window.clearTimeout(h)
  }, [q, searchUsers, state.me?.id, picked])

  const canSubmit = title.trim().length >= 1 && (kind === 'channel' || picked.length >= 1) && !busy

  const submit = async () => {
    if (!canSubmit) return
    setBusy(true)
    try {
      const id = await createChat(picked.map((p) => p.id), kind, title.trim())
      onClose()
      navigate(`/chats/${id}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={kind === 'group' ? t('chats.newGroup', state.lang) : t('chats.newChannel', state.lang)}
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={kind === 'group' ? 'Group name' : 'Channel name'}
        className="bw-input w-full text-sm normal-case"
      />
      {picked.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {picked.map((u) => (
            <button
              key={u.id}
              onClick={() => setPicked((p) => p.filter((x) => x.id !== u.id))}
              className="rounded-full border-2 border-ink bg-ink px-3 py-1 text-xs font-bold text-paper"
            >
              {u.name} ✕
            </button>
          ))}
        </div>
      )}
      <input
        className="bw-input mt-3 w-full text-sm normal-case"
        placeholder={t('chats.findUser', state.lang)}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="mt-2 max-h-[40vh] overflow-y-auto">
        {results.map((u) => (
          <button
            key={u.id}
            onClick={() => {
              setPicked((p) => [...p, u])
              setQ('')
              setResults([])
            }}
            className="row-press flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left"
          >
            <Avatar name={u.name} size={36} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{u.name}</div>
              <div className="truncate text-xs text-muted">@{u.handle}</div>
            </div>
            <span className="text-xs font-bold">+</span>
          </button>
        ))}
      </div>
      <button disabled={!canSubmit} onClick={submit} className="bw-btn-primary mt-4 disabled:opacity-40">
        {t('common.create', state.lang)}
      </button>
    </Modal>
  )
}

function FoldersSheet({ onClose }: { onClose: () => void }) {
  const { state, createFolder, deleteFolder, renameFolder, setFolderChats } = useApp()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)

  const editingFolder = editing ? state.folders.find((f) => f.id === editing) : null

  return (
    <Modal open onClose={onClose} title={t('settings.folders', state.lang)}>
      {!editingFolder && (
        <>
          <div className="flex flex-col gap-2">
            {state.folders.length === 0 && (
              <p className="text-center text-xs text-muted">
                {state.lang === 'ru'
                  ? 'У вас пока нет своих папок'
                  : "You don't have custom folders yet"}
              </p>
            )}
            {state.folders.map((f) => (
              <div key={f.id} className="flex items-center gap-2 rounded-xl border-2 border-ink px-3 py-2">
                <button onClick={() => setEditing(f.id)} className="flex-1 text-left">
                  <div className="font-bold">{f.name}</div>
                  <div className="text-xs text-muted">
                    {f.chatIds.length} {state.lang === 'ru' ? 'чатов' : 'chats'}
                  </div>
                </button>
                <button
                  onClick={() => setRenaming(f.id)}
                  className="rounded-full border-2 border-ink px-3 py-1 text-xs font-bold"
                >
                  {state.lang === 'ru' ? 'Имя' : 'Rename'}
                </button>
                <button
                  onClick={() => setConfirmDelete(f.id)}
                  className="rounded-full border-2 border-ink px-3 py-1 text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setCreating(true)}
            className="bw-btn-primary mt-4 w-full"
          >
            {t('chats.folder.add', state.lang)}
          </button>
        </>
      )}

      {editingFolder && (
        <FolderChatPicker
          folder={editingFolder}
          chats={state.chats}
          onSave={async (chatIds) => {
            await setFolderChats(editingFolder.id, chatIds)
            setEditing(null)
          }}
          onBack={() => setEditing(null)}
        />
      )}

      <PromptDialog
        open={creating}
        title={t('chats.folder.add', state.lang)}
        placeholder={t('chats.folder.name', state.lang)}
        okLabel={t('common.create', state.lang)}
        cancelLabel={t('common.cancel', state.lang)}
        onResolve={async (val) => {
          setCreating(false)
          if (val) await createFolder(val)
        }}
      />
      <PromptDialog
        open={!!renaming}
        title={state.lang === 'ru' ? 'Переименовать папку' : 'Rename folder'}
        initialValue={renaming ? state.folders.find((f) => f.id === renaming)?.name : ''}
        okLabel={t('common.ok', state.lang)}
        cancelLabel={t('common.cancel', state.lang)}
        onResolve={async (val) => {
          const id = renaming
          setRenaming(null)
          if (id && val) await renameFolder(id, val)
        }}
      />
      <ConfirmDialog
        open={!!confirmDelete}
        title={t('chats.folder.delete', state.lang)}
        message={
          state.lang === 'ru'
            ? 'Папка будет удалена. Чаты внутри останутся.'
            : 'The folder will be removed. Chats inside are kept.'
        }
        okLabel={t('common.delete', state.lang)}
        cancelLabel={t('common.cancel', state.lang)}
        destructive
        onResolve={async (ok) => {
          const id = confirmDelete
          setConfirmDelete(null)
          if (ok && id) await deleteFolder(id)
        }}
      />
    </Modal>
  )
}

function FolderChatPicker({
  folder,
  chats,
  onSave,
  onBack,
}: {
  folder: ChatFolderT
  chats: Chat[]
  onSave: (chatIds: string[]) => Promise<void>
  onBack: () => void
}) {
  const { state } = useApp()
  const [selected, setSelected] = useState<Set<string>>(new Set(folder.chatIds))
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <button onClick={onBack} className="rounded-full border-2 border-ink px-3 py-1 text-xs font-bold">
          ←
        </button>
        <div className="flex-1 truncate font-bold">{folder.name}</div>
      </div>
      <div className="max-h-[50vh] overflow-y-auto">
        {chats.map((c) => {
          const isSelected = selected.has(c.id)
          return (
            <label
              key={c.id}
              className="row-press flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left"
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {
                  setSelected((s) => {
                    const n = new Set(s)
                    if (n.has(c.id)) n.delete(c.id)
                    else n.add(c.id)
                    return n
                  })
                }}
                className="h-4 w-4 accent-black"
              />
              <Avatar name={c.title} size={36} filled={c.kind === 'channel'} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{c.title}</div>
                <div className="truncate text-xs text-muted">{c.kind}</div>
              </div>
            </label>
          )
        })}
      </div>
      <button
        onClick={() => onSave([...selected])}
        className="bw-btn-primary mt-3 w-full"
      >
        {t('common.ok', state.lang)}
      </button>
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
