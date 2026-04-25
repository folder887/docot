import { useEffect, useRef, useState } from 'react'
import { decodeMedia, mediaUrl } from '../messageMedia'
import { LiteMarkdown } from '../lite-md'
import { IconPause, IconPlay } from './Icons'

function fmt(s: number): string {
  s = Math.max(0, Math.floor(s))
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${m}:${ss.toString().padStart(2, '0')}`
}

function VoiceBubble({ url, dur }: { url: string; dur: number }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(dur || 0)

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onTime = () => setProgress(a.currentTime)
    const onLoad = () => {
      if (Number.isFinite(a.duration) && a.duration > 0) setDuration(a.duration)
    }
    const onEnd = () => setPlaying(false)
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('loadedmetadata', onLoad)
    a.addEventListener('ended', onEnd)
    return () => {
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('loadedmetadata', onLoad)
      a.removeEventListener('ended', onEnd)
    }
  }, [])

  const toggle = () => {
    const a = audioRef.current
    if (!a) return
    if (playing) {
      a.pause()
      setPlaying(false)
    } else {
      void a.play().then(() => setPlaying(true)).catch(() => {})
    }
  }

  const pct = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0

  return (
    <div className="flex min-w-[180px] items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-current"
      >
        {playing ? <IconPause size={16} /> : <IconPlay size={16} />}
      </button>
      <div className="flex flex-1 flex-col gap-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-current/20">
          <div className="h-full bg-current" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[11px] tabular-nums opacity-80">{fmt(playing ? progress : duration)}</span>
      </div>
      <audio ref={audioRef} src={url} preload="metadata" />
    </div>
  )
}

function ImageBubble({ url, alt }: { url: string; alt?: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img
        src={url}
        alt={alt || 'image'}
        className="max-h-72 max-w-full rounded-lg border border-current/20 object-contain"
        loading="lazy"
      />
    </a>
  )
}

function VideoBubble({ url }: { url: string }) {
  return (
    <video src={url} controls className="max-h-72 max-w-full rounded-lg border border-current/20" preload="metadata" />
  )
}

function FileBubble({ url, name, size }: { url: string; name?: string; size?: number }) {
  const kb = size ? Math.round(size / 1024) : 0
  return (
    <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 underline-offset-2 hover:underline">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-current text-[10px] font-black uppercase">
        FILE
      </span>
      <span className="flex flex-col">
        <span className="truncate text-sm font-bold">{name || 'file'}</span>
        {kb > 0 && <span className="text-[11px] opacity-70">{kb} KB</span>}
      </span>
    </a>
  )
}

export function MessageContent({ text }: { text: string }) {
  const media = decodeMedia(text)
  if (media) {
    const url = mediaUrl(media)
    if (media.kind === 'voice') return <VoiceBubble url={url} dur={media.d ?? 0} />
    if (media.kind === 'image') return <ImageBubble url={url} alt={media.n} />
    if (media.kind === 'video') return <VideoBubble url={url} />
    if (media.kind === 'file') return <FileBubble url={url} name={media.n} size={media.s} />
  }
  return (
    <p className="whitespace-pre-wrap break-words">
      <LiteMarkdown text={text} />
    </p>
  )
}
