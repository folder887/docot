import { Link } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { useApp } from '../store'
import { t } from '../i18n'

export function WelcomeScreen() {
  const { state, setLang } = useApp()
  return (
    <div className="flex h-full w-full flex-col bg-white text-black">
      <div className="px-8 pt-10 text-center">
        <p className="italic-display text-[28px] leading-tight">
          {t('onboarding.language', state.lang)}
        </p>
        <div className="mx-auto mt-4 h-[2px] w-full bg-black" />
        <div className="mt-4 flex items-center justify-center gap-2">
          <LangPill code="en" active={state.lang === 'en'} onClick={() => setLang('en')}>
            EN
          </LangPill>
          <LangPill code="ru" active={state.lang === 'ru'} onClick={() => setLang('ru')}>
            RU
          </LangPill>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center">
        <Logo size={140} />
        <div className="italic-display mt-6 text-[40px] leading-none">WaSSup bro</div>
      </div>

      <div className="flex flex-col gap-3 px-6 pb-10">
        <Link to="/onboarding" className="bw-btn-primary text-lg">
          {t('welcome.createAcc', state.lang)}
        </Link>
        <Link to="/onboarding" className="bw-btn-ghost text-lg">
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
  code: string
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border-2 border-black px-4 py-1 text-sm font-bold ${
        active ? 'bg-black text-white' : 'bg-white text-black'
      }`}
    >
      {children}
    </button>
  )
}
