export type Lang = 'en' | 'ru'

export type User = {
  id: string
  name: string
  handle: string
  bio: string
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
  me: User
  contacts: User[]
  chats: Chat[]
  events: CalendarEvent[]
  notes: Note[]
  news: NewsPost[]
  onboarded: boolean
}
