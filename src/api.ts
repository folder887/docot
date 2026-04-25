const DEFAULT_API = 'https://docot-backend-wvkjcktl.fly.dev'
export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || DEFAULT_API

const TOKEN_KEY = 'docot:token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
  const token = getToken()
  if (token) headers.set('authorization', `Bearer ${token}`)

  const res = await fetch(`${API_URL}${path}`, { ...init, headers })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const j = (await res.json()) as { detail?: string }
      if (j.detail) detail = j.detail
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/* Schemas */

export type ApiUser = {
  id: string
  handle: string
  name: string
  bio: string
  kind: 'user' | 'bot' | 'channel' | 'group'
  phone: string
  lastSeen: number | null
  isContact: boolean
  blocked: boolean
}

export type ApiMessage = {
  id: string
  authorId: string
  text: string
  at: number
  editedAt?: number | null
  deletedAt?: number | null
  replyToId?: string | null
}

export type ApiChat = {
  id: string
  kind: 'dm' | 'group' | 'channel' | 'saved'
  title: string
  description?: string
  isPublic?: boolean
  createdBy?: string
  participants: string[]
  pinned: boolean
  muted: boolean
  role?: 'owner' | 'admin' | 'member'
  updatedAt: number
  lastMessage: ApiMessage | null
  messages: ApiMessage[]
}

export type ApiChatMember = {
  userId: string
  role: 'owner' | 'admin' | 'member'
  joinedAt: number
}

export type ApiInvite = {
  token: string
  chatId: string
  createdBy: string
  createdAt: number
  expiresAt: number | null
  maxUses: number | null
  uses: number
  revoked: boolean
  url: string
}

export type ApiInviteInfo = {
  token: string
  chatId: string
  title: string
  kind: 'dm' | 'group' | 'channel'
  description: string
  memberCount: number
  valid: boolean
}

export type ApiPostMedia = {
  url: string
  kind: 'image' | 'video' | 'audio' | 'file'
  name: string
  mime: string
  size: number
}

export type ApiNote = {
  id: string
  title: string
  body: string
  tags: string[]
  createdAt: number
  updatedAt: number
}

export type ApiEvent = {
  id: string
  title: string
  date: string
  start: string
  end: string
  note: string
}

export type ApiPost = {
  id: string
  authorId: string
  text: string
  at: number
  likes: number
  reposts: number
  replies: number
  liked: boolean
  reposted: boolean
  media?: ApiPostMedia[]
}

export type ApiFolder = {
  id: string
  name: string
  sortOrder: number
  chatIds: string[]
}

/* API methods */

