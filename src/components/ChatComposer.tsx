import { useEffect, useRef, useState } from 'react'
import {
  IconBold,
  IconCode,
  IconImage,
  IconItalic,
  IconMic,
  IconPaperclip,
  IconSend,
  IconStop,
  IconStrike,
  IconTrash,
} from './Icons'
import { api } from '../api'
import { encodeMedia, type MediaDescriptor } from '../messageMedia'
import { t } from '../i18n'
import { useApp } from '../store'

type Props = {
  onSend: (text: string) => void
  /** When set, composer is in edit mode for an existing message. */
  editing?: { id: string; text: string } | null
  onSubmitEdit?: (id: string, text: string) => void
  onCancelEdit?: () => void
  /** Optional reply context displayed above the composer. */
  replyTo?: { id: string; preview: string; author?: string } | null
  onCancelReply?: () => void
}

const MARKERS: Record<string, string> = {
  bold: '**',
  italic: '*',
  strike: '~~',
  code: '`',
}

function wrapSelection(textarea: HTMLTextAreaElement, marker: string): { value: string; start: number; end: number } {
  const v = textarea.value
  const s = textarea.selectionStart ?? v.length
  const e = textarea.selectionEnd ?? v.length
  const sel = v.slice(s, e) || ''
  const before = v.slice(0, s)
  const after = v.slice(e)
  const next = `${before}${marker}${sel}${marker}${after}`
  return { value: next, start: s + marker.length, end: e + marker.length }
}

