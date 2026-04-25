import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../store'
import { t } from '../i18n'
import { ScreenHeader } from '../components/ScreenHeader'
import { IconTrash } from '../components/Icons'
import { ConfirmDialog } from '../components/Modal'
import type { Note } from '../types'

export function NoteDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const { state } = useApp()
  const note = useMemo(() => state.notes.find((n) => n.id === id), [id, state.notes])
  if (!note) {
    return (
      <div className="flex h-full flex-col">
        <ScreenHeader title="Note" />
        <div className="p-6 text-black/60">Note not found.</div>
      </div>
    )
  }
  return <NoteEditor key={note.id} note={note} />
}

function NoteEditor({ note }: { note: Note }) {
  const { state, updateNote, deleteNote } = useApp()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(note.title)
  const [body, setBody] = useState(note.body)
  const [confirmDel, setConfirmDel] = useState(false)

  const backlinks = useMemo(() => {
    const needle = note.title.toLowerCase()
    return state.notes.filter(
      (n) =>
        n.id !== note.id &&
        Array.from(n.body.matchAll(/\[\[([^\]]+)\]\]/g)).some((m) => m[1].toLowerCase() === needle),
    )
  }, [note, state.notes])

  const links = useMemo(() => {
    const titles = Array.from(note.body.matchAll(/\[\[([^\]]+)\]\]/g)).map((m) => m[1])
    const set = new Set(titles.map((t) => t.toLowerCase()))
    return state.notes.filter((n) => set.has(n.title.toLowerCase()) && n.id !== note.id)
  }, [note, state.notes])

  return (
    <div className="flex min-h-0 flex-col bg-white">
      <ScreenHeader
        title={editing ? t('notes.title', state.lang) : note.title}
        right={
          <div className="flex gap-1">
            <button
              className="rounded-full border-2 border-black px-3 py-1 text-xs font-bold"
              onClick={() => {
                if (editing) {
                  void updateNote(note.id, { title: title.trim() || 'Untitled', body })
                }
                setEditing((e) => !e)
              }}
            >
              {editing ? t('notes.save', state.lang) : '✎'}
            </button>
            <button
              aria-label={t('notes.delete', state.lang)}
              className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-black"
              onClick={() => setConfirmDel(true)}
            >
              <IconTrash size={14} />
            </button>
          </div>
        }
      />
      <ConfirmDialog
        open={confirmDel}
        message={t('note.delete.confirm', state.lang)}
        okLabel={t('common.delete', state.lang)}
        cancelLabel={t('common.cancel', state.lang)}
        destructive
        onResolve={(ok) => {
          setConfirmDel(false)
          if (ok) {
            void deleteNote(note.id)
            navigate('/notes', { replace: true })
          }
        }}
      />
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {editing ? (
          <>
            <input
              className="bw-input text-xl font-black"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('notes.title', state.lang)}
            />
            <textarea
              className="bw-input min-h-[300px] font-mono text-sm leading-relaxed"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t('notes.body', state.lang)}
            />
          </>
        ) : (
          <article className="prose-sm text-sm leading-relaxed">
            <RenderMarkdown body={note.body} notes={state.notes} />
          </article>
        )}

        {!editing && (links.length > 0 || backlinks.length > 0) && (
          <section className="mt-4 flex flex-col gap-3">
            {links.length > 0 && (
              <div>
                <div className="text-xs font-black uppercase tracking-wide">{t('notes.links', state.lang)}</div>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {links.map((l) => (
                    <li key={l.id}>
                      <Link to={`/notes/${l.id}`} className="bw-chip">
                        {l.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {backlinks.length > 0 && (
              <div>
                <div className="text-xs font-black uppercase tracking-wide">{t('notes.backlinks', state.lang)}</div>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {backlinks.map((l) => (
                    <li key={l.id}>
                      <Link to={`/notes/${l.id}`} className="bw-chip">
                        {l.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

function RenderMarkdown({
  body,
  notes,
}: {
  body: string
  notes: { id: string; title: string }[]
}) {
  const titleToId = useMemo(() => {
    const m = new Map<string, string>()
    notes.forEach((n) => m.set(n.title.toLowerCase(), n.id))
    return m
  }, [notes])

  const lines = body.split('\n')
  return (
    <>
      {lines.map((line, i) => {
        if (line.startsWith('### ')) return <h3 key={i} className="mt-3 text-base font-black">{renderInline(line.slice(4), titleToId)}</h3>
        if (line.startsWith('## ')) return <h2 key={i} className="mt-4 text-lg font-black">{renderInline(line.slice(3), titleToId)}</h2>
        if (line.startsWith('# ')) return <h1 key={i} className="mt-4 text-2xl font-black italic">{renderInline(line.slice(2), titleToId)}</h1>
        if (line.startsWith('- ')) return <li key={i} className="ml-5 list-disc">{renderInline(line.slice(2), titleToId)}</li>
        if (!line.trim()) return <div key={i} className="h-2" />
        return <p key={i} className="my-1">{renderInline(line, titleToId)}</p>
      })}
    </>
  )
}

function renderInline(text: string, titleToId: Map<string, string>): React.ReactNode {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  const regex = /\[\[([^\]]+)\]\]/g
  let match: RegExpExecArray | null
  let key = 0
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    const linkText = match[1]
    const id = titleToId.get(linkText.toLowerCase())
    if (id) {
      parts.push(
        <Link key={key++} to={`/notes/${id}`} className="rounded border-b-2 border-black font-bold">
          {linkText}
        </Link>,
      )
    } else {
      parts.push(
        <span key={key++} className="rounded border-b-2 border-dashed border-black/60 font-bold opacity-70">
          {linkText}
        </span>,
      )
    }
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}
