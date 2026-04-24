import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { ApiError } from '../api'
import { useApp } from '../store'
import { t } from '../i18n'

export function SignupScreen() {
  const { state, signup } = useApp()
  const navigate = useNavigate()
  const [handle, setHandle] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const cleanHandle = handle.trim().replace(/^@/, '')
  const canSubmit =
    name.trim().length >= 1 && cleanHandle.length >= 2 && password.length >= 6 && !busy

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setErr(null)
    try {
      await signup(cleanHandle, name.trim(), password)
      navigate('/chats', { replace: true })
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setErr(t('auth.handleTaken', state.lang))
      } else {
        setErr(t('auth.errorGeneric', state.lang))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full w-full flex-col bg-paper px-6 py-10 text-ink">
      <div className="flex flex-col items-center">
        <Logo size={64} />
        <div className="italic-display mt-3 text-2xl">docot</div>
        <div className="mt-1 text-xs uppercase tracking-[0.3em] text-muted">
          {t('auth.createTitle', state.lang)}
        </div>
      </div>

      <form className="mt-10 flex flex-1 flex-col gap-4" onSubmit={onSubmit}>
        <Field label={t('onboarding.name', state.lang)}>
          <input
            autoFocus
            className="bw-input text-base normal-case tracking-normal"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={state.lang === 'ru' ? 'Алекс' : 'Alex'}
          />
        </Field>
        <Field label={t('onboarding.handle', state.lang)}>
          <input
            className="bw-input text-base normal-case tracking-normal"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="@you"
          />
        </Field>
        <Field label={t('auth.password', state.lang)}>
          <input
            className="bw-input text-base normal-case tracking-normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="••••••"
            minLength={6}
          />
        </Field>
        {err && <div className="text-sm font-bold text-ink">{err}</div>}
        <div className="mt-auto flex flex-col gap-3">
          <button type="submit" disabled={!canSubmit} className="bw-btn-primary text-lg disabled:opacity-40">
            {busy ? '…' : t('onboarding.start', state.lang)}
          </button>
          <Link to="/login" className="text-center text-sm text-muted underline">
            {t('auth.haveAccount', state.lang)}
          </Link>
        </div>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-bold uppercase tracking-wide">
      {label}
      {children}
    </label>
  )
}
