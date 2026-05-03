import { useEffect, useRef, useState } from 'react'
import {
  IconBold,
  IconCallout,
  IconCode,
  IconHighlight,
  IconImage,
  IconItalic,
  IconMic,
  IconPaperclip,
  IconQuote,
  IconSend,
  IconStop,
  IconStrike,
  IconTrash,
  IconType,
} from './Icons'
import { api } from '../api'
import { encodeMedia, type MediaDescriptor } from '../messageMedia'
import { maybeCompressImage } from '../mediaCompress'
import { StickerPicker } from './StickerPicker'
import { t } from '../i18n'
import { useApp } from '../store'
import { showToast } from './Toast'

type Props = {
  onSend: (text: string) => void
  /** When set, composer is in edit mode for an existing message. */
  editing?: { id: string; text: string } | null
  onSubmitEdit?: (id: string, text: string) => void
  onCancelEdit?: () => void
  /** Optional reply context displayed above the composer. */
  replyTo?: { id: string; preview: string; author?: string } | null
  onCancelReply?: () => void
  /** Chat id needed for poll creation; omit on screens without polls. */
  chatId?: string
}

const MARKERS: Record<string, string> = {
  bold: '**',
  italic: '*',
  strike: '~~',
  code: '`',
  highlight: '==',
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

/** Prepend `prefix` to the start of every line that the current selection
 *  touches. Used for headings, quotes and callouts which are line-prefixed
 *  in our markdown subset. */
function prependLines(textarea: HTMLTextAreaElement, prefix: string): { value: string; start: number; end: number } {
  const v = textarea.value
  const s = textarea.selectionStart ?? v.length
  const e = textarea.selectionEnd ?? v.length
  const lineStart = v.lastIndexOf('\n', s - 1) + 1
  const lineEnd = (() => {
    const next = v.indexOf('\n', e)
    return next === -1 ? v.length : next
  })()
  const block = v.slice(lineStart, lineEnd)
  const replaced = block
    .split('\n')
    .map((ln) => (ln.startsWith(prefix) ? ln : `${prefix}${ln}`))
    .join('\n')
  const before = v.slice(0, lineStart)
  const after = v.slice(lineEnd)
  const next = `${before}${replaced}${after}`
  const delta = replaced.length - block.length
  return { value: next, start: s + prefix.length, end: e + delta }
}

function wrapColor(textarea: HTMLTextAreaElement, color: string): { value: string; start: number; end: number } {
  const v = textarea.value
  const s = textarea.selectionStart ?? v.length
  const e = textarea.selectionEnd ?? v.length
  const sel = v.slice(s, e) || 'text'
  const before = v.slice(0, s)
  const after = v.slice(e)
  const wrapped = `[${color}:${sel}]`
  const next = `${before}${wrapped}${after}`
  return { value: next, start: s + color.length + 2, end: s + color.length + 2 + sel.length }
}

/** Reduce a long sequence of mic-amplitude samples to `target` bins by
 *  taking the peak of each bucket. Cheap, perceptually adequate for a
 *  voice-message bar visualisation. */
function downsampleWaveform(samples: number[], target: number): number[] {
  if (!samples || samples.length === 0) return []
  if (samples.length <= target) return samples.map((v) => Math.max(0, Math.min(1, v)))
  const out = new Array<number>(target).fill(0)
  const ratio = samples.length / target
  for (let i = 0; i < target; i++) {
    const start = Math.floor(i * ratio)
    const end = Math.min(samples.length, Math.floor((i + 1) * ratio))
    let peak = 0
    for (let j = start; j < end; j++) {
      const v = Math.abs(samples[j] || 0)
      if (v > peak) peak = v
    }
    out[i] = Math.max(0, Math.min(1, peak))
  }
  return out
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
  chatId,
}: Props) {
  const { state } = useApp()
  const draftKey = chatId ? `docot:draft:${chatId}` : null
  const [text, setText] = useState<string>(() => {
    if (!draftKey) return ''
    try {
      return localStorage.getItem(draftKey) ?? ''
    } catch {
      return ''
    }
  })

  // Persist outgoing text per chat. Skip the first run after `draftKey` flips
  // — the current `text` still belongs to the previous chat at that point and
  // would otherwise overwrite the destination chat's draft.
  const prevDraftKeyRef = useRef(draftKey)
  useEffect(() => {
    if (!draftKey) {
      prevDraftKeyRef.current = draftKey
      return
    }
    if (prevDraftKeyRef.current !== draftKey) {
      prevDraftKeyRef.current = draftKey
      return
    }
    try {
      if (text) localStorage.setItem(draftKey, text)
      else localStorage.removeItem(draftKey)
    } catch {
      /* quota exceeded — drop silently */
    }
  }, [draftKey, text])

  // Switching to another chat — load that chat's draft.
  useEffect(() => {
    if (!draftKey) return
    try {
      const saved = localStorage.getItem(draftKey)
      setText(saved ?? '')
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey])

  useEffect(() => {
    if (!editing) return
    const t = editing.text
    queueMicrotask(() => setText(t))
  }, [editing])
  const [hasSelection, setHasSelection] = useState(false)
  const [recState, setRecState] = useState<'idle' | 'recording' | 'sending'>('idle')
  const [recSeconds, setRecSeconds] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [attachOpen, setAttachOpen] = useState(false)
  const [pollOpen, setPollOpen] = useState(false)
  const [stickerOpen, setStickerOpen] = useState(false)
  const [formatOpen, setFormatOpen] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const tickRef = useRef<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const startedAtRef = useRef<number>(0)
  const cancelledRef = useRef<boolean>(false)
  // Live waveform during recording (last ~2s) and the full sample buffer
  // we'll attach to the outgoing voice message.
  const audioCtxRef = useRef<AudioContext | null>(null)
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const waveSamplesRef = useRef<number[]>([])
  const waveTickRef = useRef<number | null>(null)
  const [liveWave, setLiveWave] = useState<number[]>([])

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

  function applyLinePrefix(prefix: string) {
    const ta = taRef.current
    if (!ta) return
    const { value, start, end } = prependLines(ta, prefix)
    setText(value)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start, end)
    })
  }

  function applyColor(color: string) {
    const ta = taRef.current
    if (!ta) return
    const { value, start, end } = wrapColor(ta, color)
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
      showToast(t('chat.voiceUnsupported', state.lang), 'error')
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
      // Wire an AnalyserNode in parallel so we can sample the live mic
      // amplitude every 80ms — used both for the live progress bars and
      // for the persisted waveform shipped with the voice message.
      try {
        const Ctor: typeof AudioContext =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ctx = new Ctor()
        audioCtxRef.current = ctx
        const src = ctx.createMediaStreamSource(stream)
        audioSourceRef.current = src
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 1024
        analyserRef.current = analyser
        src.connect(analyser)
        const buf = new Uint8Array(analyser.fftSize)
        waveSamplesRef.current = []
        setLiveWave([])
        waveTickRef.current = window.setInterval(() => {
          analyser.getByteTimeDomainData(buf)
          // Peak deviation from the 128 silence midpoint, normalised to 0..1.
          let peak = 0
          for (let i = 0; i < buf.length; i++) {
            const v = Math.abs(buf[i] - 128)
            if (v > peak) peak = v
          }
          const norm = Math.min(1, peak / 128)
          waveSamplesRef.current.push(norm)
          // Keep the live preview to last ~32 samples (about 2.5s).
          setLiveWave((prev) => {
            const next = prev.length >= 32 ? prev.slice(prev.length - 31) : prev.slice()
            next.push(norm)
            return next
          })
        }, 80)
      } catch (err) {
        // Analyser is best-effort; recording still works without waveform.
        console.warn('waveform capture unavailable', err)
      }
      rec.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data)
      }
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        teardownAnalyser()
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
          const desc: MediaDescriptor = {
            kind: 'voice',
            u: up.url,
            t: up.type,
            s: up.size,
            d: dur,
            w: downsampleWaveform(waveSamplesRef.current, 48),
          }
          onSend(encodeMedia(desc))
        } catch (err) {
          console.error('voice upload failed', err)
        } finally {
          setRecState('idle')
          setRecSeconds(0)
          waveSamplesRef.current = []
          setLiveWave([])
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
      teardownAnalyser()
      setRecState('idle')
    }
  }

  function teardownAnalyser() {
    if (waveTickRef.current) {
      window.clearInterval(waveTickRef.current)
      waveTickRef.current = null
    }
    try {
      audioSourceRef.current?.disconnect()
    } catch {
      /* ignore */
    }
    audioSourceRef.current = null
    analyserRef.current = null
    const ctx = audioCtxRef.current
    audioCtxRef.current = null
    if (ctx && ctx.state !== 'closed') {
      void ctx.close().catch(() => {})
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
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    // 25 MB hard cap per file; compression below may shrink images further.
    const tooBig = files.find((f) => f.size > 25 * 1024 * 1024)
    if (tooBig) {
      showToast(t('chat.fileTooLarge', state.lang), 'error')
      return
    }
    setUploading(true)
    // Multiple images sent at once become an album: each is uploaded as a
    // separate message, sharing one album id `g` so the renderer can stack
    // them into a single bubble.
    const allImages = files.length > 1 && files.every((f) => f.type.startsWith('image/'))
    const albumId = allImages ? `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` : undefined
    try {
      for (const original of files) {
        const file =
          original.type.startsWith('image/')
            ? await maybeCompressImage(original, state.prefs.mediaQuality)
            : original
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
        if (albumId && isImage) desc.g = albumId
        onSend(encodeMedia(desc))
      }
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
          <div className="ml-2 flex h-6 flex-1 items-center gap-[2px] overflow-hidden">
            {liveWave.map((v, i) => (
              <span
                key={i}
                className="inline-block w-[3px] rounded-full bg-ink"
                style={{ height: `${Math.max(8, Math.round(v * 100))}%` }}
              />
            ))}
          </div>
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
      {(hasSelection || formatOpen) && (
        <div className="flex flex-wrap items-center gap-1 border-b border-ink/15 px-2 py-1">
          {(['bold', 'italic', 'strike', 'code', 'highlight'] as const).map((k) => {
            const Icon = { bold: IconBold, italic: IconItalic, strike: IconStrike, code: IconCode, highlight: IconHighlight }[k]
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
          <span className="mx-1 h-5 w-px bg-ink/20" aria-hidden />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyLinePrefix('# ')}
            className="flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-black text-ink hover:bg-ink/10"
            aria-label="heading 1"
          >
            H1
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyLinePrefix('## ')}
            className="flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-black text-ink hover:bg-ink/10"
            aria-label="heading 2"
          >
            H2
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyLinePrefix('### ')}
            className="flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-black text-ink hover:bg-ink/10"
            aria-label="heading 3"
          >
            H3
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyLinePrefix('> ')}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink hover:bg-ink/10"
            aria-label="quote"
            title="Quote"
          >
            <IconQuote size={16} />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyLinePrefix('!> ')}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink hover:bg-ink/10"
            aria-label="callout"
            title="Callout"
          >
            <IconCallout size={16} />
          </button>
          <span className="mx-1 h-5 w-px bg-ink/20" aria-hidden />
          {(['red', 'orange', 'green', 'blue', 'purple'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyColor(c)}
              className="h-6 w-6 rounded-full border border-ink/30"
              style={{
                backgroundColor: {
                  red: '#dc2626',
                  orange: '#ea580c',
                  green: '#16a34a',
                  blue: '#2563eb',
                  purple: '#9333ea',
                }[c],
              }}
              aria-label={`color ${c}`}
              title={`Color: ${c}`}
            />
          ))}
        </div>
      )}
      <form className="flex items-end gap-2 px-3 py-2" onSubmit={handleSubmit}>
        <input
          ref={fileRef}
          type="file"
          hidden
          multiple
          onChange={handleFile}
          accept="image/*,video/*,audio/*,application/pdf,text/plain"
        />
        <div className="relative shrink-0">
          {attachOpen && (
            <>
              <button
                type="button"
                aria-label="close-attach-menu"
                onClick={() => setAttachOpen(false)}
                className="fixed inset-0 z-10 cursor-default bg-transparent"
              />
              <div className="absolute bottom-full left-0 z-20 mb-2 flex w-44 flex-col rounded-2xl border-2 border-ink bg-paper p-1 text-base font-bold shadow-xl">
                <button
                  type="button"
                  className="rounded-xl px-3 py-2 text-left hover:bg-ink/10"
                  onClick={() => {
                    setAttachOpen(false)
                    fileRef.current?.click()
                  }}
                >
                  {t('chat.attach', state.lang)}
                </button>
                <button
                  type="button"
                  className="rounded-xl px-3 py-2 text-left hover:bg-ink/10"
                  onClick={() => {
                    setAttachOpen(false)
                    setStickerOpen(true)
                  }}
                >
                  {t('chat.sticker', state.lang)}
                </button>
                {chatId && (
                  <button
                    type="button"
                    className="rounded-xl px-3 py-2 text-left hover:bg-ink/10"
                    onClick={() => {
                      setAttachOpen(false)
                      setPollOpen(true)
                    }}
                  >
                    {t('msg.poll', state.lang)}
                  </button>
                )}
              </div>
            </>
          )}
          <button
            type="button"
            onClick={() => setAttachOpen((v) => !v)}
            className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-ink text-ink disabled:opacity-50"
            disabled={uploading || recState !== 'idle'}
            aria-label={t('chat.attach', state.lang)}
          >
            {uploading ? <IconImage size={18} /> : <IconPaperclip size={20} />}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setFormatOpen((v) => !v)}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-ink text-ink disabled:opacity-50 ${formatOpen ? 'bg-ink text-paper' : ''}`}
          aria-label="formatting"
          title="Formatting"
        >
          <IconType size={20} />
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
      {pollOpen && chatId && (
        <PollModal chatId={chatId} onClose={() => setPollOpen(false)} />
      )}
      <StickerPicker
        open={stickerOpen}
        onClose={() => setStickerOpen(false)}
        onPick={(text) => onSend(text)}
      />
    </div>
  )
}

function PollModal({ chatId, onClose }: { chatId: string; onClose: () => void }) {
  const { state } = useApp()
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<string[]>(['', ''])
  const [multiple, setMultiple] = useState(false)
  const [anonymous, setAnonymous] = useState(true)
  const [busy, setBusy] = useState(false)

  const setOpt = (i: number, v: string) =>
    setOptions((arr) => arr.map((x, j) => (j === i ? v : x)))
  const addOpt = () => setOptions((arr) => (arr.length < 12 ? [...arr, ''] : arr))
  const removeOpt = (i: number) =>
    setOptions((arr) => (arr.length > 2 ? arr.filter((_, j) => j !== i) : arr))

  const submit = async () => {
    const q = question.trim()
    const opts = options.map((o) => o.trim()).filter((o) => o.length > 0)
    if (q.length === 0) {
      showToast(t('poll.error.shortQuestion', state.lang))
      return
    }
    if (opts.length < 2) {
      showToast(t('poll.error.fewOptions', state.lang))
      return
    }
    setBusy(true)
    try {
      await api.createPoll(chatId, { question: q, options: opts, multiple, anonymous })
      onClose()
    } catch {
      showToast('Failed to create poll')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border-2 border-ink bg-paper p-4 text-ink"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-lg font-extrabold">{t('poll.create', state.lang)}</h2>
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider opacity-60">
          {t('poll.question', state.lang)}
        </label>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={500}
          placeholder={t('poll.question', state.lang)}
          className="mb-3 w-full rounded-xl border-2 border-ink bg-paper px-3 py-2 text-base focus:outline-none"
        />
        <div className="mb-3 flex flex-col gap-2">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={opt}
                onChange={(e) => setOpt(i, e.target.value)}
                maxLength={500}
                placeholder={`${t('poll.option', state.lang)} ${i + 1}`}
                className="flex-1 rounded-xl border-2 border-ink bg-paper px-3 py-2 text-base focus:outline-none"
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeOpt(i)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink text-ink"
                  aria-label="remove"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {options.length < 12 && (
            <button
              type="button"
              onClick={addOpt}
              className="self-start text-sm font-bold underline"
            >
              + {t('poll.addOption', state.lang)}
            </button>
          )}
        </div>
        <label className="mb-2 flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={multiple}
            onChange={(e) => setMultiple(e.target.checked)}
            className="h-4 w-4 accent-ink"
          />
          {t('poll.multiple', state.lang)}
        </label>
        <label className="mb-3 flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            className="h-4 w-4 accent-ink"
          />
          {t('poll.anonymous', state.lang)}
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border-2 border-ink px-4 py-2 text-sm font-bold"
          >
            {t('poll.cancel', state.lang)}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="rounded-full border-2 border-ink bg-ink px-4 py-2 text-sm font-bold text-paper disabled:opacity-50"
          >
            {t('poll.send', state.lang)}
          </button>
        </div>
      </div>
    </div>
  )
}
