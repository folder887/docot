import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  ApiChat,
  ApiEvent,
  ApiFolder,
  ApiMessage,
  ApiNote,
  ApiPost,
  ApiUser,
} from './api'
import { api, getToken, setToken } from './api'
import type {
  CalendarEvent,
  Chat,
  ChatFolder,
  Lang,
  Message,
  NewsPost,
  Note,
  Prefs,
  User,
} from './types'
import { defaultPrefs } from './types'
import { ensureIdentity } from './crypto/identity'
import { encryptForUser, isEncryptedEnvelope, maybeDecrypt } from './crypto/session'
import { idbClearAll } from './crypto/idb'
import { recallOutgoing, rememberOutgoing } from './crypto/outgoing'

const PREFS_KEY = 'docot:prefs'
const LANG_KEY = 'docot:lang'

type Status = 'loading' | 'anon' | 'authed'

export type AppState = {
  status: Status
  lang: Lang
  prefs: Prefs
  me: User | null
  users: Record<string, User>
  chats: Chat[]
  events: CalendarEvent[]
  notes: Note[]
  news: NewsPost[]
  folders: ChatFolder[]
  /** true once user completed signup/login */
  onboarded: boolean
}

type Ctx = {
  state: AppState
  setLang: (l: Lang) => void
  setPrefs: (patch: Partial<Prefs>) => void
  signup: (handle: string, name: string, password: string) => Promise<void>
  login: (handle: string, password: string) => Promise<void>
  logout: () => void
  sendMessage: (chatId: string, text: string, replyToId?: string | null) => Promise<void>
  editMessage: (chatId: string, messageId: string, text: string) => Promise<void>
  deleteMessage: (chatId: string, messageId: string) => Promise<void>
  applyMessageEdit: (chatId: string, msg: Message) => void
  applyMessageDelete: (chatId: string, messageId: string, deletedAt: number) => void
  createChat: (participantIds: string[], kind?: Chat['kind'], title?: string) => Promise<string>
  patchChat: (chatId: string, patch: { title?: string; description?: string; isPublic?: boolean }) => Promise<void>
  pinChat: (chatId: string, pinned: boolean) => Promise<void>
  muteChat: (chatId: string, muted: boolean) => Promise<void>
  deleteChat: (chatId: string) => Promise<void>
  joinViaInvite: (token: string) => Promise<string>
  addEvent: (ev: Omit<CalendarEvent, 'id'>) => Promise<void>
  updateEvent: (id: string, patch: Omit<CalendarEvent, 'id'>) => Promise<void>
  deleteEvent: (id: string) => Promise<void>
  addNote: (title: string) => Promise<string>
  updateNote: (id: string, patch: Partial<Pick<Note, 'title' | 'body' | 'tags'>>) => Promise<void>
  deleteNote: (id: string) => Promise<void>
  addPost: (text: string, media?: NewsPost['media']) => Promise<void>
  deletePost: (id: string) => Promise<void>
  toggleLike: (id: string) => Promise<void>
  repost: (id: string) => Promise<void>
  createFolder: (name: string, chatIds?: string[]) => Promise<string>
  renameFolder: (id: string, name: string) => Promise<void>
  setFolderChats: (id: string, chatIds: string[]) => Promise<void>
  deleteFolder: (id: string) => Promise<void>
  updateMe: (patch: { name?: string; bio?: string; phone?: string }) => Promise<void>
  loadUser: (id: string) => Promise<User | null>
  userById: (id: string) => User | null
  peerOf: (chat: Chat) => User | null
  searchUsers: (q: string) => Promise<User[]>
  refresh: () => Promise<void>
  addIncomingMessage: (chatId: string, msg: Message) => Promise<void>
}

const AppCtx = createContext<Ctx | null>(null)

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return defaultPrefs
    return { ...defaultPrefs, ...(JSON.parse(raw) as Partial<Prefs>) }
  } catch {
    return defaultPrefs
  }
}

function loadLang(): Lang {
  const v = localStorage.getItem(LANG_KEY)
  return v === 'ru' ? 'ru' : 'en'
}

