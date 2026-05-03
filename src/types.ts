export type Lang = 'en' | 'ru'
export type Theme = 'light' | 'dark' | 'paper' | 'inverse'
export type Wallpaper = 'none' | 'dots' | 'grid' | 'noise' | 'ink' | 'lines' | 'waves'

export type FontSize = 'sm' | 'md' | 'lg'

export type Prefs = {
  theme: Theme
  wallpaper: Wallpaper
  animations: boolean
  reduceMotion: boolean
  sounds: boolean
  muteAll: boolean
  readReceipts: boolean
  lastSeen: boolean
  twoStep: boolean
  passcode: boolean
  compactMode: boolean
  fontSize: FontSize
  /** When true, follow the OS dark/light preference and override `theme`. */
  autoNight: boolean
  /** Show desktop / system notifications on incoming messages. */
  notifications: boolean
}

export type User = {
  id: string
  name: string
  handle: string
  bio: string
  kind?: 'user' | 'bot' | 'channel' | 'group'
  lastSeen?: number
  blocked?: boolean
  isContact?: boolean
  phone?: string
  avatarUrl?: string | null
  /** Compact JSON config (see `AvatarSVG.tsx`) describing a paper-doll
   * avatar drawn client-side. Takes precedence over `avatarUrl` when set. */
  avatarSvg?: string | null
  links?: string[]
  /** Free-form short status (e.g. "👋 hi"). Public. */
  status?: string | null
  /** Presence privacy — controls whether this user's `lastSeen` is exposed. */
  presence?: 'everyone' | 'contacts' | 'nobody'
  /** Phone-number visibility (independent of presence). */
  phoneVisibility?: 'everyone' | 'contacts' | 'nobody'
  /** Discoverability via /users/search. */
  searchVisibility?: 'everyone' | 'contacts' | 'nobody'
}

export type ReactionAgg = {
  emoji: string
  count: number
  mine: boolean
}

export type Message = {
  id: string
  authorId: string
  text: string
  at: number
  editedAt?: number | null
  deletedAt?: number | null
  replyToId?: string | null
  /** True for sealed-sender DM messages. The server returns an empty
   * `authorId`; the client substitutes the inferred sender (the other
   * participant in the DM). */
  sealed?: boolean
  pinned?: boolean
  pinnedAt?: number | null
  /** Optional thread/topic id when posted into a sub-thread. */
  topicId?: string | null
  reactions?: ReactionAgg[]
}

export type ChatRole = 'owner' | 'admin' | 'member'

export type Chat = {
  id: string
  title: string
  kind: 'dm' | 'group' | 'channel' | 'saved'
  description?: string
  isPublic?: boolean
  slowModeSeconds?: number
  subscribersOnly?: boolean
  signedPosts?: boolean
  autoDeleteSeconds?: number
  /** Admin content gates (server enforces these on POST too). */
  banMedia?: boolean
  banVoice?: boolean
  banStickers?: boolean
  banLinks?: boolean
  /** When true, threads (Topics) are available inside this chat. */
  topicsEnabled?: boolean
  createdBy?: string
  participants: string[]
  messages: Message[]
  pinned?: boolean
  muted?: boolean
  role?: ChatRole
  updatedAt?: number
  lastMessage?: Message | null
}

export type CalendarEvent = {
  id: string
  title: string
  date: string
  start?: string
  end?: string
  notes?: string
}

export type Note = {
  id: string
  title: string
  body: string
  tags: string[]
  updatedAt: number
  createdAt: number
}

export type PostMediaItem = {
  url: string
  kind: 'image' | 'video' | 'audio' | 'file'
  name: string
  mime: string
  size: number
}

export type NewsPost = {
  id: string
  authorId: string
  text: string
  at: number
  likes: number
  reposts: number
  replies: number
  liked?: boolean
  reposted?: boolean
  media?: PostMediaItem[]
  communityId?: string
  title?: string
  score?: number
  ups?: number
  downs?: number
  myVote?: -1 | 0 | 1
}

export type Community = {
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

export type PostComment = {
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

export type ChatFolder = {
  id: string
  name: string
  sortOrder: number
  chatIds: string[]
}

export type Topic = {
  id: string
  chatId: string
  title: string
  icon: string
  createdBy: string
  createdAt: number
  closed: boolean
  lastMessageAt: number
}

export type AdminLogEntry = {
  id: number
  chatId: string
  actorId: string
  targetKind: string
  targetId: string
  action: string
  payload: Record<string, string | number | boolean | null>
  createdAt: number
}

export type InviteRequest = {
  id: number
  chatId: string
  userId: string
  inviteToken: string
  note: string
  status: 'pending' | 'approved' | 'denied'
  createdAt: number
}

export const defaultPrefs: Prefs = {
  theme: 'light',
  wallpaper: 'dots',
  animations: true,
  reduceMotion: false,
  sounds: true,
  muteAll: false,
  readReceipts: true,
  lastSeen: true,
  twoStep: false,
  passcode: false,
  compactMode: false,
  fontSize: 'md',
  autoNight: false,
  notifications: false,
}
