import { Link, useLocation } from 'react-router-dom'
import { LogoWithWord } from './Logo'
import { IconSearch, IconSettings } from './Icons'

export function TopBar({ onSearch }: { onSearch?: () => void }) {
  const { pathname } = useLocation()
  const showLogo = ['/chats', '/calendar', '/notes', '/news', '/menu'].includes(pathname)
  if (!showLogo) return null
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b-2 border-black bg-white px-4 py-3">
      <Link to="/chats" className="flex items-center">
        <LogoWithWord size={28} />
      </Link>
      <div className="flex items-center gap-3">
        <button
          aria-label="Search"
          className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-black"
          onClick={onSearch}
        >
          <IconSearch size={18} />
        </button>
        <Link
          to="/settings"
          aria-label="Settings"
          className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-black"
        >
          <IconSettings size={18} />
        </Link>
      </div>
    </header>
  )
}
