import { useNavigate } from 'react-router-dom'
import { useApp } from '../store'
import { t } from '../i18n'

/**
 * Inline pill that renders a `[[event:<id>]]` cross-link as a clickable chip
 * showing the event's date/time. Clicking the chip navigates to the calendar
 * with the event opened.
 */
export function EventChip({ eventId, inline = true }: { eventId: string; inline?: boolean }) {
  const { state } = useApp()
  const navigate = useNavigate()
  const ev = state.events.find((e) => e.id === eventId)
  const cls = inline
    ? 'inline-flex items-center gap-1 rounded-full border-2 border-ink bg-paper px-2 py-0.5 text-xs font-bold align-middle'
    : 'inline-flex items-center gap-1 rounded-xl border-2 border-ink bg-paper px-3 py-1 text-sm font-bold'
  if (!ev) {
    return (
      <span className={cls + ' opacity-60'} title={eventId}>
        📅 {t('event.unknown', state.lang)}
      </span>
    )
  }
  return (
    <button
      type="button"
      className={cls + ' transition-transform active:scale-95'}
      onClick={() => navigate(`/calendar?event=${ev.id}`)}
      title={`${ev.date}${ev.start ? ` ${ev.start}` : ''}`}
    >
      <span aria-hidden>📅</span>
      <span className="truncate max-w-[160px]">{ev.title}</span>
      <span className="text-[10px] font-normal text-muted">{ev.date}</span>
    </button>
  )
}