function userFromApi(u: ApiUser): User {
  return {
    id: u.id,
    name: u.name,
    handle: u.handle,
    bio: u.bio,
    kind: u.kind,
    lastSeen: u.lastSeen ?? undefined,
    blocked: u.blocked,
    isContact: u.isContact,
    phone: u.phone,
  }
}

function msgFromApi(m: ApiMessage): Message {
  return {
    id: m.id,
    authorId: m.authorId,
    text: m.text,
    at: m.at,
    editedAt: m.editedAt ?? null,
    deletedAt: m.deletedAt ?? null,
    replyToId: m.replyToId ?? null,
  }
}

async function decryptHistory(
  me: User,
  chats: Chat[],
  setState: (updater: (s: AppState) => AppState) => void,
): Promise<void> {
  for (const chat of chats) {
    if (chat.kind !== 'dm') continue
    const peerId = chat.participants.find((p) => p !== me.id)
    if (!peerId) continue
    let changed = false
    const next: Message[] = []
    for (const m of chat.messages) {
      if (!isEncryptedEnvelope(m.text)) {
        next.push(m)
        continue
      }
      if (m.authorId === me.id) {
        const cached = await recallOutgoing(m.id)
        next.push(cached !== undefined ? { ...m, text: cached } : { ...m, text: '' })
        changed = true
        continue
      }
      const plain = await maybeDecrypt(peerId, m.text)
      next.push({ ...m, text: plain })
      changed = true
    }
    if (!changed) continue
    const lastPlain = next.length ? next[next.length - 1] : null
    setState((s) => ({
      ...s,
      chats: s.chats.map((c) =>
        c.id === chat.id
          ? {
              ...c,
              messages: next,
              lastMessage: lastPlain ?? c.lastMessage,
            }
          : c,
      ),
    }))
  }
}

function chatFromApi(c: ApiChat): Chat {
  return {
    id: c.id,
    kind: c.kind,
    title: c.title,
    description: c.description ?? '',
    isPublic: !!c.isPublic,
    createdBy: c.createdBy,
    participants: c.participants,
    messages: c.messages.map(msgFromApi),
    pinned: c.pinned,
    muted: c.muted,
    role: c.role ?? 'member',
    updatedAt: c.updatedAt,
    lastMessage: c.lastMessage ? msgFromApi(c.lastMessage) : null,
  }
}

function noteFromApi(n: ApiNote): Note {
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    tags: n.tags,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  }
}

function eventFromApi(e: ApiEvent): CalendarEvent {
  return {
    id: e.id,
    title: e.title,
    date: e.date,
    start: e.start,
    end: e.end,
    notes: e.note,
  }
}

function postFromApi(p: ApiPost): NewsPost {
  return {
    id: p.id,
    authorId: p.authorId,
    text: p.text,
    at: p.at,
    likes: p.likes,
    reposts: p.reposts,
    replies: p.replies,
    liked: p.liked,
    reposted: p.reposted,
    media: p.media ?? [],
  }
}

function folderFromApi(f: ApiFolder): ChatFolder {
  return { id: f.id, name: f.name, sortOrder: f.sortOrder, chatIds: f.chatIds }
}

