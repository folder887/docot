import { useEffect, useState, useCallback } from 'react'

import { api } from '../api'
import type { ApiPoll } from '../api'
import { useApp } from '../store'
import { t } from '../i18n'

type Props = {
  pollId: string
  onMine: boolean
}

export function PollCard({ pollId, onMine }: Props) {
  const { state } = useApp()
  const [poll, setPoll] = useState<ApiPoll | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const next = await api.getPoll(pollId)
      setPoll(next)
    } catch {
      /* ignore */
    }
  }, [pollId])

  useEffect(() => {
    let cancelled = false
    api
      .getPoll(pollId)
      .then((next) => {
        if (!cancelled) setPoll(next)
      })
      .catch(() => {
        /* ignore */
      })
    return () => {
      cancelled = true
    }
  }, [pollId])

  // Refresh on poll_updated WS — we attach a generic listener via a custom
  // event dispatched from ChatDetailScreen so the card stays decoupled from
  // the websocket plumbing.
  useEffect(() => {
    const onUpdate = (ev: Event) => {
      const detail = (ev as CustomEvent<{ pollId: string }>).detail
      if (detail?.pollId === pollId) void refresh()
    }
    window.addEventListener('docot:poll_updated', onUpdate as EventListener)
    return () =>
      window.removeEventListener('docot:poll_updated', onUpdate as EventListener)
  }, [pollId, refresh])

  if (!poll) {
    return (
      <div
        className={`mt-1 rounded-2xl border-2 border-dashed border-current/40 px-3 py-2 text-xs italic ${onMine ? 'opacity-70' : 'opacity-70'}`}
      >
        {t('poll.loading', state.lang)}
      </div>
    )
  }

  const myId = state.me?.id
  const isCreator = myId === poll.createdBy
  const closed = !!poll.closedAt
  const totalVotes = poll.options.reduce((s, o) => s + o.votes, 0)

  const toggle = async (optId: number) => {
    if (closed || busy) return
    setBusy(true)
    try {
      let next: number[]
      const mine = poll.options.filter((o) => o.mine).map((o) => o.id)
      if (poll.multiple) {
        next = mine.includes(optId) ? mine.filter((x) => x !== optId) : [...mine, optId]
      } else {
        next = mine.includes(optId) ? [] : [optId]
      }
      const updated = await api.votePoll(poll.id, next)
      setPoll(updated)
    } catch {
      /* ignore */
    } finally {
      setBusy(false)
    }
  }

  const close = async () => {
    if (busy || closed) return
    setBusy(true)
    try {
      const updated = await api.closePoll(poll.id)
      setPoll(updated)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={`mt-1 w-full max-w-sm rounded-2xl border-2 border-current/30 px-3 py-2 ${onMine ? 'bg-paper/10' : 'bg-paper'} text-ink`}
      style={onMine ? undefined : { color: 'var(--ink)' }}
    >
      <div className="mb-1 text-xs font-bold uppercase tracking-wider opacity-60">
        {closed
          ? t('poll.closed', state.lang)
          : poll.multiple
            ? t('poll.multiple', state.lang)
            : t('poll.single', state.lang)}
      </div>
      <div className="mb-2 text-sm font-bold leading-snug">{poll.question}</div>
      <ul className="flex flex-col gap-1">
        {poll.options.map((opt) => {
          const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0
          return (
            <li key={opt.id}>
              <button
                type="button"
                onClick={() => void toggle(opt.id)}
                disabled={closed || busy}
                className={`relative w-full overflow-hidden rounded-xl border-2 px-3 py-2 text-left text-sm transition ${
                  opt.mine
                    ? 'border-ink bg-ink/10'
                    : 'border-ink/40 hover:border-ink'
                } ${closed ? 'cursor-default opacity-80' : ''}`}
              >
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 bg-ink/15"
                  style={{ width: `${pct}%` }}
                />
                <span className="relative flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 truncate font-bold">
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${opt.mine ? 'border-ink bg-ink text-paper' : 'border-ink/60'}`}
                    >
                      {opt.mine ? (poll.multiple ? '✓' : '•') : ''}
                    </span>
                    {opt.text}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums opacity-70">
                    {opt.votes} · {pct}%
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="mt-2 flex items-center justify-between text-[11px] opacity-60">
        <span>
          {t('poll.totalVoters', state.lang)}: {poll.totalVoters}
        </span>
        {isCreator && !closed && (
          <button
            type="button"
            onClick={() => void close()}
            disabled={busy}
            className="font-bold underline disabled:opacity-50"
          >
            {t('poll.close', state.lang)}
          </button>
        )}
      </div>
    </div>
  )
}
