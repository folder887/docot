/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { subscribe, type ToastItem } from './toast-bus'

// Re-export for convenience so call-sites can import from one place.
export { showToast } from './toast-bus'

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    const off = subscribe((t) => {
      setItems((xs) => [...xs, t])
      window.setTimeout(() => {
        setItems((xs) => xs.filter((x) => x.id !== t.id))
      }, 3500)
    })
    return off
  }, [])

  if (items.length === 0) return null
  return createPortal(
    <div className="fixed inset-x-0 top-3 z-[80] flex flex-col items-center gap-2 px-3 pointer-events-none">
      {items.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto rounded-2xl border-2 border-ink bg-paper px-4 py-2 text-sm font-bold text-ink shadow-[3px_3px_0_0_var(--ink)]"
          style={t.kind === 'error' ? { background: 'var(--ink)', color: 'var(--paper)' } : undefined}
          role="status"
        >
          {t.text}
        </div>
      ))}
    </div>,
    document.body,
  )
}
