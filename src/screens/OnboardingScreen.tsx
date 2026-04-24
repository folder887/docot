import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { useApp } from '../store'
import { t } from '../i18n'

export function OnboardingScreen() {
  const { state, completeOnboarding } = useApp()
  const navigate = useNavigate()
  const [name, setName] = useState(state.me.name === 'You' ? '' : state.me.name)
  const [handle, setHandle] = useState(state.me.handle === '@you' ? '' : state.me.handle)

  const canContinue = name.trim().length >= 1

  return (
    <div className="flex h-full w-full flex-col bg-white px-6 py-10 text-black">
      <div className="flex flex-col items-center">
        <Logo size={64} />
        <div className="italic-display mt-3 text-2xl">docot</div>
      </div>

      <form
        className="mt-10 flex flex-1 flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!canContinue) return
          completeOnboarding(name.trim(), handle.trim())
          navigate('/chats', { replace: true })
        }}
      >
        <label className="flex flex-col gap-1 text-sm font-bold uppercase tracking-wide">
          {t('onboarding.name', state.lang)}
          <input
            autoFocus
            className="bw-input text-base normal-case tracking-normal"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={state.lang === 'ru' ? 'Алекс' : 'Alex'}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold uppercase tracking-wide">
          {t('onboarding.handle', state.lang)}
          <input
            className="bw-input text-base normal-case tracking-normal"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@you"
          />
        </label>

        <div className="mt-auto flex flex-col gap-3">
          <button
            type="submit"
            disabled={!canContinue}
            className="bw-btn-primary text-lg disabled:opacity-40"
          >
            {t('onboarding.start', state.lang)}
          </button>
        </div>
      </form>
    </div>
  )
}
