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
  avatarUrl: string | null
  avatarSvg: string | null
  status: string | null
  presence: 'everyone' | 'contacts' | 'nobody'
  links: string[]
  lastSeen: number | null
  isContact: boolean
  blocked: boolean
}

export type ApiReactionAgg = {
  emoji: string
  count: number
  mine: boolean
}

export type ApiPollOption = {
  id: number
  text: string
  votes: number
  mine: boolean
}

export type ApiPoll = {
  id: string
  chatId: string
  messageId: string
  question: string
  multiple: boolean
  anonymous: boolean
  createdBy: string
  createdAt: number
  closedAt: number | null
  options: ApiPollOption[]
  totalVoters: number
}

export type ApiMessage = {
  id: string
  authorId: string
  text: string
  at: number
  editedAt?: number | null
  deletedAt?: number | null
  replyToId?: string | null
  /** Sealed-sender messages have an empty `authorId`; clients fall back to the
   * other DM participant and verify identity via the inner Signal envelope. */
  sealed?: boolean
  pinned?: boolean
  pinnedAt?: number | null
  reactions?: ApiReactionAgg[]
}

export type ApiChat = {
  id: string
  kind: 'dm' | 'group' | 'channel' | 'saved'
  title: string
  description?: string
  isPublic?: boolean
  slowModeSeconds?: number
  subscribersOnly?: boolean
  signedPosts?: boolean
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

export type ApiEventRef = {
  kind: 'note' | 'post' | 'message'
  id: string
  title: string
  snippet: string
  chatId: string
  createdAt: number
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
  communityId?: string
  title?: string
  score?: number
  ups?: number
  downs?: number
  myVote?: -1 | 0 | 1
}

export type ApiCommunity = {
  id: string
  slug: string
  name: string
  description: string
  createdBy: string
  createdAt: number
  members: number
  joined: boolean
  role: string
}

export type ApiPostComment = {
  id: string
  postId: string
  parentId: string
  authorId: string
  text: string
  at: number
  score: number
  myVote: -1 | 0 | 1
  deleted: boolean
}

export type SortBy = 'hot' | 'new' | 'top'

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
  updateMe: (patch: {
    name?: string
    bio?: string
    phone?: string
    avatarUrl?: string | null
    avatarSvg?: string | null
    status?: string | null
    presence?: 'everyone' | 'contacts' | 'nobody'
    links?: string[]
  }) =>
    request<ApiUser>('/users/me', { method: 'PATCH', body: JSON.stringify(patch) }),

  // QR pairing — logged-in device generates a token, new device claims it.
  pairStart: () =>
    request<{ token: string; expires: number }>('/auth/pair/start', { method: 'POST' }),
  pairClaim: (token: string) =>
    request<{ token: string; user: ApiUser }>('/auth/pair/claim', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

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
  patchChat: (
    chatId: string,
    patch: {
      title?: string
      description?: string
      isPublic?: boolean
      slowModeSeconds?: number
      subscribersOnly?: boolean
      signedPosts?: boolean
    },
  ) =>
    request<ApiChat>(`/chats/${encodeURIComponent(chatId)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  sendMessage: (
    chatId: string,
    body: { text: string; replyToId?: string | null; sealed?: boolean },
  ) =>
    request<ApiMessage>(`/chats/${encodeURIComponent(chatId)}/messages`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  editMessage: (
    chatId: string,
    messageId: string,
    text: string,
    sealed?: boolean,
  ) =>
    request<ApiMessage>(
      `/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(
          sealed === undefined ? { text } : { text, sealed },
        ),
      },
    ),
  deleteMessage: (chatId: string, messageId: string) =>
    request<{ ok: boolean; id: string }>(
      `/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}`,
      { method: 'DELETE' },
    ),
  toggleReaction: (chatId: string, messageId: string, emoji: string) =>
    request<ApiReactionAgg[]>(
      `/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/reactions`,
      { method: 'POST', body: JSON.stringify({ emoji }) },
    ),
  pinMessage: (chatId: string, messageId: string) =>
    request<ApiMessage>(
      `/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/pin`,
      { method: 'POST' },
    ),
  unpinMessage: (chatId: string, messageId: string) =>
    request<ApiMessage>(
      `/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/pin`,
      { method: 'DELETE' },
    ),
  listPins: (chatId: string) =>
    request<ApiMessage[]>(`/chats/${encodeURIComponent(chatId)}/pins`),
  savedChat: () => request<ApiChat>('/chats/saved'),
  searchMessages: (q: string, chatId?: string) =>
    request<Array<{ chatId: string; chatTitle: string; message: ApiMessage }>>(
      `/chats/search?q=${encodeURIComponent(q)}${
        chatId ? `&chat_id=${encodeURIComponent(chatId)}` : ''
      }`,
    ),
  listBlocked: () => request<ApiUser[]>('/users/me/blocked'),
  deleteAccount: (handle: string) =>
    request<{ ok: boolean }>('/users/me', {
      method: 'DELETE',
      body: JSON.stringify({ handle }),
    }),
  createPoll: (
    chatId: string,
    body: { question: string; options: string[]; multiple?: boolean; anonymous?: boolean },
  ) =>
    request<ApiPoll>(`/chats/${encodeURIComponent(chatId)}/polls`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getPoll: (pollId: string) => request<ApiPoll>(`/polls/${encodeURIComponent(pollId)}`),
  votePoll: (pollId: string, optionIds: number[]) =>
    request<ApiPoll>(`/polls/${encodeURIComponent(pollId)}/vote`, {
      method: 'POST',
      body: JSON.stringify({ optionIds }),
    }),
  closePoll: (pollId: string) =>
    request<ApiPoll>(`/polls/${encodeURIComponent(pollId)}/close`, { method: 'POST' }),
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
  eventRefs: (id: string) =>
    request<{
      eventId: string
      notes: ApiEventRef[]
      posts: ApiEventRef[]
      messages: ApiEventRef[]
    }>(`/events/${encodeURIComponent(id)}/refs`),
  listNoteTags: () => request<{ tag: string; count: number }[]>('/notes/tags'),
  listNoteBacklinks: (id: string) => request<ApiNote[]>(`/notes/${encodeURIComponent(id)}/backlinks`),

  // posts
  listPosts: (params: { community?: string; sort?: SortBy; limit?: number } = {}) => {
    const qs = new URLSearchParams()
    if (params.community) qs.set('community', params.community)
    if (params.sort) qs.set('sort', params.sort)
    if (params.limit) qs.set('limit', String(params.limit))
    const s = qs.toString()
    return request<ApiPost[]>('/posts' + (s ? `?${s}` : ''))
  },
  getPost: (id: string) => request<ApiPost>(`/posts/${encodeURIComponent(id)}`),
  listMyPosts: () => request<ApiPost[]>('/posts/mine'),
  listMyReposts: () => request<ApiPost[]>('/posts/reposted'),
  createPost: (body: {
    text: string
    title?: string
    media?: ApiPostMedia[]
    communityId?: string
  }) => request<ApiPost>('/posts', { method: 'POST', body: JSON.stringify(body) }),
  deletePost: (id: string) =>
    request<{ ok: boolean }>(`/posts/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  likePost: (id: string) =>
    request<ApiPost>(`/posts/${encodeURIComponent(id)}/like`, { method: 'POST' }),
  votePost: (id: string, value: -1 | 0 | 1) =>
    request<ApiPost>(`/posts/${encodeURIComponent(id)}/vote`, {
      method: 'POST',
      body: JSON.stringify({ value }),
    }),
  repostPost: (id: string) =>
    request<ApiPost>(`/posts/${encodeURIComponent(id)}/repost`, { method: 'POST' }),

  // post comments
  listPostComments: (postId: string) =>
    request<ApiPostComment[]>(`/posts/${encodeURIComponent(postId)}/comments`),
  createPostComment: (postId: string, body: { text: string; parentId?: string }) =>
    request<ApiPostComment>(`/posts/${encodeURIComponent(postId)}/comments`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deletePostComment: (postId: string, commentId: string) =>
    request<{ ok: boolean }>(
      `/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
      { method: 'DELETE' },
    ),
  votePostComment: (postId: string, commentId: string, value: -1 | 0 | 1) =>
    request<ApiPostComment>(
      `/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}/vote`,
      { method: 'POST', body: JSON.stringify({ value }) },
    ),

  // communities
  listCommunities: (params: { joinedOnly?: boolean; q?: string } = {}) => {
    const qs = new URLSearchParams()
    if (params.joinedOnly) qs.set('joined_only', 'true')
    if (params.q) qs.set('q', params.q)
    const s = qs.toString()
    return request<ApiCommunity[]>('/communities' + (s ? `?${s}` : ''))
  },
  getCommunity: (slug: string) =>
    request<ApiCommunity>(`/communities/${encodeURIComponent(slug)}`),
  createCommunity: (body: { slug: string; name: string; description?: string }) =>
    request<ApiCommunity>('/communities', { method: 'POST', body: JSON.stringify(body) }),
  joinCommunity: (slug: string) =>
    request<ApiCommunity>(`/communities/${encodeURIComponent(slug)}/join`, { method: 'POST' }),
  leaveCommunity: (slug: string) =>
    request<ApiCommunity>(`/communities/${encodeURIComponent(slug)}/leave`, { method: 'POST' }),

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

  // E2E key bundles
  uploadBundle: (body: ApiKeyBundleIn) =>
    request<ApiKeyStatus>('/keys/bundle', { method: 'POST', body: JSON.stringify(body) }),
  replenishOneTime: (body: ApiOneTimePreKeysIn) =>
    request<ApiKeyStatus>('/keys/onetime', { method: 'POST', body: JSON.stringify(body) }),
  keysStatus: (deviceId: number) =>
    request<ApiKeyStatus>(`/keys/status?deviceId=${deviceId}`),
  /** All known device bundles for a user; senders fan out one envelope per device. */
  listUserDevices: (userId: string) =>
    request<ApiDeviceList>(`/keys/devices/${encodeURIComponent(userId)}`),
  getKeyBundleForDevice: (userId: string, deviceId: number) =>
    request<ApiKeyBundle>(
      `/keys/bundle/${encodeURIComponent(userId)}/${deviceId}`,
    ),

  // bot creation
  createBot: (body: { handle: string; name: string }) =>
    request<ApiUser>('/users/bots', { method: 'POST', body: JSON.stringify(body) }),

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

export type ApiOneTimePreKey = { keyId: number; publicKey: string }
export type ApiKeyBundleIn = {
  deviceId: number
  registrationId: number
  identityKey: string
  signedPreKeyId: number
  signedPreKey: string
  signedPreKeySignature: string
  oneTimePreKeys: ApiOneTimePreKey[]
}
export type ApiOneTimePreKeysIn = {
  deviceId: number
  keys: ApiOneTimePreKey[]
}
export type ApiKeyBundle = {
  userId: string
  deviceId: number
  registrationId: number
  identityKey: string
  signedPreKeyId: number
  signedPreKey: string
  signedPreKeySignature: string
  preKey: ApiOneTimePreKey | null
}
export type ApiKeyStatus = {
  hasBundle: boolean
  deviceId: number | null
  oneTimeRemaining: number
}
export type ApiDevice = {
  deviceId: number
  registrationId: number
  updatedAt: number
}
export type ApiDeviceList = {
  userId: string
  devices: ApiDevice[]
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
