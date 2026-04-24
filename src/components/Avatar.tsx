function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export function Avatar({ name, size = 44, filled }: { name: string; size?: number; filled?: boolean }) {
  const style = { width: size, height: size, fontSize: size * 0.38 }
  return (
    <div
      style={style}
      className={`flex flex-shrink-0 items-center justify-center rounded-full border-2 border-black font-black ${
        filled ? 'bg-black text-white' : 'bg-white text-black'
      }`}
    >
      {initials(name) || '•'}
    </div>
  )
}