function fmt(s: number): string {
  s = Math.max(0, Math.floor(s))
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${m}:${ss.toString().padStart(2, '0')}`
}

export function ChatComposer({
  onSend,
  editing,
  onSubmitEdit,
  onCancelEdit,
  replyTo,
  onCancelReply,
}: Props) {
  const { state } = useApp()
  const [text, setText] = useState('')

  useEffect(() => {
    if (!editing) return
    const t = editing.text
    queueMicrotask(() => setText(t))
  }, [editing])
  const [hasSelection, setHasSelection] = useState(false)
  const [recState, setRecState] = useState<'idle' | 'recording' | 'sending'>('idle')
  const [recSeconds, setRecSeconds] = useState(0)
  const [uploading, setUploading] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const tickRef = useRef<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const startedAtRef = useRef<number>(0)
  const cancelledRef = useRef<boolean>(false)

  useEffect(() => {
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current)
      try {
        recorderRef.current?.stop()
      } catch {
        /* ignore */
      }
    }
  }, [])

  function applyMarker(kind: keyof typeof MARKERS) {
    const ta = taRef.current
    if (!ta) return
    const m = MARKERS[kind]
    const { value, start, end } = wrapSelection(ta, m)
    setText(value)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start, end)
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const v = text.trim()
    if (!v) return
    if (editing && onSubmitEdit) {
      onSubmitEdit(editing.id, v)
      setText('')
      return
    }
    setText('')
    onSend(v)
  }

  async function startRecording() {
    if (recState !== 'idle') return
    if (!navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder === 'undefined') {
      window.alert(t('chat.voiceUnsupported', state.lang))
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : ''
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      recorderRef.current = rec
      chunksRef.current = []
      cancelledRef.current = false
      rec.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data)
      }
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        if (cancelledRef.current) {
          setRecState('idle')
          return
        }
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        if (blob.size < 200) {
          setRecState('idle')
          return
        }
        const dur = (Date.now() - startedAtRef.current) / 1000
        setRecState('sending')
        try {
          const up = await api.uploadFile(blob, `voice-${Date.now()}.webm`)
          const desc: MediaDescriptor = { kind: 'voice', u: up.url, t: up.type, s: up.size, d: dur }
          onSend(encodeMedia(desc))
        } catch (err) {
          console.error('voice upload failed', err)
        } finally {
          setRecState('idle')
          setRecSeconds(0)
        }
      }
      startedAtRef.current = Date.now()
      setRecSeconds(0)
      rec.start()
      setRecState('recording')
      tickRef.current = window.setInterval(() => {
        setRecSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000))
      }, 250)
    } catch (err) {
      console.error('mic denied', err)
      setRecState('idle')
    }
  }

  function stopRecording(cancel = false) {
    cancelledRef.current = cancel
    if (tickRef.current) {
      window.clearInterval(tickRef.current)
      tickRef.current = null
    }
    try {
      recorderRef.current?.stop()
    } catch {
      /* ignore */
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (file.size > 25 * 1024 * 1024) {
      window.alert(t('chat.fileTooLarge', state.lang))
      return
    }
    setUploading(true)
    try {
      const up = await api.uploadFile(file, file.name || 'file')
      const isImage = up.type.startsWith('image/')
      const isVideo = up.type.startsWith('video/')
      const desc: MediaDescriptor = {
        kind: isImage ? 'image' : isVideo ? 'video' : 'file',
        u: up.url,
        t: up.type,
        n: file.name,
        s: up.size,
      }
      onSend(encodeMedia(desc))
    } catch (err) {
      console.error('upload failed', err)
    } finally {
      setUploading(false)
    }
  }

  if (recState === 'recording') {
    return (
      <div className="flex items-center gap-2 border-t-2 border-ink bg-paper px-3 py-2">
        <button
          type="button"
          onClick={() => stopRecording(true)}
          className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-ink text-ink"
          aria-label={t('chat.cancelVoice', state.lang)}
        >
          <IconTrash size={20} />
        </button>
        <div className="flex flex-1 items-center gap-2 rounded-full border-2 border-ink bg-paper px-4 py-2.5">
          <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
          <span className="text-sm font-bold tabular-nums">{fmt(recSeconds)}</span>
          <span className="ml-2 truncate text-xs text-muted">{t('chat.recording', state.lang)}</span>
        </div>
        <button
          type="button"
          onClick={() => stopRecording(false)}
          className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-ink bg-ink text-paper"
          aria-label={t('chat.send', state.lang)}
        >
          <IconSend size={20} />
        </button>
      </div>
    )
  }

  return (
    <div className="border-t-2 border-ink bg-paper">
      {(replyTo || editing) && (
        <div className="flex items-start gap-2 border-b border-ink/15 px-3 py-2 text-xs">
          <span className="font-black uppercase tracking-wide">
            {editing ? t('msg.edit', state.lang) : t('msg.replyingTo', state.lang)}
            {replyTo?.author && !editing ? ` ${replyTo.author}` : ''}
          </span>
          <span className="min-w-0 flex-1 truncate text-muted">
            {editing ? editing.text : replyTo?.preview}
          </span>
          <button
            type="button"
            onClick={() => {
              if (editing) {
                onCancelEdit?.()
                setText('')
              } else {
                onCancelReply?.()
              }
            }}
            className="text-muted hover:text-ink"
            aria-label="cancel"
          >
            ×
          </button>
        </div>
      )}
      {hasSelection && (
        <div className="flex items-center gap-1 border-b border-ink/15 px-2 py-1">
          {(['bold', 'italic', 'strike', 'code'] as const).map((k) => {
            const Icon = { bold: IconBold, italic: IconItalic, strike: IconStrike, code: IconCode }[k]
            return (
              <button
                key={k}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyMarker(k)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-ink hover:bg-ink/10"
                aria-label={k}
              >
                <Icon size={16} />
              </button>
            )
          })}
        </div>
      )}
      <form className="flex items-end gap-2 px-3 py-2" onSubmit={handleSubmit}>
        <input ref={fileRef} type="file" hidden onChange={handleFile} accept="image/*,video/*,audio/*,application/pdf,text/plain" />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-ink text-ink disabled:opacity-50"
          disabled={uploading || recState !== 'idle'}
          aria-label={t('chat.attach', state.lang)}
        >
          {uploading ? <IconImage size={18} /> : <IconPaperclip size={20} />}
        </button>
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onSelect={(e) => {
            const ta = e.currentTarget
            setHasSelection((ta.selectionEnd ?? 0) > (ta.selectionStart ?? 0))
          }}
          onBlur={() => window.setTimeout(() => setHasSelection(false), 150)}
          rows={1}
          placeholder={t('chat.placeholder', state.lang)}
          className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border-2 border-ink bg-paper px-4 py-2.5 text-base text-ink focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit(e)
            }
          }}
        />
        {text.trim().length > 0 ? (
          <button
            type="submit"
            aria-label={t('chat.send', state.lang)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-ink text-paper"
          >
            <IconSend size={20} />
          </button>
        ) : (
          <button
            type="button"
            onClick={startRecording}
            disabled={recState !== 'idle'}
            aria-label={t('chat.recordVoice', state.lang)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-ink text-ink disabled:opacity-50"
          >
            {recState === 'sending' ? <IconStop size={18} /> : <IconMic size={20} />}
          </button>
        )}
      </form>
    </div>
  )
}
