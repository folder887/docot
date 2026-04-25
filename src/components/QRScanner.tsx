import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

export type QRScannerProps = {
  onResult: (text: string) => void
  onClose: () => void
  facingMode?: 'environment' | 'user'
}

/**
 * Live QR scanner that uses getUserMedia + jsQR.
 * On platforms without a camera (or when permission is denied), falls back
 * to "scan an image file" using <input type="file" capture>.
 */
export function QRScanner({ onResult, onClose, facingMode = 'environment' }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string | null>(null)
  const stoppedRef = useRef(false)

  useEffect(() => {
    let stream: MediaStream | null = null
    let raf = 0
    stoppedRef.current = false

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError('camera-unavailable')
          return
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: false,
        })
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        video.setAttribute('playsinline', 'true')
        await video.play()
        tick()
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setError(msg || 'camera-error')
      }
    }

    const tick = () => {
      if (stoppedRef.current) return
      const video = videoRef.current
      const canvas = canvasRef.current
      if (video && canvas && video.readyState >= 2) {
        const w = video.videoWidth
        const h = video.videoHeight
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (ctx && w && h) {
          ctx.drawImage(video, 0, 0, w, h)
          const img = ctx.getImageData(0, 0, w, h)
          const code = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' })
          if (code?.data) {
            stoppedRef.current = true
            onResult(code.data)
            return
          }
        }
      }
      raf = requestAnimationFrame(tick)
    }

    void start()

    return () => {
      stoppedRef.current = true
      cancelAnimationFrame(raf)
      if (stream) {
        for (const tr of stream.getTracks()) tr.stop()
      }
    }
  }, [facingMode, onResult])

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    try {
      const img = await loadImage(url)
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const ctx = c.getContext('2d')
      if (!ctx) return
      ctx.drawImage(img, 0, 0)
      const data = ctx.getImageData(0, 0, c.width, c.height)
      const code = jsQR(data.data, c.width, c.height)
      if (code?.data) onResult(code.data)
      else setError('no-code')
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative overflow-hidden rounded-2xl border-2 border-ink"
        style={{ background: 'var(--ink)', aspectRatio: '1 / 1' }}
      >
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          muted
          playsInline
        />
        <canvas ref={canvasRef} className="hidden" />
        <div
          className="pointer-events-none absolute inset-0 m-8 rounded-xl border-4"
          style={{ borderColor: 'rgba(255,255,255,0.7)' }}
        />
      </div>
      {error && (
        <div className="text-center text-xs text-muted">
          {error === 'camera-unavailable'
            ? 'Camera not available. Pick an image to scan.'
            : error === 'no-code'
              ? 'No QR code detected. Try another image.'
              : `Camera error: ${error}`}
        </div>
      )}
      <label className="bw-btn-ghost cursor-pointer text-center">
        <input type="file" accept="image/*" className="hidden" onChange={onPickFile} />
        Pick image
      </label>
      <button className="bw-btn-primary" onClick={onClose}>
        Cancel
      </button>
    </div>
  )
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
