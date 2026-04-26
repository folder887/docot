import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Bottom-sheet style modal with backdrop. Used for confirms, action sheets
 * and small in-app dialogs (instead of window.alert/prompt/confirm).
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  align = 'sheet',
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  /** sheet = slides up from bottom; center = centered card */
  align?: 'sheet' | 'center'
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const body = (
    <div
      className="fixed inset-0 z-[60] flex"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className={`mx-auto w-full max-w-[440px] ${
          align === 'sheet' ? 'mt-auto rounded-t-3xl' : 'my-auto rounded-3xl'
        } sheet-in flex flex-col border-2 border-ink bg-paper p-5 text-ink`}
        onClick={(e) => e.stopPropagation()}
      >
        {align === 'sheet' && (
          <div
            className="mx-auto mb-3 h-1 w-10 rounded-full"
            style={{ background: 'var(--ink)', opacity: 0.3 }}
          />
        )}
        {title && (
          <div className="mb-3 text-center text-base font-black uppercase tracking-wide">
            {title}
          </div>
        )}
        {children}
      </div>
    </div>
  )

  return createPortal(body, document.body)
}

/** Confirm dialog with two buttons. Returns a Promise that resolves to true/false. */
export function ConfirmDialog({
  open,
  title,
  message,
  okLabel,
  cancelLabel,
  onResolve,
  destructive,
}: {
  open: boolean
  title?: string
  message: string
  okLabel: string
  cancelLabel: string
  onResolve: (ok: boolean) => void
  destructive?: boolean
}) {
  return (
    <Modal open={open} onClose={() => onResolve(false)} title={title} align="sheet">
      <p className="mb-5 text-center text-sm">{message}</p>
      <div className="flex gap-3">
        <button className="bw-btn-ghost flex-1" onClick={() => onResolve(false)}>
          {cancelLabel}
        </button>
        <button
          className={destructive ? 'bw-btn-primary flex-1' : 'bw-btn-primary flex-1'}
          onClick={() => onResolve(true)}
        >
          {okLabel}
        </button>
      </div>
    </Modal>
  )
}

/** Single-line text input dialog. */
export function PromptDialog({
  open,
  title,
  initialValue = '',
  okLabel,
  cancelLabel,
  placeholder,
  onResolve,
}: {
  open: boolean
  title: string
  initialValue?: string
  okLabel: string
  cancelLabel: string
  placeholder?: string
  onResolve: (value: string | null) => void
}) {
  return (
    <Modal open={open} onClose={() => onResolve(null)} title={title} align="sheet">
      <PromptForm
        initialValue={initialValue}
        placeholder={placeholder}
        okLabel={okLabel}
        cancelLabel={cancelLabel}
        onResolve={onResolve}
      />
    </Modal>
  )
}

function PromptForm({
  initialValue,
  placeholder,
  okLabel,
  cancelLabel,
  onResolve,
}: {
  initialValue: string
  placeholder?: string
  okLabel: string
  cancelLabel: string
  onResolve: (v: string | null) => void
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const data = new FormData(e.currentTarget)
        const v = String(data.get('value') ?? '').trim()
        onResolve(v || null)
      }}
    >
      <input
        autoFocus
        name="value"
        defaultValue={initialValue}
        placeholder={placeholder}
        className="bw-input mb-4 text-base"
      />
      <div className="flex gap-3">
        <button type="button" className="bw-btn-ghost flex-1" onClick={() => onResolve(null)}>
          {cancelLabel}
        </button>
        <button type="submit" className="bw-btn-primary flex-1">
          {okLabel}
        </button>
      </div>
    </form>
  )
}
