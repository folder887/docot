/* Avatar constructor — paper-doll renderer in the app's neobrutalism style.
 *
 * The avatar is encoded as a small JSON config. Each layer (bg / skin / hair /
 * eyes / mouth / accessory) is rendered as an inline SVG path with a thick
 * black stroke. The config can be persisted on the user record (`avatarSvg`)
 * and rendered without any image upload — fully client-side.
 */

export type AvatarConfig = {
  bg: keyof typeof BG
  skin: keyof typeof SKIN
  head: (typeof HEAD)[number]
  hair: (typeof HAIR)[number]
  eyes: (typeof EYES)[number]
  mouth: (typeof MOUTH)[number]
  accessory: (typeof ACCESSORY)[number]
}

export const BG = {
  white: '#ffffff',
  yellow: '#fde047',
  cyan: '#67e8f9',
  pink: '#fbcfe8',
  lime: '#bef264',
  lavender: '#c4b5fd',
  peach: '#fed7aa',
  mint: '#a7f3d0',
}

export const SKIN = {
  light: '#fde7c8',
  peach: '#f3c79e',
  tan: '#d39468',
  brown: '#9e6b3a',
  dark: '#5a3a1f',
  ghost: '#fafafa',
}

export const HEAD = ['round', 'oval', 'square', 'heart'] as const
export const HAIR = ['bald', 'short', 'messy', 'pony', 'afro', 'mohawk', 'longCurly'] as const
export const EYES = ['dot', 'oval', 'closed', 'glasses', 'wink', 'star'] as const
export const MOUTH = ['smile', 'neutral', 'smirk', 'open', 'surprised', 'mustache'] as const
export const ACCESSORY = ['none', 'hat', 'headband', 'earring', 'scarf'] as const

export const DEFAULT_AVATAR: AvatarConfig = {
  bg: 'yellow',
  skin: 'light',
  head: 'round',
  hair: 'short',
  eyes: 'dot',
  mouth: 'smile',
  accessory: 'none',
}

const STROKE = '#0a0a0a'
const SW = 6

function Head({ skin, shape }: { skin: string; shape: AvatarConfig['head'] }) {
  switch (shape) {
    case 'oval':
      return <ellipse cx="100" cy="110" rx="48" ry="58" fill={skin} stroke={STROKE} strokeWidth={SW} />
    case 'square':
      return (
        <rect x="50" y="58" width="100" height="104" rx="14" fill={skin} stroke={STROKE} strokeWidth={SW} />
      )
    case 'heart':
      return (
        <path
          d="M100 168 C 40 130 38 80 70 70 C 88 64 96 80 100 92 C 104 80 112 64 130 70 C 162 80 160 130 100 168 Z"
          fill={skin}
          stroke={STROKE}
          strokeWidth={SW}
          strokeLinejoin="round"
        />
      )
    case 'round':
    default:
      return <circle cx="100" cy="110" r="54" fill={skin} stroke={STROKE} strokeWidth={SW} />
  }
}

function Hair({ kind }: { kind: AvatarConfig['hair'] }) {
  switch (kind) {
    case 'bald':
      return null
    case 'short':
      return (
        <path
          d="M52 88 C 56 50 144 50 148 88 L 142 76 L 130 84 L 120 70 L 108 82 L 96 70 L 84 82 L 72 70 L 60 84 L 52 88 Z"
          fill={STROKE}
          stroke={STROKE}
          strokeWidth={SW}
          strokeLinejoin="round"
        />
      )
    case 'messy':
      return (
        <path
          d="M48 70 L 60 50 L 72 70 L 84 46 L 96 70 L 108 44 L 120 70 L 132 50 L 144 70 L 152 92 L 48 92 Z"
          fill={STROKE}
          stroke={STROKE}
          strokeWidth={SW}
          strokeLinejoin="round"
        />
      )
    case 'pony':
      return (
        <>
          <path d="M52 86 C 56 50 144 50 148 86 L 50 90 Z" fill={STROKE} stroke={STROKE} strokeWidth={SW} strokeLinejoin="round" />
          <path d="M150 92 C 178 100 184 150 156 168" fill="none" stroke={STROKE} strokeWidth={SW * 1.4} strokeLinecap="round" />
        </>
      )
    case 'afro':
      return (
        <circle cx="100" cy="68" r="50" fill={STROKE} stroke={STROKE} strokeWidth={SW} />
      )
    case 'mohawk':
      return (
        <path
          d="M86 90 L 92 30 L 100 60 L 108 30 L 114 90 Z"
          fill={STROKE}
          stroke={STROKE}
          strokeWidth={SW}
          strokeLinejoin="round"
        />
      )
    case 'longCurly':
      return (
        <path
          d="M40 80 C 40 40 160 40 160 80 C 168 110 164 150 156 178 L 138 168 L 138 130 C 130 100 70 100 62 130 L 62 168 L 44 178 C 36 150 32 110 40 80 Z"
          fill={STROKE}
          stroke={STROKE}
          strokeWidth={SW}
          strokeLinejoin="round"
        />
      )
  }
}

