import { useState } from 'react'
import { useApp } from '../store'
import { t } from '../i18n'

async function hashPin(saltHex: string, pin: string): Promise<string> {
  const data = new TextEncoder().encode(saltHex + ':' + pin)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function PasscodeLockGate({ children }: { children: React.ReactNode }) {
  const { state } = useApp()
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('docot.passcode.unlocked') === '1'
    } catch {
      return true
    }
  })
  const [pin, setPin] = useState('')
  const [err, setErr] = useState(false)

  // Early-return covers both "passcode disabled" and "already unlocked".
  // Re-locking after disable→enable is handled by setPasscode() which writes
  // the unlocked flag to sessionStorage for the device that set the new PIN.
  if (!state.prefs.passcode || unlocked) return <>{children}</>

  const verify = async () => {
    try {
      const salt = localStorage.getItem('docot.passcode.salt') ?? ''
      const want = localStorage.getItem('docot.passcode.hash') ?? ''
      const got = await hashPin(salt, pin)
      if (got === want) {
        try {
          sessionStorage.setItem('docot.passcode.unlocked', '1')
        } catch {
          /* ignore */
        }
        setUnlocked(true)
      } else {
        setErr(true)
        setPin('')
        window.setTimeout(() => setErr(false), 800)
      }
    } catch {
      setErr(true)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-paper text-ink p-6">
      <div className="w-full max-w-xs rounded-3xl border-2 border-ink p-6">
        <div className="mb-3 text-center text-base font-black uppercase tracking-wide">
          {t('settings.passcode', state.lang)}
        </div>
        <p className="mb-4 text-center text-xs text-muted">
          {state.lang === 'ru' ? 'Введите ваш PIN' : 'Enter your PIN'}
        </p>
        <input
          autoFocus
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          inputMode="numeric"
          maxLength={4}
          placeholder="••••"
          className={`bw-input mb-3 text-center text-2xl tracking-[0.6em] ${err ? 'border-red-600 text-red-600' : ''}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && pin.length === 4) void verify()
          }}
        />
        <button
          disabled={pin.length !== 4}
          className="bw-btn-primary w-full disabled:opacity-50"
          onClick={() => void verify()}
        >
          {state.lang === 'ru' ? 'Разблокировать' : 'Unlock'}
        </button>
      </div>
    </div>
  )
}
