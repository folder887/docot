import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { useApp } from '../store'
import { t } from '../i18n'
import { Modal } from '../components/Modal'
import { QRScanner } from '../components/QRScanner'
import { showToast } from '../components/Toast'

export function WelcomeScreen() {
  const { state, setLang, loginByPair } = useApp()
  const navigate = useNavigate()
  const [scanOpen, setScanOpen] = useState(false)

  const onQrResult = async (raw: string) => {
    setScanOpen(false)
    let token = raw.trim()
    const m = token.match(/token=([^&\s]+)/)
    if (m) token = decodeURIComponent(m[1])
    try {
      await loginByPair(token)
      showToast(state.lang === 'ru' ? 'Вход выполнен' : 'Signed in')
      navigate('/chats')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      showToast(msg, 'error')
    }
  }
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
        <button
          type="button"
          onClick={() => setScanOpen(true)}
          className="text-sm font-bold underline-offset-2 hover:underline"
        >
          {state.lang === 'ru' ? 'Войти по QR с другого устройства' : 'Sign in with QR from another device'}
        </button>
      </div>

      <Modal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        title={state.lang === 'ru' ? 'Сканируйте QR' : 'Scan QR code'}
      >
        <QRScanner onResult={onQrResult} onClose={() => setScanOpen(false)} />
      </Modal>
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
