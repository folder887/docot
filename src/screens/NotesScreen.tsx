import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../store'
import { relTime, t } from '../i18n'
import { IconPlus } from '../components/Icons'
import type { Note } from '../types'

export function NotesScreen() {
  const { state, addNote } = useApp()
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'list' | 'graph'>('list')

  const notes = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...state.notes]
      .filter(
        (n) =>
          !q ||
          n.title.toLowerCase().includes(q) ||
          n.body.toLowerCase().includes(q) ||
          n.tags.some((tag) => tag.toLowerCase().includes(q)),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }, [state.notes, query])

  return (
    <div className="flex flex-col bg-white">
      <div className="sticky top-[57px] z-[5] flex flex-col gap-2 border-b-2 border-black bg-white p-3">
        <div className="flex gap-2">
          <input
            className="bw-input py-2 text-sm"
            placeholder={t('top.search', state.lang)}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            aria-label={t('notes.new', state.lang)}
            className="flex h-[44px] w-[44px] flex-shrink-0 items-center justify-center rounded-xl border-2 border-black bg-black text-white"
            onClick={() => {
              const title = window.prompt(t('notes.title', state.lang), 'New note')
              if (title) {
                const id = addNote(title)
                window.location.hash = `#/notes/${id}`
              }
            }}
          >
            <IconPlus size={20} />
          </button>
        </div>
        <div className="flex gap-2">
          <ModeBtn active={mode === 'list'} onClick={() => setMode('list')}>
            {t('notes.list', state.lang)}
          </ModeBtn>
          <ModeBtn active={mode === 'graph'} onClick={() => setMode('graph')}>
            {t('notes.graph', state.lang)}
          </ModeBtn>
        </div>
      </div>

      {mode === 'list' ? (
        notes.length === 0 ? (
          <p className="p-6 text-sm text-black/60">{t('notes.empty', state.lang)}</p>
        ) : (
          <ul>
            {notes.map((n) => (
              <li key={n.id} className="border-b border-black/15">
                <Link to={`/notes/${n.id}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-black hover:text-white">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold">{n.title}</div>
                    <div className="text-xs opacity-70">{relTime(n.updatedAt, state.lang)}</div>
                  </div>
                  <div className="line-clamp-2 text-sm opacity-80">{bodyPreview(n.body)}</div>
                  {n.tags.length > 0 && (
                    <div className="mt-1 flex gap-1">
                      {n.tags.map((tag) => (
                        <span key={tag} className="rounded-full border border-current px-2 text-[10px] font-bold uppercase">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : (
        <NoteGraph notes={notes} />
      )}
    </div>
  )
}

function ModeBtn({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-full border-2 border-black px-4 py-1 text-sm font-bold ${
        active ? 'bg-black text-white' : 'bg-white text-black'
      }`}
    >
      {children}
    </button>
  )
}

function bodyPreview(body: string) {
  return body
    .replace(/^#+\s?/gm, '')
    .replace(/\[\[(.+?)\]\]/g, '$1')
    .replace(/\n+/g, ' ')
    .trim()
}

function NoteGraph({ notes }: { notes: Note[] }) {
  const { ids, edges, positions } = useMemo(() => graphLayout(notes), [notes])
  const W = 380
  const H = 420
  return (
    <div className="flex items-center justify-center p-4">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="border-2 border-black">
        {edges.map((e, i) => {
          const a = positions[e.from]
          const b = positions[e.to]
          if (!a || !b) return null
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="black" strokeWidth={1.5} />
        })}
        {ids.map((id) => {
          const p = positions[id]
          const note = notes.find((n) => n.id === id)
          if (!p || !note) return null
          return (
            <g key={id} transform={`translate(${p.x},${p.y})`}>
              <a href={`#/notes/${id}`} onClick={(e) => { e.preventDefault(); window.location.hash = `#/notes/${id}`; }}>
                <circle r={16} fill="white" stroke="black" strokeWidth={2} />
                <text textAnchor="middle" y={30} fontSize={10} fontWeight={700}>
                  {note.title}
                </text>
              </a>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function graphLayout(notes: Note[]) {
  const ids = notes.map((n) => n.id)
  const titleToId = new Map<string, string>()
  notes.forEach((n) => titleToId.set(n.title.toLowerCase(), n.id))

  const edges: { from: string; to: string }[] = []
  for (const n of notes) {
    const m = n.body.matchAll(/\[\[([^\]]+)\]\]/g)
    for (const match of m) {
      const target = titleToId.get(match[1].toLowerCase())
      if (target && target !== n.id) edges.push({ from: n.id, to: target })
    }
  }

  const W = 380
  const H = 420
  const cx = W / 2
  const cy = H / 2
  const r = Math.min(W, H) / 2 - 50
  const positions: Record<string, { x: number; y: number }> = {}
  ids.forEach((id, i) => {
    const a = (i / Math.max(ids.length, 1)) * Math.PI * 2
    positions[id] = { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
  })

  return { ids, edges, positions }
}