export const api = {
  // auth
  signup: (handle: string, name: string, password: string) =>
    request<{ token: string; user: ApiUser }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ handle, name, password }),
    }),
  login: (handle: string, password: string) =>
    request<{ token: string; user: ApiUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ handle, password }),
    }),
  me: () => request<ApiUser>('/auth/me'),
  updateMe: (patch: { name?: string; bio?: string; phone?: string }) =>
    request<ApiUser>('/users/me', { method: 'PATCH', body: JSON.stringify(patch) }),

  // users
  searchUsers: (q: string) =>
    request<ApiUser[]>(`/users/search?q=${encodeURIComponent(q)}`),
  getUser: (id: string) => request<ApiUser>(`/users/${encodeURIComponent(id)}`),
  listContacts: () => request<ApiUser[]>('/users'),
  addContact: (id: string) =>
    request<ApiUser>(`/users/${encodeURIComponent(id)}/contact`, { method: 'POST' }),
  removeContact: (id: string) =>
    request<ApiUser>(`/users/${encodeURIComponent(id)}/contact`, { method: 'DELETE' }),
  block: (id: string) =>
    request<ApiUser>(`/users/${encodeURIComponent(id)}/block`, { method: 'POST' }),
  unblock: (id: string) =>
    request<ApiUser>(`/users/${encodeURIComponent(id)}/unblock`, { method: 'POST' }),

  // chats
  listChats: () => request<ApiChat[]>('/chats'),
  getChat: (id: string) => request<ApiChat>(`/chats/${encodeURIComponent(id)}`),
  createChat: (body: {
    kind: 'dm' | 'group' | 'channel'
    title?: string
    description?: string
    isPublic?: boolean
    participantIds: string[]
  }) => request<ApiChat>('/chats', { method: 'POST', body: JSON.stringify(body) }),
  patchChat: (chatId: string, patch: { title?: string; description?: string; isPublic?: boolean }) =>
    request<ApiChat>(`/chats/${encodeURIComponent(chatId)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  sendMessage: (chatId: string, body: { text: string; replyToId?: string | null }) =>
    request<ApiMessage>(`/chats/${encodeURIComponent(chatId)}/messages`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  editMessage: (chatId: string, messageId: string, text: string) =>
    request<ApiMessage>(
      `/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}`,
      { method: 'PATCH', body: JSON.stringify({ text }) },
    ),
  deleteMessage: (chatId: string, messageId: string) =>
    request<{ ok: boolean; id: string }>(
      `/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}`,
      { method: 'DELETE' },
    ),
  listChatMembers: (chatId: string) =>
    request<ApiChatMember[]>(`/chats/${encodeURIComponent(chatId)}/members`),
  patchChatMember: (chatId: string, userId: string, role: 'owner' | 'admin' | 'member') =>
    request<ApiChatMember>(
      `/chats/${encodeURIComponent(chatId)}/members/${encodeURIComponent(userId)}`,
      { method: 'PATCH', body: JSON.stringify({ role }) },
    ),
  removeChatMember: (chatId: string, userId: string) =>
    request<{ ok: boolean }>(
      `/chats/${encodeURIComponent(chatId)}/members/${encodeURIComponent(userId)}`,
      { method: 'DELETE' },
    ),

  // invites
  listInvites: (chatId: string) =>
    request<ApiInvite[]>(`/chats/${encodeURIComponent(chatId)}/invites`),
  createInvite: (chatId: string, body?: { expiresAt?: number; maxUses?: number }) =>
    request<ApiInvite>(`/chats/${encodeURIComponent(chatId)}/invites`, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    }),
  revokeInvite: (token: string) =>
    request<{ ok: boolean }>(`/invites/${encodeURIComponent(token)}`, { method: 'DELETE' }),
  getInviteInfo: (token: string) =>
    request<ApiInviteInfo>(`/invites/${encodeURIComponent(token)}`),
  joinViaInvite: (token: string) =>
    request<ApiChat>(`/invites/${encodeURIComponent(token)}/join`, { method: 'POST' }),
  pinChat: (chatId: string, pinned: boolean) =>
    request<{ ok: boolean }>(
      `/chats/${encodeURIComponent(chatId)}/pin?pinned=${pinned ? 'true' : 'false'}`,
      { method: 'POST' },
    ),
  muteChat: (chatId: string, muted: boolean) =>
    request<{ ok: boolean }>(
      `/chats/${encodeURIComponent(chatId)}/mute?muted=${muted ? 'true' : 'false'}`,
      { method: 'POST' },
    ),
  deleteChat: (chatId: string) =>
    request<{ ok: boolean }>(`/chats/${encodeURIComponent(chatId)}`, { method: 'DELETE' }),

  // notes
  listNotes: () => request<ApiNote[]>('/notes'),
  createNote: (body: { title: string; body?: string; tags?: string[] }) =>
    request<ApiNote>('/notes', {
      method: 'POST',
      body: JSON.stringify({ body: '', tags: [], ...body }),
    }),
  updateNote: (id: string, patch: { title?: string; body?: string; tags?: string[] }) =>
    request<ApiNote>(`/notes/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteNote: (id: string) =>
    request<{ ok: boolean }>(`/notes/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // events
  listEvents: () => request<ApiEvent[]>('/events'),
  createEvent: (body: { title: string; date: string; start: string; end: string; note?: string }) =>
    request<ApiEvent>('/events', {
      method: 'POST',
      body: JSON.stringify({ note: '', ...body }),
    }),
  updateEvent: (id: string, body: { title: string; date: string; start: string; end: string; note?: string }) =>
    request<ApiEvent>(`/events/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ note: '', ...body }),
    }),
  deleteEvent: (id: string) =>
    request<{ ok: boolean }>(`/events/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // posts
  listPosts: () => request<ApiPost[]>('/posts'),
  listMyPosts: () => request<ApiPost[]>('/posts/mine'),
  listMyReposts: () => request<ApiPost[]>('/posts/reposted'),
  createPost: (body: { text: string; media?: ApiPostMedia[] }) =>
    request<ApiPost>('/posts', { method: 'POST', body: JSON.stringify(body) }),
  deletePost: (id: string) =>
    request<{ ok: boolean }>(`/posts/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  likePost: (id: string) => request<ApiPost>(`/posts/${encodeURIComponent(id)}/like`, { method: 'POST' }),
  repostPost: (id: string) => request<ApiPost>(`/posts/${encodeURIComponent(id)}/repost`, { method: 'POST' }),

  // folders
  listFolders: () => request<ApiFolder[]>('/folders'),
  createFolder: (body: { name: string; chatIds?: string[] }) =>
    request<ApiFolder>('/folders', {
      method: 'POST',
      body: JSON.stringify({ chatIds: [], ...body }),
    }),
  updateFolder: (id: string, patch: { name?: string; chatIds?: string[] }) =>
    request<ApiFolder>(`/folders/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteFolder: (id: string) =>
    request<{ ok: boolean }>(`/folders/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // uploads
  uploadFile: async (file: Blob, filename = 'file'): Promise<ApiUpload> => {
    const fd = new FormData()
    fd.append('file', file, filename)
    const headers = new Headers()
    const token = getToken()
    if (token) headers.set('authorization', `Bearer ${token}`)
    const res = await fetch(`${API_URL}/uploads`, { method: 'POST', body: fd, headers })
    if (!res.ok) throw new ApiError(res.status, res.statusText)
    return (await res.json()) as ApiUpload
  },
}

export type ApiUpload = {
  id: string
  name: string
  url: string
  size: number
  type: string
  ownerId: string
}

export function uploadUrl(path: string): string {
  if (!path) return ''
  if (path.startsWith('http')) return path
  return `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`
}

export function openChatWebSocket(chatId: string, token: string): WebSocket {
  const url = new URL(API_URL.replace(/^http/, 'ws') + '/chats/ws')
  url.searchParams.set('token', token)
  url.searchParams.set('chatId', chatId)
  return new WebSocket(url.toString())
}
