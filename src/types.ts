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
}

export type Message = {
  id: string
  authorId: string
  text: string
  at: number
}

export type Chat = {
  id: string
  title: string
  kind: 'dm' | 'group' | 'channel' | 'saved'
  participants: string[]
  messages: Message[]
  pinned?: boolean
  muted?: boolean
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

export type NewsPost = {
  id: string
  authorId: string
  text: string
  at: number
  likes: number
  reposts: number
  replies: number
  liked?: boolean
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
