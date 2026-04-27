/**
 * Lightweight notification helper. Centralises:
 * - in-app sound playback (driven by `prefs.sounds`)
 * - browser desktop notifications (Notification API, opt-in)
 *
 * Push notifications via VAPID/WebPush are intentionally not handled here —
 * those require a backend subscription endpoint and a service worker, and
 * are tracked separately.
 */

let audioCtx: AudioContext | null = null
let lastBeep = 0

export function ding(volume = 0.25): void {
  // Throttle to 1 beep per 250ms to avoid blasting on bulk message arrival.
  const now = Date.now()
  if (now - lastBeep < 250) return
  lastBeep = now
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    if (!audioCtx) audioCtx = new Ctx()
    const ctx = audioCtx
    if (ctx.state === 'suspended') void ctx.resume()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = 880
    g.gain.value = 0
    g.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18)
    o.connect(g)
    g.connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + 0.2)
  } catch {
    // No-op — audio is best-effort.
  }
}

export async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  try {
    const r = await Notification.requestPermission()
    return r
  } catch {
    return 'denied'
  }
}

export function desktopNotify(title: string, body: string, onClick?: () => void): void {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') return
  try {
    const n = new Notification(title, {
      body: body.slice(0, 200),
      icon: '/icon-192.png',
      silent: false,
    })
    if (onClick) n.onclick = () => {
      window.focus()
      onClick()
    }
  } catch {
    // No-op.
  }
}