function emptyState(lang: Lang, prefs: Prefs, status: Status): AppState {
  return {
    status,
    lang,
    prefs,
    me: null,
    users: {},
    chats: [],
    events: [],
    notes: [],
    news: [],
    folders: [],
    onboarded: false,
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => emptyState(loadLang(), loadPrefs(), 'loading'))

  // persist prefs + lang
  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(state.prefs))
    } catch {
      /* ignore */
    }
  }, [state.prefs])
  useEffect(() => {
    try {
      localStorage.setItem(LANG_KEY, state.lang)
    } catch {
      /* ignore */
    }
  }, [state.lang])

  const mergeUsers = useCallback((list: User[]) => {
    setState((s) => {
      const users = { ...s.users }
      for (const u of list) users[u.id] = u
      return { ...s, users }
    })
  }, [])

  const hydrate = useCallback(async (me: User) => {
    const [chats, notes, events, posts, contacts, folders] = await Promise.all([
      api.listChats(),
      api.listNotes(),
      api.listEvents(),
      api.listPosts(),
      api.listContacts(),
      api.listFolders().catch(() => [] as ApiFolder[]),
    ])
    // collect unknown participant IDs to fetch their profiles
    const knownIds = new Set<string>([me.id, ...contacts.map((c) => c.id)])
    const allUsers: User[] = [me, ...contacts.map(userFromApi)]
    const missing = new Set<string>()
    for (const c of chats) {
      for (const pid of c.participants) {
        if (!knownIds.has(pid)) missing.add(pid)
      }
    }
    for (const p of posts) {
      if (!knownIds.has(p.authorId)) missing.add(p.authorId)
    }
    if (missing.size) {
      const fetched = await Promise.all(
        [...missing].map((id) => api.getUser(id).catch(() => null)),
      )
      for (const u of fetched) if (u) allUsers.push(userFromApi(u))
    }

    const usersIdx: Record<string, User> = {}
    for (const u of allUsers) usersIdx[u.id] = u

    const mappedChats = chats.map(chatFromApi).sort(sortChats)
    setState((s) => ({
      ...s,
      status: 'authed',
      onboarded: true,
      me,
      users: { ...s.users, ...usersIdx },
      chats: mappedChats,
      notes: notes.map(noteFromApi),
      events: events.map(eventFromApi),
      news: posts.map(postFromApi),
      folders: folders.map(folderFromApi),
    }))
    void decryptHistory(me, mappedChats, setState)
  }, [])

  // boot: try to fetch me via stored token
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const tok = getToken()
      if (!tok) {
        setState((s) => ({ ...s, status: 'anon' }))
        return
      }
      try {
        const u = await api.me()
        if (cancelled) return
        await hydrate(userFromApi(u))
      } catch {
        setToken(null)
        if (!cancelled) setState((s) => ({ ...s, status: 'anon' }))
      }
    }
    void run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setLang = useCallback((lang: Lang) => {
    setState((s) => ({ ...s, lang }))
  }, [])

  const setPrefs = useCallback((patch: Partial<Prefs>) => {
    setState((s) => ({ ...s, prefs: { ...s.prefs, ...patch } }))
  }, [])

  const signup = useCallback(
    async (handle: string, name: string, password: string) => {
      const { token, user } = await api.signup(handle, name, password)
      setToken(token)
      await hydrate(userFromApi(user))
      ensureIdentity().catch((err) => console.warn('e2e bootstrap', err))
    },
    [hydrate],
  )

  const login = useCallback(
    async (handle: string, password: string) => {
      const { token, user } = await api.login(handle, password)
      setToken(token)
      await hydrate(userFromApi(user))
      ensureIdentity().catch((err) => console.warn('e2e bootstrap', err))
    },
    [hydrate],
  )

  const logout = useCallback(() => {
    setToken(null)
    idbClearAll().catch(() => {})
    setState((s) => emptyState(s.lang, s.prefs, 'anon'))
  }, [])

  const refresh = useCallback(async () => {
    if (!state.me) return
    await hydrate(state.me)
  }, [hydrate, state.me])

  const sendMessage = useCallback(
    async (chatId: string, text: string, replyToId?: string | null) => {
      const trimmed = text.trim()
      if (!trimmed) return
      const chat = state.chats.find((c) => c.id === chatId)
      const peerId = chat && chat.kind === 'dm' && state.me
        ? chat.participants.find((p) => p !== state.me?.id) ?? null
        : null
      let payload = trimmed
      if (peerId) {
        try {
          payload = await encryptForUser(peerId, trimmed)
        } catch (err) {
          console.warn('encrypt failed, sending plaintext', err)
        }
      }
      const apiMsg = await api.sendMessage(chatId, {
        text: payload,
        replyToId: replyToId ?? null,
      })
      const msg: Message = { ...msgFromApi(apiMsg), text: trimmed }
      if (peerId) {
        rememberOutgoing(msg.id, trimmed).catch(() => {})
      }
      setState((s) => ({
        ...s,
        chats: s.chats
          .map((c) =>
            c.id === chatId
              ? {
                  ...c,
                  messages: [...c.messages, msg],
                  lastMessage: msg,
                  updatedAt: msg.at,
                }
              : c,
          )
          .sort(sortChats),
      }))
    },
    [state.chats, state.me],
  )

  const applyMessageEdit = useCallback((chatId: string, msg: Message) => {
    setState((s) => ({
      ...s,
      chats: s.chats.map((c) =>
        c.id === chatId
          ? {
              ...c,
              messages: c.messages.map((m) => (m.id === msg.id ? msg : m)),
              lastMessage: c.lastMessage?.id === msg.id ? msg : c.lastMessage,
            }
          : c,
      ),
    }))
  }, [])

  const applyMessageDelete = useCallback(
    (chatId: string, messageId: string, deletedAt: number) => {
      setState((s) => ({
        ...s,
        chats: s.chats.map((c) =>
          c.id === chatId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === messageId ? { ...m, text: '', deletedAt } : m,
                ),
              }
            : c,
        ),
      }))
    },
    [],
  )

  const editMessage = useCallback(
    async (chatId: string, messageId: string, text: string) => {
      const msg = msgFromApi(await api.editMessage(chatId, messageId, text))
      applyMessageEdit(chatId, msg)
    },
    [applyMessageEdit],
  )

  const deleteMessage = useCallback(
    async (chatId: string, messageId: string) => {
      await api.deleteMessage(chatId, messageId)
      applyMessageDelete(chatId, messageId, Date.now())
    },
    [applyMessageDelete],
  )

  const patchChat = useCallback(
    async (
      chatId: string,
      patch: { title?: string; description?: string; isPublic?: boolean },
    ) => {
      const updated = chatFromApi(await api.patchChat(chatId, patch))
      setState((s) => ({
        ...s,
        chats: s.chats.map((c) =>
          c.id === chatId
            ? { ...c, ...updated, messages: c.messages, lastMessage: c.lastMessage }
            : c,
        ),
      }))
    },
    [],
  )

  const joinViaInvite = useCallback(async (token: string) => {
    const chat = chatFromApi(await api.joinViaInvite(token))
    setState((s) => {
      const exists = s.chats.find((c) => c.id === chat.id)
      const chats = exists
        ? s.chats.map((c) => (c.id === chat.id ? chat : c))
        : [chat, ...s.chats]
      return { ...s, chats: chats.sort(sortChats) }
    })
    return chat.id
  }, [])

  const addIncomingMessage = useCallback(
    async (chatId: string, msg: Message) => {
      let final = msg
      if (isEncryptedEnvelope(msg.text) && state.me && msg.authorId !== state.me.id) {
        const plain = await maybeDecrypt(msg.authorId, msg.text)
        final = { ...msg, text: plain }
      }
      setState((s) => ({
        ...s,
        chats: s.chats
          .map((c) =>
            c.id === chatId
              ? c.messages.some((m) => m.id === final.id)
                ? c
                : {
                    ...c,
                    messages: [...c.messages, final],
                    lastMessage: final,
                    updatedAt: final.at,
                  }
              : c,
          )
          .sort(sortChats),
      }))
    },
    [state.me],
  )

  const createChat = useCallback(
    async (participantIds: string[], kind: Chat['kind'] = 'dm', title?: string) => {
      const real = kind === 'saved' ? 'dm' : kind
      const body = {
        kind: real as 'dm' | 'group' | 'channel',
        title,
        participantIds,
      }
      const chat = chatFromApi(await api.createChat(body))
      setState((s) => {
        const existing = s.chats.find((c) => c.id === chat.id)
        const chats = existing
          ? s.chats.map((c) => (c.id === chat.id ? chat : c))
          : [chat, ...s.chats]
        return { ...s, chats: chats.sort(sortChats) }
      })
      return chat.id
    },
    [],
  )

  const pinChat = useCallback(async (chatId: string, pinned: boolean) => {
    await api.pinChat(chatId, pinned)
    setState((s) => ({
      ...s,
      chats: s.chats.map((c) => (c.id === chatId ? { ...c, pinned } : c)).sort(sortChats),
    }))
  }, [])

  const muteChat = useCallback(async (chatId: string, muted: boolean) => {
    await api.muteChat(chatId, muted)
    setState((s) => ({
      ...s,
      chats: s.chats.map((c) => (c.id === chatId ? { ...c, muted } : c)),
    }))
  }, [])

  const deleteChat = useCallback(async (chatId: string) => {
    await api.deleteChat(chatId)
    setState((s) => ({ ...s, chats: s.chats.filter((c) => c.id !== chatId) }))
  }, [])

  const addEvent = useCallback(async (ev: Omit<CalendarEvent, 'id'>) => {
    const created = eventFromApi(
      await api.createEvent({
        title: ev.title,
        date: ev.date,
        start: ev.start ?? '',
        end: ev.end ?? '',
        note: ev.notes ?? '',
      }),
    )
    setState((s) => ({ ...s, events: [...s.events, created] }))
  }, [])

  const updateEvent = useCallback(async (id: string, patch: Omit<CalendarEvent, 'id'>) => {
    const updated = eventFromApi(
      await api.updateEvent(id, {
        title: patch.title,
        date: patch.date,
        start: patch.start ?? '',
        end: patch.end ?? '',
        note: patch.notes ?? '',
      }),
    )
    setState((s) => ({
      ...s,
      events: s.events.map((e) => (e.id === id ? updated : e)),
    }))
  }, [])

  const deleteEvent = useCallback(async (id: string) => {
    await api.deleteEvent(id)
    setState((s) => ({ ...s, events: s.events.filter((e) => e.id !== id) }))
  }, [])

  const addNote = useCallback(async (title: string) => {
    const t = title.trim() || 'Untitled'
    const created = noteFromApi(
      await api.createNote({ title: t, body: `# ${t}\n\n`, tags: [] }),
    )
    setState((s) => ({ ...s, notes: [created, ...s.notes] }))
    return created.id
  }, [])

  const updateNote = useCallback(
    async (id: string, patch: Partial<Pick<Note, 'title' | 'body' | 'tags'>>) => {
      const updated = noteFromApi(await api.updateNote(id, patch))
      setState((s) => ({
        ...s,
        notes: s.notes.map((n) => (n.id === id ? updated : n)),
      }))
    },
    [],
  )

  const deleteNote = useCallback(async (id: string) => {
    await api.deleteNote(id)
    setState((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) }))
  }, [])

  const addPost = useCallback(async (text: string, media: NewsPost['media'] = []) => {
    const trimmed = text.trim()
    if (!trimmed && (!media || media.length === 0)) return
    const p = postFromApi(
      await api.createPost({
        text: trimmed,
        media: (media ?? []).map((m) => ({
          url: m.url,
          kind: m.kind,
          name: m.name,
          mime: m.mime,
          size: m.size,
        })),
      }),
    )
    setState((s) => ({ ...s, news: [p, ...s.news] }))
  }, [])

  const deletePost = useCallback(async (id: string) => {
    await api.deletePost(id)
    setState((s) => ({ ...s, news: s.news.filter((n) => n.id !== id) }))
  }, [])

  const toggleLike = useCallback(async (id: string) => {
    const p = postFromApi(await api.likePost(id))
    setState((s) => ({
      ...s,
      news: s.news.map((n) => (n.id === id ? p : n)),
    }))
  }, [])

  const repost = useCallback(async (id: string) => {
    const p = postFromApi(await api.repostPost(id))
    setState((s) => ({
      ...s,
      news: s.news.map((n) => (n.id === id ? p : n)),
    }))
  }, [])

  const createFolder = useCallback(async (name: string, chatIds: string[] = []) => {
    const f = folderFromApi(await api.createFolder({ name, chatIds }))
    setState((s) => ({ ...s, folders: [...s.folders, f] }))
    return f.id
  }, [])

  const renameFolder = useCallback(async (id: string, name: string) => {
    const f = folderFromApi(await api.updateFolder(id, { name }))
    setState((s) => ({ ...s, folders: s.folders.map((x) => (x.id === id ? f : x)) }))
  }, [])

  const setFolderChats = useCallback(async (id: string, chatIds: string[]) => {
    const f = folderFromApi(await api.updateFolder(id, { chatIds }))
    setState((s) => ({ ...s, folders: s.folders.map((x) => (x.id === id ? f : x)) }))
  }, [])

  const deleteFolder = useCallback(async (id: string) => {
    await api.deleteFolder(id)
    setState((s) => ({ ...s, folders: s.folders.filter((f) => f.id !== id) }))
  }, [])

  const updateMe = useCallback(
    async (patch: { name?: string; bio?: string; phone?: string }) => {
      const u = userFromApi(await api.updateMe(patch))
      setState((s) => ({
        ...s,
        me: u,
        users: { ...s.users, [u.id]: u },
      }))
    },
    [],
  )

  const loadUser = useCallback(
    async (id: string) => {
      const cached = state.users[id]
      if (cached) return cached
      try {
        const u = userFromApi(await api.getUser(id))
        mergeUsers([u])
        return u
      } catch {
        return null
      }
    },
    [mergeUsers, state.users],
  )

  const userById = useCallback(
    (id: string): User | null => {
      if (state.me && (id === 'me' || id === state.me.id)) return state.me
      return state.users[id] ?? null
    },
    [state.me, state.users],
  )

  const peerOf = useCallback(
    (chat: Chat): User | null => {
      if (chat.kind !== 'dm') return null
      const me = state.me
      const otherId = chat.participants.find((p) => !me || p !== me.id)
      if (!otherId) return null
      return userById(otherId)
    },
    [userById, state.me],
  )

  const searchUsers = useCallback(async (q: string) => {
    if (!q.trim()) return []
    const users = (await api.searchUsers(q)).map(userFromApi)
    mergeUsers(users)
    return users
  }, [mergeUsers])

  const value = useMemo<Ctx>(
    () => ({
      state,
      setLang,
      setPrefs,
      signup,
      login,
      logout,
      sendMessage,
      editMessage,
      deleteMessage,
      applyMessageEdit,
      applyMessageDelete,
      createChat,
      patchChat,
      pinChat,
      muteChat,
      deleteChat,
      joinViaInvite,
      addEvent,
      updateEvent,
      deleteEvent,
      addNote,
      updateNote,
      deleteNote,
      addPost,
      deletePost,
      toggleLike,
      repost,
      createFolder,
      renameFolder,
      setFolderChats,
      deleteFolder,
      updateMe,
      loadUser,
      userById,
      peerOf,
      searchUsers,
      refresh,
      addIncomingMessage,
    }),
    [
      state,
      setLang,
      setPrefs,
      signup,
      login,
      logout,
      sendMessage,
      editMessage,
      deleteMessage,
      applyMessageEdit,
      applyMessageDelete,
      createChat,
      patchChat,
      pinChat,
      muteChat,
      deleteChat,
      joinViaInvite,
      addEvent,
      updateEvent,
      deleteEvent,
      addNote,
      updateNote,
      deleteNote,
      addPost,
      deletePost,
      toggleLike,
      repost,
      createFolder,
      renameFolder,
      setFolderChats,
      deleteFolder,
      updateMe,
      loadUser,
      userById,
      peerOf,
      searchUsers,
      refresh,
      addIncomingMessage,
    ],
  )

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

function sortChats(a: Chat, b: Chat): number {
  if (a.pinned && !b.pinned) return -1
  if (!a.pinned && b.pinned) return 1
  return (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
}

export { AppCtx }

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): Ctx {
  const ctx = useContext(AppCtx)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}