function Eyes({ kind }: { kind: AvatarConfig['eyes'] }) {
  switch (kind) {
    case 'oval':
      return (
        <>
          <ellipse cx="80" cy="108" rx="7" ry="9" fill={STROKE} />
          <ellipse cx="120" cy="108" rx="7" ry="9" fill={STROKE} />
        </>
      )
    case 'closed':
      return (
        <>
          <path d="M70 108 Q 80 116 90 108" stroke={STROKE} strokeWidth={SW} fill="none" strokeLinecap="round" />
          <path d="M110 108 Q 120 116 130 108" stroke={STROKE} strokeWidth={SW} fill="none" strokeLinecap="round" />
        </>
      )
    case 'glasses':
      return (
        <>
          <circle cx="80" cy="110" r="14" fill="none" stroke={STROKE} strokeWidth={SW} />
          <circle cx="120" cy="110" r="14" fill="none" stroke={STROKE} strokeWidth={SW} />
          <line x1="94" y1="110" x2="106" y2="110" stroke={STROKE} strokeWidth={SW} />
          <circle cx="80" cy="110" r="3" fill={STROKE} />
          <circle cx="120" cy="110" r="3" fill={STROKE} />
        </>
      )
    case 'wink':
      return (
        <>
          <circle cx="80" cy="108" r="5" fill={STROKE} />
          <path d="M110 108 Q 120 116 130 108" stroke={STROKE} strokeWidth={SW} fill="none" strokeLinecap="round" />
        </>
      )
    case 'star':
      return (
        <>
          <Star cx={80} cy={108} />
          <Star cx={120} cy={108} />
        </>
      )
    case 'dot':
    default:
      return (
        <>
          <circle cx="80" cy="108" r="5" fill={STROKE} />
          <circle cx="120" cy="108" r="5" fill={STROKE} />
        </>
      )
  }
}

function Star({ cx, cy }: { cx: number; cy: number }) {
  const r = 8
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2
    const rad = i % 2 === 0 ? r : r / 2.4
    pts.push(`${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`)
  }
  return <polygon points={pts.join(' ')} fill={STROKE} />
}

function Mouth({ kind }: { kind: AvatarConfig['mouth'] }) {
  switch (kind) {
    case 'neutral':
      return <line x1="84" y1="138" x2="116" y2="138" stroke={STROKE} strokeWidth={SW} strokeLinecap="round" />
    case 'smirk':
      return <path d="M84 138 Q 100 144 116 132" stroke={STROKE} strokeWidth={SW} fill="none" strokeLinecap="round" />
    case 'open':
      return <ellipse cx="100" cy="140" rx="14" ry="10" fill={STROKE} />
    case 'surprised':
      return <circle cx="100" cy="140" r="8" fill={STROKE} />
    case 'mustache':
      return (
        <>
          <path d="M76 132 Q 88 140 100 134 Q 112 140 124 132" stroke={STROKE} strokeWidth={SW * 1.4} fill="none" strokeLinecap="round" />
          <path d="M86 142 Q 100 148 114 142" stroke={STROKE} strokeWidth={SW} fill="none" strokeLinecap="round" />
        </>
      )
    case 'smile':
    default:
      return <path d="M82 134 Q 100 152 118 134" stroke={STROKE} strokeWidth={SW} fill="none" strokeLinecap="round" />
  }
}

function Accessory({ kind }: { kind: AvatarConfig['accessory'] }) {
  switch (kind) {
    case 'hat':
      return (
        <path
          d="M40 78 L 60 30 L 140 30 L 160 78 Z"
          fill={STROKE}
          stroke={STROKE}
          strokeWidth={SW}
          strokeLinejoin="round"
        />
      )
    case 'headband':
      return (
        <rect x="46" y="78" width="108" height="14" fill="#ef4444" stroke={STROKE} strokeWidth={SW} />
      )
    case 'earring':
      return (
        <>
          <circle cx="48" cy="128" r="6" fill="#fbbf24" stroke={STROKE} strokeWidth={SW * 0.6} />
          <circle cx="152" cy="128" r="6" fill="#fbbf24" stroke={STROKE} strokeWidth={SW * 0.6} />
        </>
      )
    case 'scarf':
      return (
        <path
          d="M50 168 L 50 188 L 150 188 L 150 168 C 130 178 70 178 50 168 Z"
          fill="#ef4444"
          stroke={STROKE}
          strokeWidth={SW}
          strokeLinejoin="round"
        />
      )
    case 'none':
    default:
      return null
  }
}

export function AvatarSVG({
  config = DEFAULT_AVATAR,
  size = 96,
  rounded = true,
}: {
  config?: AvatarConfig | null
  size?: number
  rounded?: boolean
}) {
  const c = config ?? DEFAULT_AVATAR
  const bg = BG[c.bg] ?? BG.white
  const skin = SKIN[c.skin] ?? SKIN.light
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={
        rounded
          ? 'flex-shrink-0 rounded-full border-2 border-black bg-paper'
          : 'flex-shrink-0 border-2 border-black bg-paper'
      }
      style={{ width: size, height: size }}
    >
      <rect x="0" y="0" width="200" height="200" fill={bg} />
      <Head skin={skin} shape={c.head} />
      <Hair kind={c.hair} />
      <Eyes kind={c.eyes} />
      <Mouth kind={c.mouth} />
      <Accessory kind={c.accessory} />
    </svg>
  )
}

/** Serialize an AvatarConfig to a compact string suitable for storage. */
export function encodeAvatarConfig(c: AvatarConfig): string {
  return JSON.stringify(c)
}

/** Parse a stored config back into an AvatarConfig, or null on bad input. */
export function decodeAvatarConfig(s: string | null | undefined): AvatarConfig | null {
  if (!s) return null
  try {
    const parsed = JSON.parse(s) as Partial<AvatarConfig>
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.bg === 'string' &&
      typeof parsed.skin === 'string' &&
      typeof parsed.head === 'string' &&
      typeof parsed.hair === 'string' &&
      typeof parsed.eyes === 'string' &&
      typeof parsed.mouth === 'string' &&
      typeof parsed.accessory === 'string'
    ) {
      return parsed as AvatarConfig
    }
  } catch {
    /* fall through */
  }
  return null
}
