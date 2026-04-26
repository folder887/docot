export type Lang = 'en' | 'ru'
export type Theme = 'light' | 'dark' | 'paper' | 'inverse'
export type Wallpaper = 'none' | 'dots' | 'grid' | 'noise' | 'ink' | 'lines' | 'waves'

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
  links?: string[]
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
}

export type ChatFolder = {
  id: string
  name: string
  sortOrder: number
  chatIds: string[]
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
}
