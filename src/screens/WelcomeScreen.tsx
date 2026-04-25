import { Link } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { useApp } from '../store'
import { t } from '../i18n'

export function WelcomeScreen() {
  const { state, setLang } = useApp()
  return (
    <div className="flex h-full min-h-[100svh] w-full flex-col bg-paper text-ink">
      {/* Top: language switcher under a thick separator line */}
      <div className="px-8 pt-10">
        <div className="flex items-center justify-center gap-2">
          <LangPill active={state.lang === 'en'} onClick={() => setLang('en')}>
            EN
          </LangPill>
          <LangPill active={state.lang === 'ru'} onClick={() => setLang('ru')}>
            RU
          </LangPill>
        </div>
        <div className="mx-auto mt-4 h-[3px] w-full" style={{ background: 'var(--ink)' }} />
      </div>

      {/* Middle: logo and tagline */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <Logo size={132} />
        <div className="italic-display mt-6 text-[44px] leading-none">docot</div>
        <p className="mt-4 max-w-[280px] whitespace-pre-line text-sm leading-relaxed text-muted">
          {t('welcome.tagline', state.lang)}
        </p>
      </div>

      {/* Bottom: action buttons fixed to bottom safe area */}
      <div
        className="flex flex-col gap-3 px-6 pb-10 pt-4"
        style={{ paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))' }}
      >
        <Link to="/signup" className="bw-btn-primary text-lg">
          {t('welcome.createAcc', state.lang)}
        </Link>
        <Link to="/login" className="bw-btn-ghost text-lg">
          {t('welcome.haveAcc', state.lang)}
        </Link>
      </div>
    </div>
  )
}

function LangPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border-2 px-5 py-1.5 text-sm font-bold transition-colors"
      style={{
        borderColor: 'var(--ink)',
        background: active ? 'var(--ink)' : 'var(--paper)',
        color: active ? 'var(--paper)' : 'var(--ink)',
      }}
    >
      {children}
    </button>
  )
}
