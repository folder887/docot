import { useMemo, useState } from 'react'
import { useApp } from '../store'
import { t } from '../i18n'
import { IconPlus, IconTrash } from '../components/Icons'
import type { CalendarEvent } from '../types'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function startOfMonthGrid(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const dow = first.getDay()
  const start = new Date(first)
  start.setDate(first.getDate() - dow)
  return start
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function CalendarScreen() {
  const { state, addEvent, updateEvent, deleteEvent } = useApp()
  const [cursor, setCursor] = useState(() => new Date())
  const [selected, setSelected] = useState(() => new Date())
  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)

  const monthDays = useMemo(() => {
    const start = startOfMonthGrid(cursor)
    const out: Date[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      out.push(d)
    }
    return out
  }, [cursor])

  const eventsByDate = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>()
    for (const e of state.events) {
      const arr = m.get(e.date) ?? []
      arr.push(e)
      m.set(e.date, arr)
    }
    return m
  }, [state.events])

  const dayEvents = (eventsByDate.get(dateKey(selected)) ?? []).sort((a, b) =>
    (a.start ?? '').localeCompare(b.start ?? ''),
  )

  const monthLabel = `${t(`months.${cursor.getMonth() + 1}`, state.lang)} ${cursor.getFullYear()}`

  return (
    <div className="flex flex-col bg-white">
      <div className="sticky top-[57px] z-[5] flex items-center justify-between border-b-2 border-black bg-white px-4 py-3">
        <button
          aria-label="Prev month"
          className="h-9 w-9 rounded-full border-2 border-black"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
        >
          ‹
        </button>
        <div className="text-center font-black">{monthLabel}</div>
        <button
          aria-label="Next month"
          className="h-9 w-9 rounded-full border-2 border-black"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 border-b-2 border-black text-[10px] font-black uppercase tracking-wide">
        {[0, 1, 2, 3, 4, 5, 6].map((d) => (
          <div key={d} className="py-2 text-center">
            {t(`dow.${d}`, state.lang)}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {monthDays.map((d, i) => {
          const inMonth = d.getMonth() === cursor.getMonth()
          const isSelected = sameDay(d, selected)
          const isToday = sameDay(d, new Date())
          const count = eventsByDate.get(dateKey(d))?.length ?? 0
          return (
            <button
              key={i}
              onClick={() => setSelected(new Date(d))}
              className={`relative flex aspect-square flex-col items-center justify-center border-b border-r border-black/20 text-sm ${
                i % 7 === 0 ? 'border-l-0' : ''
              } ${isSelected ? 'bg-black text-white' : 'bg-white text-black'} ${
                inMonth ? '' : 'opacity-30'
              }`}
            >
              <span className={`font-bold ${isToday && !isSelected ? 'underline decoration-2 underline-offset-2' : ''}`}>
                {d.getDate()}
              </span>
              {count > 0 && (
                <span
                  className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                    isSelected ? 'bg-white' : 'bg-black'
                  }`}
                />
              )}
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-black uppercase tracking-wide">
          {selected.toDateString()}
        </h2>
        <div className="flex gap-2">
          <button
            className="rounded-full border-2 border-black px-3 py-1 text-xs font-bold"
            onClick={() => {
              setSelected(new Date())
              setCursor(new Date())
            }}
          >
            {t('calendar.today', state.lang)}
          </button>
          <button
            aria-label={t('calendar.addEvent', state.lang)}
            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-black bg-black text-white"
            onClick={() => {
              setEditing(null)
              setComposerOpen(true)
            }}
          >
            <IconPlus size={16} />
          </button>
        </div>
      </div>

      {dayEvents.length === 0 ? (
        <p className="px-6 pb-8 text-sm text-muted">{t('empty.events', state.lang)}</p>
      ) : (
        <ul className="flex flex-col gap-2 px-4 pb-8">
          {dayEvents.map((ev) => (
            <li key={ev.id} className="bw-card flex items-start gap-3 p-3">
              <div className="flex flex-col items-center rounded-lg border-2 border-black px-2 py-1 text-xs font-black">
                {ev.start ? (
                  <>
                    <span>{ev.start}</span>
                    {ev.end && <span className="opacity-70">{ev.end}</span>}
                  </>
                ) : (
                  <span>ALL</span>
                )}
              </div>
              <div className="flex-1">
                <div className="font-bold">{ev.title}</div>
                {ev.notes && <div className="mt-1 text-xs text-black/70">{ev.notes}</div>}
              </div>
              <div className="flex gap-1">
                <button
                  className="rounded-full border-2 border-black px-2 py-1 text-xs font-bold"
                  onClick={() => {
                    setEditing(ev)
                    setComposerOpen(true)
                  }}
                >
                  ✎
                </button>
                <button
                  aria-label="Delete"
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-black"
                  onClick={() => void deleteEvent(ev.id)}
                >
                  <IconTrash size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {composerOpen && (
        <EventComposer
          initial={editing ?? { id: '', title: '', date: dateKey(selected) }}
          lang={state.lang}
          onClose={() => setComposerOpen(false)}
          onSave={(data) => {
            void (editing ? updateEvent(editing.id, data) : addEvent(data))
            setComposerOpen(false)
          }}
        />
      )}
    </div>
  )
}

function EventComposer({
  initial,
  onSave,
  onClose,
  lang,
}: {
  initial: Partial<CalendarEvent> & { date: string }
  onSave: (data: Omit<CalendarEvent, 'id'>) => void
  onClose: () => void
  lang: 'en' | 'ru'
}) {
  const [title, setTitle] = useState(initial.title ?? '')
  const [date, setDate] = useState(initial.date)
  const [start, setStart] = useState(initial.start ?? '')
  const [end, setEnd] = useState(initial.end ?? '')
  const [notes, setNotes] = useState(initial.notes ?? '')

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30" onClick={onClose}>
      <div
        className="w-full max-w-[440px] rounded-t-3xl border-2 border-black bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-black" />
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (!title.trim()) return
            onSave({ title: title.trim(), date, start: start || undefined, end: end || undefined, notes: notes || undefined })
          }}
        >
          <label className="text-xs font-black uppercase">{t('calendar.title', lang)}</label>
          <input className="bw-input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />

          <div className="grid grid-cols-3 gap-2">
            <label className="col-span-3 text-xs font-black uppercase">{t('calendar.date', lang)}</label>
            <input type="date" className="bw-input col-span-3" value={date} onChange={(e) => setDate(e.target.value)} />
            <label className="text-xs font-black uppercase">{t('calendar.start', lang)}</label>
            <label className="text-xs font-black uppercase col-span-2">{t('calendar.end', lang)}</label>
            <input type="time" className="bw-input" value={start} onChange={(e) => setStart(e.target.value)} />
            <input type="time" className="bw-input col-span-2" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>

          <textarea
            rows={3}
            placeholder="Notes"
            className="bw-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="mt-2 flex gap-2">
            <button type="button" onClick={onClose} className="bw-btn-ghost flex-1">
              {t('common.cancel', lang)}
            </button>
            <button type="submit" className="bw-btn-primary flex-1">
              {t('calendar.save', lang)}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
