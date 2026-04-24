type IconProps = { size?: number; className?: string; stroke?: number }

const base = (size = 24) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none' })

export function IconMenu({ size = 24, className, stroke = 2.5 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

export function IconChat({ size = 24, className, stroke = 2.5 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round" strokeLinecap="round">
      <path d="M4 5h16v11H9l-5 4V5z" fill="currentColor" fillOpacity="0.08" />
    </svg>
  )
}

export function IconCalendar({ size = 24, className, stroke = 2.5 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round" strokeLinecap="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </svg>
  )
}

export function IconNote({ size = 24, className, stroke = 2.5 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round" strokeLinecap="round">
      <path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M15 3v5h5" />
      <line x1="12" y1="13" x2="12" y2="19" />
      <line x1="9" y1="16" x2="15" y2="16" />
    </svg>
  )
}

export function IconNews({ size = 24, className, stroke = 2.5 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round" strokeLinecap="round">
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <line x1="7" y1="9" x2="12" y2="9" />
      <line x1="7" y1="13" x2="17" y2="13" />
      <line x1="7" y1="16" x2="14" y2="16" />
      <rect x="14" y="8" width="4" height="3" fill="currentColor" />
    </svg>
  )
}

export function IconSearch({ size = 24, className, stroke = 2.5 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round">
      <circle cx="11" cy="11" r="6" />
      <line x1="20" y1="20" x2="16" y2="16" />
    </svg>
  )
}

export function IconSettings({ size = 24, className, stroke = 2.5 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  )
}

export function IconBack({ size = 24, className, stroke = 2.5 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 6 9 12 15 18" />
    </svg>
  )
}

export function IconPlus({ size = 24, className, stroke = 2.5 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

export function IconHeart({ size = 20, className, filled }: IconProps & { filled?: boolean }) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={2.2} fill={filled ? 'currentColor' : 'none'} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.8 6.6a5 5 0 0 0-8.3-1.3L12 5.9l-.5-.6A5 5 0 1 0 4 12.1c0 3 3.3 5.7 8 10 4.7-4.3 8-7 8-10 0-2-.7-3.6-1.2-4.5z" />
    </svg>
  )
}

export function IconRepeat({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  )
}

export function IconReply({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12h13a4 4 0 0 1 4 4v2" />
      <polyline points="8 8 4 12 8 16" />
    </svg>
  )
}

export function IconSend({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="none" fill="currentColor">
      <path d="M3 20l18-8L3 4l3 8-3 8z" />
    </svg>
  )
}

export function IconTrash({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

export function IconPin({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 9V2h14v7l-3 3 2 5H6l2-5-3-3z" />
    </svg>
  )
}

export function IconCheck({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
