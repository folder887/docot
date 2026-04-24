import { useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { IconBack } from './Icons'

export function ScreenHeader({
  title,
  right,
  onBack,
}: {
  title: ReactNode
  right?: ReactNode
  onBack?: () => void
}) {
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b-2 border-black bg-white px-3 py-3">
      <button
        aria-label="Back"
        className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-black"
        onClick={() => (onBack ? onBack() : navigate(-1))}
      >
        <IconBack size={18} />
      </button>
      <h1 className="flex-1 truncate text-center text-base font-black">{title}</h1>
      <div className="flex min-w-9 items-center justify-end">{right}</div>
    </header>
  )
}
