import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
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
import {
  encryptForUser,
  isEncryptedEnvelope,
  isOwnEnvelope,
  maybeDecrypt,
} from './crypto/session'
import { idbClearAll } from './crypto/idb'
import {
  recallIncoming,
  recallOutgoing,
  rememberIncoming,
  rememberOutgoing,
} from './crypto/outgoing'

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
  setPasscode: (pin: string) => void
  clearPasscode: () => void
  signup: (handle: string, name: string, password: string) => Promise<void>
  login: (handle: string, password: string) => Promise<void>
  loginByPair: (pairToken: string) => Promise<void>
  logout: () => void
  sendMessage: (chatId: string, text: string, replyToId?: string | null) => Promise<void>
  editMessage: (chatId: string, messageId: string, text: string) => Promise<void>
  deleteMessage: (chatId: string, messageId: string) => Promise<void>
  toggleReaction: (chatId: string, messageId: string, emoji: string) => Promise<void>
  applyReactionEvent: (
    chatId: string,
    messageId: string,
    userId: string,
    emoji: string,
    added: boolean,
  ) => void
  applyMessageEdit: (chatId: string, msg: Message) => Promise<void>
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
  addPost: (
    text: string,
    media?: NewsPost['media'],
    opts?: { title?: string; communityId?: string },
  ) => Promise<void>
  deletePost: (id: string) => Promise<void>
  toggleLike: (id: string) => Promise<void>
  votePost: (id: string, value: -1 | 0 | 1) => Promise<void>
  repost: (id: string) => Promise<void>
  createFolder: (name: string, chatIds?: string[]) => Promise<string>
  renameFolder: (id: string, name: string) => Promise<void>
  setFolderChats: (id: string, chatIds: string[]) => Promise<void>
  deleteFolder: (id: string) => Promise<void>
  updateMe: (patch: {
    name?: string
    bio?: string
    phone?: string
    avatarUrl?: string | null
    links?: string[]
  }) => Promise<void>
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
    avatarUrl: u.avatarUrl ?? null,
    links: Array.isArray(u.links) ? u.links : [],
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
    sealed: m.sealed ?? false,
    reactions: m.reactions ?? [],
  }
}

/** For sealed-sender messages the API returns an empty `authorId`; substitute
 * the other DM participant so UI rendering, mention checks, and re-decryption
 * have a concrete sender id to work with. Non-DM chats and unsealed messages
 * are returned untouched. */
function deanonymise(me: User, chatLike: { kind: string; participants: string[] } | undefined, m: Message): Message {
  if (!m.sealed || m.authorId) return m
  if (!chatLike || chatLike.kind !== 'dm') return m
  const other = chatLike.participants.find((p) => p !== me.id)
  if (!other) return m
  return { ...m, authorId: other }
}

// In-flight decrypt registry — avoids double-advancing the Signal ratchet
// when `decryptHistory` and `addIncomingMessage` race for the same message
// id (e.g. the chat-list `lastMessage` preview decryption running in parallel
// with the chat detail screen's history walk). The Map holds a single
// pending Promise<string> per message; concurrent callers all await that one
// resolution rather than each calling `decryptWhisperMessage` separately.
const inflightDecrypts = new Map<string, Promise<string>>()

function decryptOnce(
  messageId: string,
  myId: string,
  authorId: string,
  text: string,
): Promise<string> {
  const existing = inflightDecrypts.get(messageId)
  if (existing) return existing
  const pending = (async () => {
    try {
      return await maybeDecrypt(myId, authorId, text)
    } finally {
      inflightDecrypts.delete(messageId)
    }
  })()
  inflightDecrypts.set(messageId, pending)
  return pending
}

/** Resolve a single (possibly-encrypted) message to its plaintext form using
 * the local caches and, for peer messages, the Signal session. */
