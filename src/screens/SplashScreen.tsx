import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { useApp } from '../store'

export function SplashScreen() {
  const navigate = useNavigate()
  const { state } = useApp()

  useEffect(() => {
    const id = window.setTimeout(() => {
      navigate(state.onboarded ? '/chats' : '/welcome', { replace: true })
    }, 900)
    return () => window.clearTimeout(id)
  }, [navigate, state.onboarded])

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-white text-black">
      <Logo size={120} />
      <div className="italic-display mt-6 text-4xl">docot</div>
      <div className="mt-2 text-xs uppercase tracking-[0.4em] text-black/60">all in one</div>
    </div>
  )
}
