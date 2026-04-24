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
  kind: 'dm' | 'group' | 'channel'
  participants: string[]
  messages: Message[]
  pinned?: boolean
}

export type CalendarEvent = {
  id: string
  title: string
  date: string
  start?: string
  end?: string
  notes?: string
  linkedNoteIds?: string[]
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

export type AppState = {
  lang: Lang
  prefs: Prefs
  me: User
  contacts: User[]
  chats: Chat[]
  events: CalendarEvent[]
  notes: Note[]
  news: NewsPost[]
  onboarded: boolean
}
