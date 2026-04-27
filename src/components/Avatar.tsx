import { AvatarSVG, decodeAvatarConfig } from './AvatarSVG'

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export function Avatar({
  name,
  size = 44,
  filled,
  src,
  svgConfig,
}: {
  name: string
  size?: number
  filled?: boolean
  /** When set, renders the image and falls back to initials if it fails. */
  src?: string | null
  /** When set, renders a constructed paper-doll avatar from the JSON config.
   * Takes precedence over `src`. */
  svgConfig?: string | null
}) {
  const style = { width: size, height: size, fontSize: size * 0.38 }
  const cfg = decodeAvatarConfig(svgConfig)
  if (cfg) {
    return <AvatarSVG config={cfg} size={size} />
  }
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={style}
        className="flex flex-shrink-0 rounded-full border-2 border-black object-cover"
        onError={(e) => {
          // Fall back to initials avatar by clearing the src; the caller will
          // re-render the image only if a fresh URL becomes available.
          e.currentTarget.style.display = 'none'
        }}
      />
    )
  }
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
