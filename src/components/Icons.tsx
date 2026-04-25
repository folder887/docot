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

export function IconBell({ size = 20, className, stroke = 2, muted }: IconProps & { muted?: boolean }) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9z" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      {muted && <line x1="3" y1="3" x2="21" y2="21" strokeWidth={stroke + 0.5} />}
    </svg>
  )
}

export function IconPhone({ size = 20, className, stroke = 2 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.54 19.54 0 0 1-6-6 19.86 19.86 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.95.36 1.9.68 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.32 1.85.55 2.81.68A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

export function IconMoreH({ size = 20, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="currentColor">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  )
}

export function IconUserPlus({ size = 20, className, stroke = 2 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="16" y1="11" x2="22" y2="11" />
    </svg>
  )
}

export function IconBlock({ size = 20, className, stroke = 2 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={stroke} fill="none" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
    </svg>
  )
}

export function IconUser({ size = 20, className, stroke = 2 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

export function IconChannel({ size = 20, className, stroke = 2 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11v2a2 2 0 0 0 2 2h2l5 4V5L7 9H5a2 2 0 0 0-2 2z" />
      <path d="M16 8a5 5 0 0 1 0 8" />
      <path d="M19 5a9 9 0 0 1 0 14" />
    </svg>
  )
}

export function IconLock({ size = 20, className, stroke = 2 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

export function IconPalette({ size = 20, className, stroke = 2 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22a10 10 0 1 1 0-20c5.5 0 10 4 10 8.5 0 3-2.5 4-4 4h-2a2 2 0 0 0-1 3.5c.5 1.5 0 4-3 4z" />
      <circle cx="7" cy="12" r="1" fill="currentColor" />
      <circle cx="10" cy="7" r="1" fill="currentColor" />
      <circle cx="16" cy="7" r="1" fill="currentColor" />
      <circle cx="18" cy="12" r="1" fill="currentColor" />
    </svg>
  )
}

export function IconFolder({ size = 20, className, stroke = 2 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  )
}

export function IconSliders({ size = 20, className, stroke = 2 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={stroke} fill="none" strokeLinecap="round">
      <line x1="4" y1="8" x2="20" y2="8" />
      <line x1="4" y1="16" x2="20" y2="16" />
      <circle cx="9" cy="8" r="2" fill="var(--paper)" />
      <circle cx="15" cy="16" r="2" fill="var(--paper)" />
    </svg>
  )
}

export function IconSpeaker({ size = 20, className, stroke = 2 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19" />
      <path d="M19 5a10 10 0 0 1 0 14" />
      <path d="M16 9a5 5 0 0 1 0 6" />
    </svg>
  )
}

export function IconBattery({ size = 20, className, stroke = 2 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="17" height="10" rx="2" />
      <line x1="22" y1="11" x2="22" y2="13" />
      <rect x="4" y="9" width="10" height="6" fill="currentColor" />
    </svg>
  )
}

export function IconChevron({ size = 18, className, stroke = 2.5 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 6 15 12 9 18" />
    </svg>
  )
}

export function IconQR({ size = 18, className, stroke = 2 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20v1" />
    </svg>
  )
}

export function IconMic({ size = 22, className, stroke = 2 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  )
}

export function IconPaperclip({ size = 22, className, stroke = 2 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.5 11.5 12 21a5 5 0 0 1-7-7L14 5a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8" />
    </svg>
  )
}

export function IconStop({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  )
}

export function IconPlay({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="currentColor">
      <path d="M7 5v14l12-7-12-7z" />
    </svg>
  )
}

export function IconPause({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} fill="currentColor">
      <rect x="6" y="5" width="4" height="14" />
      <rect x="14" y="5" width="4" height="14" />
    </svg>
  )
}

export function IconBold({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" />
    </svg>
  )
}

export function IconItalic({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 4h-5M15 20h-5M15 4l-6 16" />
    </svg>
  )
}

export function IconStrike({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12h16" />
      <path d="M16 6a4 4 0 0 0-8 0c0 2 2 3 4 4M8 18a4 4 0 0 0 8 0c0-1.4-1-2.4-2.5-3" />
    </svg>
  )
}

export function IconCode({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 8 5 12 9 16" />
      <polyline points="15 8 19 12 15 16" />
    </svg>
  )
}

export function IconImage({ size = 22, className, stroke = 2 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  )
}

export function IconCopy({ size = 18, className, stroke = 2 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h9" />
    </svg>
  )
}

export function IconLink({ size = 18, className, stroke = 2 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 15a4 4 0 0 1 0-6l3-3a4 4 0 0 1 6 6l-1.5 1.5" />
      <path d="M15 9a4 4 0 0 1 0 6l-3 3a4 4 0 0 1-6-6l1.5-1.5" />
    </svg>
  )
}

export function IconEdit({ size = 18, className, stroke = 2 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h4l11-11-4-4L4 16v4z" />
    </svg>
  )
}

export function IconForward({ size = 18, className, stroke = 2 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 17 20 12 15 7" />
      <path d="M4 18v-2a4 4 0 0 1 4-4h12" />
    </svg>
  )
}

export function IconScan({ size = 20, className, stroke = 2 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M21 7V5a2 2 0 0 0-2-2h-2" />
      <path d="M3 17v2a2 2 0 0 0 2 2h2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </svg>
  )
}
