import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppState, CalendarEvent, Chat, Lang, Message, Note, NewsPost, Prefs, User } from './types'
import { defaultState } from './data/mockData'

const STORAGE_KEY = 'docot:v2'

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState
    const parsed = JSON.parse(raw) as Partial<AppState>
    return {
      ...defaultState,
      ...parsed,
      prefs: { ...defaultState.prefs, ...(parsed.prefs ?? {}) },
    }
  } catch {
    return defaultState
  }
}

function saveState(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore quota
  }
}

type Ctx = {
  state: AppState
  setLang: (l: Lang) => void
  setPrefs: (patch: Partial<Prefs>) => void
  completeOnboarding: (name: string, handle: string) => void
  logout: () => void
  sendMessage: (chatId: string, text: string) => void
  addChat: (title: string, kind?: Chat['kind']) => string
  pinChat: (chatId: string, pinned: boolean) => void
  addEvent: (ev: Omit<CalendarEvent, 'id'>) => void
  updateEvent: (id: string, patch: Partial<CalendarEvent>) => void
  deleteEvent: (id: string) => void
  addNote: (title: string) => string
  updateNote: (id: string, patch: Partial<Note>) => void
  deleteNote: (id: string) => void
  addPost: (text: string) => void
  toggleLike: (id: string) => void
  repost: (id: string) => void
  updateMe: (patch: Partial<AppState['me']>) => void
  updateContact: (id: string, patch: Partial<User>) => void
  resetAll: () => void
  peerOf: (chat: Chat) => User | null
  userById: (id: string) => User | null
}

const AppCtx = createContext<Ctx | null>(null)

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState())

  useEffect(() => {
    saveState(state)
  }, [state])

  const setLang = useCallback((lang: Lang) => {
    setState((s) => ({ ...s, lang }))
  }, [])

  const setPrefs = useCallback((patch: Partial<Prefs>) => {
    setState((s) => ({ ...s, prefs: { ...s.prefs, ...patch } }))
  }, [])

  const pinChat = useCallback((chatId: string, pinned: boolean) => {
    setState((s) => ({
      ...s,
      chats: s.chats.map((c) => (c.id === chatId ? { ...c, pinned } : c)),
    }))
  }, [])

  const updateContact = useCallback((id: string, patch: Partial<User>) => {
    setState((s) => ({
      ...s,
      contacts: s.contacts.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }))
  }, [])

  const completeOnboarding = useCallback((name: string, handle: string) => {
    setState((s) => ({
      ...s,
      onboarded: true,
      me: {
        ...s.me,
        name: name || s.me.name,
        handle: handle.startsWith('@') ? handle : `@${handle || s.me.handle.replace('@', '')}`,
      },
    }))
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setState(defaultState)
  }, [])

  const sendMessage = useCallback((chatId: string, text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    setState((s) => ({
      ...s,
      chats: s.chats.map((c) =>
        c.id === chatId
          ? {
              ...c,
              messages: [
                ...c.messages,
                { id: uid('m'), authorId: 'me', text: trimmed, at: Date.now() } satisfies Message,
              ],
            }
          : c,
      ),
    }))
  }, [])

  const addChat = useCallback((title: string, kind: Chat['kind'] = 'dm') => {
    const id = uid('c')
    setState((s) => ({
      ...s,
      chats: [
        { id, title, kind, participants: ['me'], messages: [] },
        ...s.chats,
      ],
    }))
    return id
  }, [])

  const addEvent = useCallback((ev: Omit<CalendarEvent, 'id'>) => {
    setState((s) => ({
      ...s,
      events: [...s.events, { ...ev, id: uid('e') }],
    }))
  }, [])

  const updateEvent = useCallback((id: string, patch: Partial<CalendarEvent>) => {
    setState((s) => ({
      ...s,
      events: s.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }))
  }, [])

  const deleteEvent = useCallback((id: string) => {
    setState((s) => ({ ...s, events: s.events.filter((e) => e.id !== id) }))
  }, [])

  const addNote = useCallback((title: string) => {
    const id = uid('n')
    const now = Date.now()
    setState((s) => ({
      ...s,
      notes: [
        { id, title: title || 'Untitled', body: `# ${title || 'Untitled'}\n\n`, tags: [], createdAt: now, updatedAt: now },
        ...s.notes,
      ],
    }))
    return id
  }, [])

  const updateNote = useCallback((id: string, patch: Partial<Note>) => {
    setState((s) => ({
      ...s,
      notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)),
    }))
  }, [])

  const deleteNote = useCallback((id: string) => {
    setState((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) }))
  }, [])

  const addPost = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const post: NewsPost = {
      id: uid('p'),
      authorId: 'me',
      text: trimmed,
      at: Date.now(),
      likes: 0,
      reposts: 0,
      replies: 0,
    }
    setState((s) => ({ ...s, news: [post, ...s.news] }))
  }, [])

  const toggleLike = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      news: s.news.map((p) =>
        p.id === id
          ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 }
          : p,
      ),
    }))
  }, [])

  const repost = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      news: s.news.map((p) => (p.id === id ? { ...p, reposts: p.reposts + 1 } : p)),
    }))
  }, [])

  const updateMe = useCallback((patch: Partial<AppState['me']>) => {
    setState((s) => ({ ...s, me: { ...s.me, ...patch } }))
  }, [])

  const resetAll = useCallback(() => {
    setState(defaultState)
  }, [])

  const userById = useCallback(
    (id: string): User | null => {
      if (id === 'me') return state.me
      return state.contacts.find((c) => c.id === id) ?? null
    },
    [state.me, state.contacts],
  )

  const peerOf = useCallback(
    (chat: Chat): User | null => {
      if (chat.kind !== 'dm') return null
      const otherId = chat.participants.find((p) => p !== 'me')
      if (!otherId) return null
      return userById(otherId)
    },
    [userById],
  )

  const value = useMemo<Ctx>(
    () => ({
      state,
      setLang,
      setPrefs,
      completeOnboarding,
      logout,
      sendMessage,
      addChat,
      pinChat,
      addEvent,
      updateEvent,
      deleteEvent,
      addNote,
      updateNote,
      deleteNote,
      addPost,
      toggleLike,
      repost,
      updateMe,
      updateContact,
      resetAll,
      peerOf,
      userById,
    }),
    [
      state,
      setLang,
      setPrefs,
      completeOnboarding,
      logout,
      sendMessage,
      addChat,
      pinChat,
      addEvent,
      updateEvent,
      deleteEvent,
      addNote,
      updateNote,
      deleteNote,
      addPost,
      toggleLike,
      repost,
      updateMe,
      updateContact,
      resetAll,
      peerOf,
      userById,
    ],
  )

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): Ctx {
  const ctx = useContext(AppCtx)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}
