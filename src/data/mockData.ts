import type { AppState } from '../types'

const now = Date.now()
const mins = (n: number) => now - n * 60 * 1000
const hours = (n: number) => now - n * 60 * 60 * 1000
const days = (n: number) => now - n * 24 * 60 * 60 * 1000

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const today = new Date()
const tomorrow = new Date(today.getTime() + 86400000)
const in3 = new Date(today.getTime() + 3 * 86400000)
const yesterday = new Date(today.getTime() - 86400000)

export const defaultState: AppState = {
  lang: 'en',
  onboarded: false,
  prefs: {
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
  },
  me: {
    id: 'me',
    name: 'You',
    handle: '@you',
    bio: 'Just exploring docot.',
    kind: 'user',
    phone: '+7 ••• ••• ••••',
  },
  contacts: [
    { id: 'u1', name: 'Emma Torreaux', handle: '@emma', bio: 'Designer. Coffee ≥ sleep.', kind: 'user', lastSeen: hours(1), isContact: true, phone: '+1 555 01-34' },
    { id: 'u2', name: 'Roberto', handle: '@rob', bio: 'Say hello to Emma.', kind: 'user', lastSeen: hours(6), isContact: true },
    { id: 'u3', name: '8Bit Times', handle: '@8bit', bio: 'Retro news channel. Live stream every Friday.', kind: 'channel' },
    { id: 'u4', name: 'Digital Nomads', handle: '@nomads', bio: 'Traveling the world. 2,500+ members.', kind: 'group' },
    { id: 'u5', name: 'Jennie', handle: '@jen', bio: 'We just reached 2,500 members!', kind: 'user', lastSeen: mins(45), isContact: true },
    { id: 'u6', name: 'Penelope', handle: '@pen', bio: 'Reading more books this year.', kind: 'user', lastSeen: mins(15), isContact: true },
    { id: 'u7', name: 'Translator Bot', handle: '@translate_bot', bio: 'Instant translation in 140+ languages.', kind: 'bot' },
  ],
  chats: [
    {
      id: 'c1',
      title: 'Saved Messages',
      kind: 'dm',
      participants: ['me'],
      pinned: true,
      messages: [
        { id: 'm1', authorId: 'me', text: 'Ideas for docot launch', at: days(2) },
        { id: 'm2', authorId: 'me', text: 'Design reference: Telegram + Twitter, b/w only.', at: days(1) },
        { id: 'm3', authorId: 'me', text: 'Check [[Launch plan]] note.', at: hours(3) },
      ],
    },
    {
      id: 'c2',
      title: 'Emma Torreaux',
      kind: 'dm',
      participants: ['me', 'u1'],
      messages: [
        { id: 'm1', authorId: 'u1', text: 'Hey, did you see the new mockups?', at: hours(5) },
        { id: 'm2', authorId: 'me', text: 'Yes — loving the bold italics.', at: hours(4) },
        { id: 'm3', authorId: 'u1', text: 'Bob says hi.', at: hours(1) },
      ],
    },
    {
      id: 'c3',
      title: 'Roberto',
      kind: 'dm',
      participants: ['me', 'u2'],
      messages: [
        { id: 'm1', authorId: 'u2', text: 'Say hello to Emma.', at: hours(6) },
      ],
    },
    {
      id: 'c4',
      title: '8Bit Times',
      kind: 'channel',
      participants: ['me', 'u3'],
      messages: [
        { id: 'm1', authorId: 'u3', text: '8Bit Times started a Live Stream', at: hours(2) },
      ],
    },
    {
      id: 'c5',
      title: 'Digital Nomads',
      kind: 'group',
      participants: ['me', 'u4', 'u5'],
      messages: [
        { id: 'm1', authorId: 'u5', text: 'We just reached 2,500 members!', at: mins(45) },
      ],
    },
    {
      id: 'c6',
      title: 'Penelope',
      kind: 'dm',
      participants: ['me', 'u6'],
      messages: [
        { id: 'm1', authorId: 'u6', text: 'Reading list for Q2?', at: mins(15) },
      ],
    },
    {
      id: 'c7',
      title: 'Translator Bot',
      kind: 'dm',
      participants: ['me', 'u7'],
      messages: [
        { id: 'm1', authorId: 'u7', text: 'Send me any text and I will translate it. /start', at: hours(8) },
      ],
    },
  ],
  events: [
    {
      id: 'e1',
      title: 'Launch meeting',
      date: iso(today),
      start: '10:00',
      end: '11:00',
      notes: 'Discuss docot rollout.',
      linkedNoteIds: ['n1'],
    },
    {
      id: 'e2',
      title: 'Gym',
      date: iso(today),
      start: '18:30',
      end: '19:30',
    },
    {
      id: 'e3',
      title: 'Coffee with Emma',
      date: iso(tomorrow),
      start: '09:00',
      end: '09:45',
    },
    {
      id: 'e4',
      title: 'Design review',
      date: iso(in3),
      start: '15:00',
      end: '16:00',
      linkedNoteIds: ['n2'],
    },
    {
      id: 'e5',
      title: 'Ship v0.1',
      date: iso(yesterday),
    },
  ],
  notes: [
    {
      id: 'n1',
      title: 'Launch plan',
      body: `# Launch plan

All-in-one black & white messenger.

Core pillars:
- [[Chats]]
- [[Calendar]]
- [[Notes]]
- [[News]]

Open questions:
- Pricing model?
- How to integrate [[Obsidian]]-style linking with a social feed?

See also: [[Brand voice]].`,
      tags: ['planning', 'docot'],
      createdAt: days(7),
      updatedAt: hours(2),
    },
    {
      id: 'n2',
      title: 'Brand voice',
      body: `# Brand voice

- Bold italic display type.
- Zero color. Only black and white.
- Speak short. Ship faster.

Refs: [[Launch plan]], [[Chats]].`,
      tags: ['brand'],
      createdAt: days(5),
      updatedAt: days(1),
    },
    {
      id: 'n3',
      title: 'Chats',
      body: `# Chats

Telegram-inspired list view, minimalist bubbles.
Supports DMs, groups, channels.

Linked from [[Launch plan]].`,
      tags: ['feature'],
      createdAt: days(4),
      updatedAt: days(2),
    },
    {
      id: 'n4',
      title: 'Calendar',
      body: `# Calendar

Month grid + agenda per day.
Events can link to notes via [[wiki-links]].`,
      tags: ['feature'],
      createdAt: days(3),
      updatedAt: days(1),
    },
    {
      id: 'n5',
      title: 'Notes',
      body: `# Notes

Obsidian-style. [[wiki-links]] create connections.
Build a personal knowledge graph inside docot.`,
      tags: ['feature'],
      createdAt: days(3),
      updatedAt: hours(6),
    },
    {
      id: 'n6',
      title: 'News',
      body: `# News

Twitter-inspired feed. Short posts, likes, reposts.
Follow people and channels.`,
      tags: ['feature'],
      createdAt: days(2),
      updatedAt: hours(4),
    },
    {
      id: 'n7',
      title: 'Obsidian',
      body: `# Obsidian

Reference knowledge base. Inspiration for [[Notes]].`,
      tags: ['reference'],
      createdAt: days(10),
      updatedAt: days(10),
    },
  ],
  news: [
    {
      id: 'p1',
      authorId: 'u1',
      text: 'Shipped the first docot screens today. Pure black on white. No gradients, no mercy.',
      at: hours(1),
      likes: 42,
      reposts: 7,
      replies: 3,
    },
    {
      id: 'p2',
      authorId: 'u3',
      text: 'Retro take: what if your calendar, chat and notes all lived in one place? Oh wait — docot.',
      at: hours(4),
      likes: 128,
      reposts: 24,
      replies: 11,
    },
    {
      id: 'p3',
      authorId: 'u5',
      text: 'Digital Nomads ch. reached 2,500 members on docot. Thanks everyone 🖤🤍',
      at: hours(6),
      likes: 310,
      reposts: 40,
      replies: 22,
    },
    {
      id: 'p4',
      authorId: 'u6',
      text: 'Reading list for this quarter:\n- Deep Work\n- Shape Up\n- The Psychology of Money',
      at: days(1),
      likes: 58,
      reposts: 9,
      replies: 5,
    },
  ],
}