async function resolvePlaintext(
  me: User,
  peerId: string,
  m: Message,
): Promise<Message | null> {
  if (!isEncryptedEnvelope(m.text)) return null
  if (m.authorId === me.id) {
    const cached = await recallOutgoing(m.id)
    if (cached !== undefined) return { ...m, text: cached }
    // Sibling-device path: decrypt the self-sync entry and seed cache.
    const plain = await decryptOnce(m.id, me.id, me.id, m.text)
    if (plain) rememberOutgoing(m.id, plain).catch(() => {})
    return { ...m, text: plain }
  }
  const cachedIn = await recallIncoming(m.id)
  if (cachedIn !== undefined) return { ...m, text: cachedIn }
  const plain = await decryptOnce(m.id, me.id, peerId, m.text)
  if (plain) {
    rememberIncoming(m.id, plain).catch(() => {})
  }
  return { ...m, text: plain }
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
    // listChats returns chats with empty `messages`; full history is loaded
    // per-chat via api.getChat → addIncomingMessage. The list view, however,
    // shows `lastMessage` as a preview, which may be ciphertext.
    let resolvedLast: Message | null = null
    if (chat.lastMessage) {
      resolvedLast = await resolvePlaintext(me, peerId, chat.lastMessage)
    }
    const next: Message[] = []
    let messagesChanged = false
    for (const m of chat.messages) {
      const r = await resolvePlaintext(me, peerId, m)
      if (r) {
        messagesChanged = true
        next.push(r)
      } else {
        next.push(m)
      }
    }
    if (!resolvedLast && !messagesChanged) continue
    setState((s) => ({
      ...s,
      chats: s.chats.map((c) =>
        c.id === chat.id
          ? {
              ...c,
              messages: messagesChanged ? next : c.messages,
              lastMessage: resolvedLast ?? c.lastMessage,
            }
          : c,
      ),
    }))
  }
}

