import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { useApp } from '../store'

export function SplashScreen() {
  const navigate = useNavigate()
  const { state } = useApp()

  useEffect(() => {
    if (state.status === 'loading') return
    const id = window.setTimeout(() => {
      navigate(state.status === 'authed' ? '/chats' : '/welcome', { replace: true })
    }, 600)
    return () => window.clearTimeout(id)
  }, [navigate, state.status])

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-paper text-ink">
      <Logo size={120} />
      <div className="italic-display mt-6 text-4xl">docot</div>
      <div className="mt-2 text-xs uppercase tracking-[0.4em] text-black/60">all in one</div>
    </div>
  )
}
