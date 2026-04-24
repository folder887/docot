import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../store'
import { relTime, t } from '../i18n'
import { IconPlus } from '../components/Icons'
import type { Note } from '../types'

export function NotesScreen() {
  const { state, addNote } = useApp()
  const navigate = useNavigate()
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
    <div className="flex min-h-0 flex-1 flex-col bg-paper">
      <div className="sticky top-[57px] z-[5] flex flex-col gap-2 border-b-2 border-ink bg-paper p-3">
        <div className="flex gap-2">
          <input
            className="bw-input py-2 text-sm"
            placeholder={t('top.search', state.lang)}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            aria-label={t('notes.new', state.lang)}
            className="flex h-[44px] w-[44px] flex-shrink-0 items-center justify-center rounded-xl border-2 border-ink bg-ink text-paper transition-transform active:scale-95"
            onClick={async () => {
              const title = window.prompt(t('notes.title', state.lang), 'New note')
              if (title) {
                const id = await addNote(title)
                navigate(`/notes/${id}`)
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
          <p className="p-6 text-sm text-muted">{t('notes.empty', state.lang)}</p>
        ) : (
          <ul>
            {notes.map((n) => (
              <li key={n.id} className="border-b border-line">
                <Link to={`/notes/${n.id}`} className="row-press flex flex-col gap-1 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold">{n.title}</div>
                    <div className="text-xs text-muted">{relTime(n.updatedAt, state.lang)}</div>
                  </div>
                  <div className="line-clamp-2 text-sm text-muted">{bodyPreview(n.body)}</div>
                  {n.tags.length > 0 && (
                    <div className="mt-1 flex gap-1">
                      {n.tags.map((tag) => (
                        <span key={tag} className="rounded-full border border-ink px-2 text-[10px] font-bold uppercase">
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
        <InteractiveGraph notes={notes} />
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
      className={`flex-1 rounded-full border-2 border-ink px-4 py-1 text-sm font-bold transition-colors ${
        active ? 'bg-ink text-paper' : 'bg-paper text-ink'
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

/* ============ INTERACTIVE FORCE-DIRECTED GRAPH ============ */

type NodeSim = {
  id: string
  title: string
  x: number
  y: number
  vx: number
  vy: number
  r: number
  fx?: number | null
  fy?: number | null
}

type EdgeSim = { from: string; to: string }

function InteractiveGraph({ notes }: { notes: Note[] }) {
  const navigate = useNavigate()
  const svgRef = useRef<SVGSVGElement>(null)
  const [nodes, setNodes] = useState<NodeSim[]>([])
  const [edges, setEdges] = useState<EdgeSim[]>([])
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 })
  const [hovered, setHovered] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const rafRef = useRef<number | null>(null)
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)

  /* Build graph when notes change */
  useEffect(() => {
    const titleToId = new Map<string, string>()
    notes.forEach((n) => titleToId.set(n.title.toLowerCase(), n.id))
    const nextEdges: EdgeSim[] = []
    notes.forEach((n) => {
      const links = Array.from(n.body.matchAll(/\[\[([^\]]+)\]\]/g)).map((m) => m[1].toLowerCase())
      for (const l of links) {
        const targetId = titleToId.get(l)
        if (targetId && targetId !== n.id) nextEdges.push({ from: n.id, to: targetId })
      }
    })

    const degrees = new Map<string, number>()
    nextEdges.forEach((e) => {
      degrees.set(e.from, (degrees.get(e.from) ?? 0) + 1)
      degrees.set(e.to, (degrees.get(e.to) ?? 0) + 1)
    })

    const cx = 200
    const cy = 200
    const R = 150
    const existing = new Map(nodes.map((n) => [n.id, n]))
    const next: NodeSim[] = notes.map((n, i) => {
      const prev = existing.get(n.id)
      if (prev) return { ...prev, title: n.title, r: 10 + Math.min(18, (degrees.get(n.id) ?? 0) * 3) }
      const angle = (i / Math.max(notes.length, 1)) * Math.PI * 2
      return {
        id: n.id,
        title: n.title,
        x: cx + Math.cos(angle) * R + (Math.random() - 0.5) * 20,
        y: cy + Math.sin(angle) * R + (Math.random() - 0.5) * 20,
        vx: 0,
        vy: 0,
        r: 10 + Math.min(18, (degrees.get(n.id) ?? 0) * 3),
      }
    })
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNodes(next)
    setEdges(nextEdges)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes])

  /* Simulation loop */
  useEffect(() => {
    const step = () => {
      setNodes((prev) => {
        if (prev.length === 0) return prev
        const next = prev.map((n) => ({ ...n }))
        const cx = 200
        const cy = 200
        const REPULSION = 900
        const SPRING = 0.02
        const SPRING_LEN = 90
        const CENTER_PULL = 0.002
        const DAMPING = 0.82

        for (let i = 0; i < next.length; i++) {
          const a = next[i]
          if (a.fx != null && a.fy != null) {
            a.x = a.fx
            a.y = a.fy
            a.vx = 0
            a.vy = 0
            continue
          }
          let fx = 0
          let fy = 0
          // repulsion
          for (let j = 0; j < next.length; j++) {
            if (i === j) continue
            const b = next[j]
            const dx = a.x - b.x
            const dy = a.y - b.y
            const d2 = dx * dx + dy * dy + 0.01
            const d = Math.sqrt(d2)
            const f = REPULSION / d2
            fx += (dx / d) * f
            fy += (dy / d) * f
          }
          // center
          fx += (cx - a.x) * CENTER_PULL
          fy += (cy - a.y) * CENTER_PULL

          a.vx = (a.vx + fx) * DAMPING
          a.vy = (a.vy + fy) * DAMPING
        }

        // springs
        for (const e of edges) {
          const a = next.find((n) => n.id === e.from)
          const b = next.find((n) => n.id === e.to)
          if (!a || !b) continue
          const dx = b.x - a.x
          const dy = b.y - a.y
          const d = Math.sqrt(dx * dx + dy * dy) + 0.01
          const f = (d - SPRING_LEN) * SPRING
          const fx = (dx / d) * f
          const fy = (dy / d) * f
          if (a.fx == null) {
            a.vx += fx
            a.vy += fy
          }
          if (b.fx == null) {
            b.vx -= fx
            b.vy -= fy
          }
        }

        for (const n of next) {
          if (n.fx != null) continue
          n.x += n.vx
          n.y += n.vy
        }

        return next
      })
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [edges])

  /* Screen → SVG viewBox coords */
  const screenToView = (clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    // svg viewBox is 400x400
    const sx = ((clientX - rect.left) / rect.width) * 400
    const sy = ((clientY - rect.top) / rect.height) * 400
    // invert transform
    return {
      x: (sx - transform.x) / transform.k,
      y: (sy - transform.y) / transform.k,
    }
  }

  /* Node drag handlers */
  const onNodePointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    setDraggingId(id)
    const { x, y } = screenToView(e.clientX, e.clientY)
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, fx: x, fy: y } : n)))
  }
  const onNodePointerMove = (e: React.PointerEvent, id: string) => {
    if (draggingId !== id) return
    const { x, y } = screenToView(e.clientX, e.clientY)
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, fx: x, fy: y } : n)))
  }
  const onNodePointerUp = (e: React.PointerEvent, id: string) => {
    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
    setDraggingId(null)
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, fx: null, fy: null } : n)))
  }

  /* Background pan */
  const onBgPointerDown = (e: React.PointerEvent) => {
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    panStart.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y }
  }
  const onBgPointerMove = (e: React.PointerEvent) => {
    if (!panStart.current) return
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const scale = 400 / rect.width
    const dx = (e.clientX - panStart.current.x) * scale
    const dy = (e.clientY - panStart.current.y) * scale
    setTransform((t) => ({ ...t, x: panStart.current!.tx + dx, y: panStart.current!.ty + dy }))
  }
  const onBgPointerUp = (e: React.PointerEvent) => {
    ;(e.currentTarget as Element).releasePointerCapture?.(e.pointerId)
    panStart.current = null
  }

  /* Zoom */
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const { x, y } = screenToView(e.clientX, e.clientY)
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    setTransform((t) => {
      const k = Math.max(0.4, Math.min(3, t.k * factor))
      // keep cursor anchored
      return {
        k,
        x: t.x + (x * t.k - x * k),
        y: t.y + (y * t.k - y * k),
      }
    })
  }

  const connected = useMemo(() => {
    if (!hovered) return new Set<string>()
    const set = new Set<string>()
    for (const e of edges) {
      if (e.from === hovered) set.add(e.to)
      if (e.to === hovered) set.add(e.from)
    }
    return set
  }, [edges, hovered])

  return (
    <div className="relative m-4 overflow-hidden rounded-2xl border-2 border-ink" style={{ touchAction: 'none' }}>
      <svg
        ref={svgRef}
        viewBox="0 0 400 400"
        className="block h-[70vh] w-full select-none"
        onPointerDown={onBgPointerDown}
        onPointerMove={onBgPointerMove}
        onPointerUp={onBgPointerUp}
        onPointerCancel={onBgPointerUp}
        onWheel={onWheel}
      >
        <rect x={0} y={0} width={400} height={400} fill="var(--paper)" />
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          {edges.map((e, i) => {
            const a = nodes.find((n) => n.id === e.from)
            const b = nodes.find((n) => n.id === e.to)
            if (!a || !b) return null
            const highlight = hovered && (e.from === hovered || e.to === hovered)
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="var(--ink)"
                strokeWidth={highlight ? 2.4 : 1}
                strokeOpacity={hovered && !highlight ? 0.2 : 0.8}
              />
            )
          })}
          {nodes.map((n) => {
            const isHover = hovered === n.id
            const isConnected = connected.has(n.id)
            const dim = hovered && !isHover && !isConnected
            return (
              <g
                key={n.id}
                transform={`translate(${n.x},${n.y})`}
                style={{ cursor: draggingId === n.id ? 'grabbing' : 'pointer', opacity: dim ? 0.35 : 1, transition: 'opacity 150ms' }}
                onPointerDown={(e) => onNodePointerDown(e, n.id)}
                onPointerMove={(e) => onNodePointerMove(e, n.id)}
                onPointerUp={(e) => onNodePointerUp(e, n.id)}
                onMouseEnter={() => setHovered(n.id)}
                onMouseLeave={() => setHovered(null)}
                onDoubleClick={() => navigate(`/notes/${n.id}`)}
                onClick={(e) => {
                  if (!draggingId) {
                    e.stopPropagation()
                    navigate(`/notes/${n.id}`)
                  }
                }}
              >
                <circle
                  r={n.r}
                  fill={isHover ? 'var(--ink)' : 'var(--paper)'}
                  stroke="var(--ink)"
                  strokeWidth={2}
                />
                <text
                  y={n.r + 12}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="700"
                  fill="var(--ink)"
                  pointerEvents="none"
                >
                  {n.title.length > 18 ? n.title.slice(0, 17) + '…' : n.title}
                </text>
              </g>
            )
          })}
        </g>
      </svg>

      <div className="pointer-events-none absolute bottom-2 left-2 right-2 flex justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
        <span>drag nodes · pan bg · wheel zoom</span>
        <span>{Math.round(transform.k * 100)}%</span>
      </div>
    </div>
  )
}