function chatFromApi(c: ApiChat, meId?: string): Chat {
  const stub = { kind: c.kind, participants: c.participants }
  const fixSealed = (m: Message) =>
    meId ? deanonymise({ id: meId } as User, stub, m) : m
  return {
    id: c.id,
    kind: c.kind,
    title: c.title,
    description: c.description ?? '',
    isPublic: !!c.isPublic,
    slowModeSeconds: c.slowModeSeconds ?? 0,
    subscribersOnly: !!c.subscribersOnly,
    signedPosts: !!c.signedPosts,
    createdBy: c.createdBy,
    participants: c.participants,
    messages: c.messages.map((m) => fixSealed(msgFromApi(m))),
    pinned: c.pinned,
    muted: c.muted,
    role: c.role ?? 'member',
    updatedAt: c.updatedAt,
    lastMessage: c.lastMessage ? fixSealed(msgFromApi(c.lastMessage)) : null,
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
    communityId: p.communityId ?? '',
    title: p.title ?? '',
    score: p.score ?? 0,
    ups: p.ups ?? 0,
    downs: p.downs ?? 0,
    myVote: p.myVote ?? 0,
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
  // Mirror of `state.chats` for use in stable callbacks without inflating
  // dependency arrays.
  const chatsRef = useRef(state.chats)
  useEffect(() => {
    chatsRef.current = state.chats
  }, [state.chats])

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

    const mappedChats = chats.map((c) => chatFromApi(c, me.id)).sort(sortChats)
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

  const setPasscode = useCallback((pin: string) => {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join('')
    const data = new TextEncoder().encode(saltHex + ':' + pin)
    void crypto.subtle.digest('SHA-256', data).then((buf) => {
      const hex = Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
      try {
        localStorage.setItem('docot.passcode.hash', hex)
        localStorage.setItem('docot.passcode.salt', saltHex)
        sessionStorage.setItem('docot.passcode.unlocked', '1')
      } catch {
        /* ignore */
      }
      setState((s) => ({ ...s, prefs: { ...s.prefs, passcode: true } }))
    })
  }, [])

  const clearPasscode = useCallback(() => {
    try {
      localStorage.removeItem('docot.passcode.hash')
      localStorage.removeItem('docot.passcode.salt')
      sessionStorage.removeItem('docot.passcode.unlocked')
    } catch {
      /* ignore */
    }
    setState((s) => ({ ...s, prefs: { ...s.prefs, passcode: false } }))
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

  const loginByPair = useCallback(
    async (pairToken: string) => {
      const { token, user } = await api.pairClaim(pairToken)
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
      let sealed = false
      if (peerId && state.me) {
        try {
          payload = await encryptForUser(state.me.id, peerId, trimmed)
          // Only enable sealed-sender on successful encryption: a plaintext
          // fallback message has no inner Signal envelope to verify the
          // sender, so the recipient would have nothing but chat membership
          // to go on.
          sealed = true
        } catch (err) {
          console.warn('encrypt failed, sending plaintext', err)
        }
      }
      const apiMsg = await api.sendMessage(chatId, {
        text: payload,
        replyToId: replyToId ?? null,
        sealed,
      })
      // The server returns authorId="" for sealed messages; restore our own
      // id locally so the rest of the UI behaves as if the send was attributed.
      const msg: Message = {
        ...msgFromApi(apiMsg),
        authorId: state.me ? state.me.id : apiMsg.authorId,
        text: trimmed,
      }
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

  const applyMessageEdit = useCallback(async (chatId: string, msg: Message) => {
    const chat = chatsRef.current.find((c) => c.id === chatId)
    let attributed = msg
    if (state.me && msg.sealed && !msg.authorId && isEncryptedEnvelope(msg.text)) {
      if (await isOwnEnvelope(state.me.id, msg.text)) {
        attributed = { ...msg, authorId: state.me.id }
      }
    }
    const incoming = state.me ? deanonymise(state.me, chat, attributed) : attributed
    let final = incoming
    if (chat?.kind === 'dm' && isEncryptedEnvelope(incoming.text) && state.me) {
      if (incoming.authorId === state.me.id) {
        // Our own edit is also written to the outgoing cache by editMessage,
        // so this picks up the new plaintext (not the pre-edit one). Sibling
        // devices missing the cache fall back to decrypting the self-sync
        // entry inside the multi-recipient envelope.
        const cached = await recallOutgoing(incoming.id)
        if (cached !== undefined) {
          final = { ...incoming, text: cached }
        } else {
          const plain = await decryptOnce(
            incoming.id,
            state.me.id,
            incoming.authorId,
            incoming.text,
          )
          if (plain) rememberOutgoing(incoming.id, plain).catch(() => {})
          final = { ...incoming, text: plain }
        }
      } else {
        // Incoming edits change the ciphertext but reuse the original
        // message id, so the cached incoming plaintext is stale. Always
        // re-decrypt and refresh the cache.
        const plain = await decryptOnce(
          incoming.id,
          state.me.id,
          incoming.authorId,
          incoming.text,
        )
        if (plain) {
          rememberIncoming(incoming.id, plain).catch(() => {})
        }
        final = { ...incoming, text: plain }
      }
    }
    setState((s) => ({
      ...s,
      chats: s.chats.map((c) =>
        c.id === chatId
          ? {
              ...c,
              messages: c.messages.map((m) => (m.id === final.id ? final : m)),
              lastMessage: c.lastMessage?.id === final.id ? final : c.lastMessage,
            }
          : c,
      ),
    }))
  }, [state.me])

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
      const trimmed = text.trim()
      if (!trimmed) return
      const chat = chatsRef.current.find((c) => c.id === chatId)
      const peerId = chat && chat.kind === 'dm' && state.me
        ? chat.participants.find((p) => p !== state.me?.id) ?? null
        : null
      let payload = trimmed
      let sealed = false
      if (peerId && state.me) {
        try {
          payload = await encryptForUser(state.me.id, peerId, trimmed)
          sealed = true
        } catch (err) {
          console.warn('encrypt edit failed, sending plaintext', err)
        }
      }
      const apiMsg = await api.editMessage(chatId, messageId, payload, sealed)
      const msg: Message = {
        ...msgFromApi(apiMsg),
        authorId: state.me ? state.me.id : apiMsg.authorId,
        text: trimmed,
      }
      if (peerId) {
        rememberOutgoing(msg.id, trimmed).catch(() => {})
      }
      await applyMessageEdit(chatId, msg)
    },
    [applyMessageEdit, state.me],
  )

  const deleteMessage = useCallback(
    async (chatId: string, messageId: string) => {
      await api.deleteMessage(chatId, messageId)
      applyMessageDelete(chatId, messageId, Date.now())
    },
    [applyMessageDelete],
  )

  const applyReactionEvent = useCallback(
    (chatId: string, messageId: string, userId: string, emoji: string, added: boolean) => {
      const me = state.me?.id
      const update = (msg: Message): Message => {
        const reactions = (msg.reactions ?? []).slice()
        const idx = reactions.findIndex((r) => r.emoji === emoji)
        if (added) {
          if (idx < 0) {
            reactions.push({ emoji, count: 1, mine: userId === me })
          } else {
            const cur = reactions[idx]
            // Avoid double-counting our own optimistic +1.
            if (userId === me && cur.mine) return msg
            reactions[idx] = {
              ...cur,
              count: cur.count + 1,
              mine: cur.mine || userId === me,
            }
          }
        } else if (idx >= 0) {
          const cur = reactions[idx]
          if (userId === me && !cur.mine) return msg
          const nextCount = cur.count - 1
          if (nextCount <= 0) {
            reactions.splice(idx, 1)
          } else {
            reactions[idx] = {
              ...cur,
              count: nextCount,
              mine: userId === me ? false : cur.mine,
            }
          }
        }
        return { ...msg, reactions }
      }
      setState((s) => ({
        ...s,
        chats: s.chats.map((c) =>
          c.id === chatId
            ? {
                ...c,
                messages: c.messages.map((m) => (m.id === messageId ? update(m) : m)),
              }
            : c,
        ),
      }))
    },
    [state.me?.id],
  )

  const toggleReaction = useCallback(
    async (chatId: string, messageId: string, emoji: string) => {
      const me = state.me?.id
      if (!me) return
      // Optimistic apply; the server is source of truth via WS broadcast,
      // which will deduplicate using the (mine && already-true) check above.
      const chat = chatsRef.current.find((c) => c.id === chatId)
      const cur = chat?.messages.find((m) => m.id === messageId)
      const mine = cur?.reactions?.find((r) => r.emoji === emoji)?.mine ?? false
      applyReactionEvent(chatId, messageId, me, emoji, !mine)
      try {
        await api.toggleReaction(chatId, messageId, emoji)
      } catch (e) {
        // Revert on failure.
        applyReactionEvent(chatId, messageId, me, emoji, mine)
        throw e
      }
    },
    [state.me?.id, applyReactionEvent],
  )

  const patchChat = useCallback(
    async (
      chatId: string,
      patch: { title?: string; description?: string; isPublic?: boolean },
    ) => {
      const updated = chatFromApi(await api.patchChat(chatId, patch), state.me?.id)
      setState((s) => ({
        ...s,
        chats: s.chats.map((c) =>
          c.id === chatId
            ? { ...c, ...updated, messages: c.messages, lastMessage: c.lastMessage }
            : c,
        ),
      }))
    },
    [state.me?.id],
  )

  const joinViaInvite = useCallback(async (token: string) => {
    const chat = chatFromApi(await api.joinViaInvite(token), state.me?.id)
    setState((s) => {
      const exists = s.chats.find((c) => c.id === chat.id)
      const chats = exists
        ? s.chats.map((c) => (c.id === chat.id ? chat : c))
        : [chat, ...s.chats]
      return { ...s, chats: chats.sort(sortChats) }
    })
    return chat.id
  }, [state.me?.id])

  const addIncomingMessage = useCallback(
    async (chatId: string, msg: Message) => {
      // Only DM chats are E2E-encrypted; group/channel ciphertext (if any)
      // is not for us — treat it as plaintext to avoid corrupting state with
      // empty-string decrypt failures.
      const chat = chatsRef.current.find((c) => c.id === chatId)
      // Sealed-sender messages arrive with authorId="". Two possibilities:
      // (a) sent by a peer — attribute to the other DM participant; (b) sent
      // by one of our own sibling devices — attribute to me. We detect (b)
      // by inspecting the envelope's sender deviceId against the list of
      // devices registered under our account.
      let attributed = msg
      if (state.me && msg.sealed && !msg.authorId && isEncryptedEnvelope(msg.text)) {
        if (await isOwnEnvelope(state.me.id, msg.text)) {
          attributed = { ...msg, authorId: state.me.id }
        }
      }
      const incoming = state.me ? deanonymise(state.me, chat, attributed) : attributed
      let final = incoming
      const isDm = chat?.kind === 'dm'
      if (isDm && isEncryptedEnvelope(incoming.text) && state.me) {
        if (incoming.authorId === state.me.id) {
          // Our own outgoing ciphertext. The sending device cached it locally
          // before send; sibling devices fall back to decrypting the
          // self-sync entry inside the multi-recipient envelope.
          const cached = await recallOutgoing(incoming.id)
          if (cached !== undefined) {
            final = { ...incoming, text: cached }
          } else {
            const plain = await decryptOnce(
              incoming.id,
              state.me.id,
              incoming.authorId,
              incoming.text,
            )
            if (plain) rememberOutgoing(incoming.id, plain).catch(() => {})
            final = { ...incoming, text: plain }
          }
        } else {
          const cached = await recallIncoming(incoming.id)
          const plain =
            cached !== undefined
              ? cached
              : await decryptOnce(
                  incoming.id,
                  state.me.id,
                  incoming.authorId,
                  incoming.text,
                )
          if (cached === undefined && plain) {
            rememberIncoming(incoming.id, plain).catch(() => {})
          }
          final = { ...incoming, text: plain }
        }
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
      const chat = chatFromApi(await api.createChat(body), state.me?.id)
      setState((s) => {
        const existing = s.chats.find((c) => c.id === chat.id)
        const chats = existing
          ? s.chats.map((c) => (c.id === chat.id ? chat : c))
          : [chat, ...s.chats]
        return { ...s, chats: chats.sort(sortChats) }
      })
      return chat.id
    },
    [state.me?.id],
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

  const addPost = useCallback(
    async (
      text: string,
      media: NewsPost['media'] = [],
      opts: { title?: string; communityId?: string } = {},
    ) => {
      const trimmed = text.trim()
      if (!trimmed && (!media || media.length === 0) && !opts.title?.trim()) return
      const p = postFromApi(
        await api.createPost({
          text: trimmed,
          title: opts.title?.trim() || undefined,
          communityId: opts.communityId || undefined,
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
    },
    [],
  )

  const votePost = useCallback(async (id: string, value: -1 | 0 | 1) => {
    const p = postFromApi(await api.votePost(id, value))
    setState((s) => ({
      ...s,
      news: s.news.map((n) => (n.id === id ? p : n)),
    }))
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
    async (patch: {
      name?: string
      bio?: string
      phone?: string
      avatarUrl?: string | null
      links?: string[]
    }) => {
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
      setPasscode,
      clearPasscode,
      signup,
      login,
      loginByPair,
      logout,
      sendMessage,
      editMessage,
      deleteMessage,
      toggleReaction,
      applyReactionEvent,
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
      votePost,
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
      setPasscode,
      clearPasscode,
      signup,
      login,
      loginByPair,
      logout,
      sendMessage,
      editMessage,
      deleteMessage,
      toggleReaction,
      applyReactionEvent,
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
      votePost,
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
