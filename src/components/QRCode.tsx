import { useEffect, useRef, useState } from 'react'
import QRCodeLib from 'qrcode'

/** Real, scannable QR code (uses the `qrcode` npm package). */
export function QRCode({
  text,
  size = 220,
  margin = 1,
}: {
  text: string
  size?: number
  margin?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    let cancelled = false
    const fg = readVar('--ink') || '#000000'
    const bg = readVar('--paper') || '#ffffff'
    QRCodeLib.toCanvas(
      canvasRef.current,
      text || ' ',
      {
        width: size,
        margin,
        errorCorrectionLevel: 'M',
        color: { dark: fg, light: bg },
      },
      (err) => {
        if (cancelled) return
        if (err) setError(err.message)
        else setError(null)
      },
    )
    return () => {
      cancelled = true
    }
  }, [text, size, margin])

  return (
    <div className="flex flex-col items-center gap-2">
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="rounded-xl"
        style={{ width: size, height: size, background: 'var(--paper)' }}
      />
      {error && <span className="text-xs text-muted">{error}</span>}
    </div>
  )
}

function readVar(name: string): string {
  if (typeof window === 'undefined') return ''
  const v = getComputedStyle(document.documentElement).getPropertyValue(name)
  return v.trim()
}
