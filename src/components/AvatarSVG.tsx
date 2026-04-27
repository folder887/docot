import type { ReactElement } from 'react'

/**
 * Minimalist neobrutalism avatar generator.
 *
 * Replaces the previous paper-doll faces with pure 2-color geometric tiles:
 * - background: black or white
 * - pattern overlay: dots / stripes / checker / chevron / grid / triangles /
 *                    crosses / circles / diamonds / hex
 * - rotation: 0/45/90/135 degrees
 * - optional uppercase initial drawn over the pattern
 *
 * The whole thing is encoded as a small JSON config saved to user.avatar_svg
 * and rendered client-side.
 */

export const BG_COLORS = ['#ffffff', '#0a0a0a'] as const
export type BgColor = (typeof BG_COLORS)[number]

export const PATTERNS = [
  'solid',
  'dots',
  'stripes',
  'diag',
  'checker',
  'grid',
  'chevron',
  'triangles',
  'cross',
  'circles',
  'diamonds',
  'rings',
] as const
export type Pattern = (typeof PATTERNS)[number]

export const ROTATIONS = [0, 45, 90, 135] as const
export type Rotation = (typeof ROTATIONS)[number]

export type AvatarConfig = {
  bg: BgColor
  pattern: Pattern
  rot: Rotation
  /** Single uppercase letter drawn over the pattern. Empty hides the glyph. */
  initial: string
}

export const DEFAULT_AVATAR: AvatarConfig = {
  bg: '#ffffff',
  pattern: 'dots',
  rot: 0,
  initial: '',
}

export function encodeAvatarConfig(c: AvatarConfig): string {
  return JSON.stringify(c)
}

export function decodeAvatarConfig(s: string | null | undefined): AvatarConfig | null {
  if (!s) return null
  try {
    const o = JSON.parse(s) as Partial<AvatarConfig>
    if (!o || typeof o !== 'object') return null
    const bg: BgColor = (BG_COLORS as readonly string[]).includes(o.bg ?? '')
      ? (o.bg as BgColor)
      : DEFAULT_AVATAR.bg
    const pattern: Pattern = (PATTERNS as readonly string[]).includes(o.pattern ?? '')
      ? (o.pattern as Pattern)
      : DEFAULT_AVATAR.pattern
    const rot: Rotation = (ROTATIONS as readonly number[]).includes(o.rot ?? -1)
      ? (o.rot as Rotation)
      : DEFAULT_AVATAR.rot
    const initial = (o.initial ?? '').toString().trim().slice(0, 1).toUpperCase()
    return { bg, pattern, rot, initial }
  } catch {
    return null
  }
}

const VIEW = 200

function fg(bg: BgColor): string {
  return bg === '#ffffff' ? '#0a0a0a' : '#ffffff'
}

type PatternProps = { color: string; bg: BgColor }

function Dots({ color }: PatternProps) {
  const dots: ReactElement[] = []
  const step = 28
  for (let y = step / 2; y < VIEW; y += step) {
    for (let x = step / 2; x < VIEW; x += step) {
      dots.push(<circle key={`${x}-${y}`} cx={x} cy={y} r={4.5} fill={color} />)
    }
  }
  return <g>{dots}</g>
}

function Stripes({ color }: PatternProps) {
  const lines: ReactElement[] = []
  const w = 14
  for (let y = 0; y < VIEW; y += w * 2) {
    lines.push(<rect key={y} x={0} y={y} width={VIEW} height={w} fill={color} />)
  }
  return <g>{lines}</g>
}

function Diag({ color }: PatternProps) {
  const lines: ReactElement[] = []
  const w = 12
  // diagonal lines via thick rotated rects
  for (let i = -VIEW; i < VIEW * 2; i += w * 2) {
    lines.push(
      <rect
        key={i}
        x={i}
        y={-VIEW}
        width={w}
        height={VIEW * 3}
        fill={color}
        transform={`rotate(45 ${VIEW / 2} ${VIEW / 2})`}
      />,
    )
  }
  return <g>{lines}</g>
}

function Checker({ color }: PatternProps) {
  const cells: ReactElement[] = []
  const n = 5
  const s = VIEW / n
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if ((x + y) % 2 === 0) {
        cells.push(<rect key={`${x}-${y}`} x={x * s} y={y * s} width={s} height={s} fill={color} />)
      }
    }
  }
  return <g>{cells}</g>
}

function Grid({ color }: PatternProps) {
  const lines: ReactElement[] = []
  const step = 25
  const t = 3
  for (let v = step; v < VIEW; v += step) {
    lines.push(<rect key={`h${v}`} x={0} y={v - t / 2} width={VIEW} height={t} fill={color} />)
    lines.push(<rect key={`v${v}`} x={v - t / 2} y={0} width={t} height={VIEW} fill={color} />)
  }
  return <g>{lines}</g>
}

function Chevron({ color }: PatternProps) {
  const w = 22
  const items: ReactElement[] = []
  let key = 0
  for (let y = 0; y < VIEW + w; y += w) {
    for (let x = -w; x < VIEW + w; x += w * 2) {
      items.push(
        <polygon
          key={key++}
          points={`${x},${y} ${x + w},${y - w / 2} ${x + 2 * w},${y} ${x + w},${y + w / 2}`}
          fill={color}
        />,
      )
    }
  }
  return <g>{items}</g>
}

function Triangles({ color }: PatternProps) {
  const items: ReactElement[] = []
  const s = 36
  let key = 0
  for (let y = 0; y < VIEW; y += s) {
    for (let x = 0; x < VIEW; x += s) {
      const flip = (x / s + y / s) % 2 === 0
      items.push(
        <polygon
          key={key++}
          points={
            flip
              ? `${x},${y} ${x + s},${y} ${x},${y + s}`
              : `${x + s},${y} ${x + s},${y + s} ${x},${y + s}`
          }
          fill={color}
        />,
      )
    }
  }
  return <g>{items}</g>
}

function Cross({ color }: PatternProps) {
  const items: ReactElement[] = []
  const step = 32
  const t = 4
  let key = 0
  for (let y = step; y < VIEW; y += step) {
    for (let x = step; x < VIEW; x += step) {
      const len = 14
      items.push(
        <rect key={key++} x={x - len / 2} y={y - t / 2} width={len} height={t} fill={color} />,
      )
      items.push(
        <rect key={key++} x={x - t / 2} y={y - len / 2} width={t} height={len} fill={color} />,
      )
    }
  }
  return <g>{items}</g>
}

function Circles({ color }: PatternProps) {
  const items: ReactElement[] = []
  const step = 32
  let key = 0
  for (let y = step / 2; y < VIEW; y += step) {
    for (let x = step / 2; x < VIEW; x += step) {
      items.push(
        <circle key={key++} cx={x} cy={y} r={11} fill="none" stroke={color} strokeWidth={3} />,
      )
    }
  }
  return <g>{items}</g>
}

function Diamonds({ color }: PatternProps) {
  const items: ReactElement[] = []
  const step = 36
  let key = 0
  for (let y = step / 2; y < VIEW + step; y += step) {
    for (let x = step / 2; x < VIEW + step; x += step) {
      items.push(
        <polygon
          key={key++}
          points={`${x},${y - 9} ${x + 9},${y} ${x},${y + 9} ${x - 9},${y}`}
          fill={color}
        />,
      )
    }
  }
  return <g>{items}</g>
}

function Rings({ color }: PatternProps) {
  return (
    <g fill="none" stroke={color} strokeWidth={6}>
      <circle cx={VIEW / 2} cy={VIEW / 2} r={36} />
      <circle cx={VIEW / 2} cy={VIEW / 2} r={64} />
      <circle cx={VIEW / 2} cy={VIEW / 2} r={92} />
    </g>
  )
}

function PatternLayer({ pattern, color, bg }: { pattern: Pattern } & PatternProps) {
  switch (pattern) {
    case 'solid':
      return null
    case 'dots':
      return <Dots color={color} bg={bg} />
    case 'stripes':
      return <Stripes color={color} bg={bg} />
    case 'diag':
      return <Diag color={color} bg={bg} />
    case 'checker':
      return <Checker color={color} bg={bg} />
    case 'grid':
      return <Grid color={color} bg={bg} />
    case 'chevron':
      return <Chevron color={color} bg={bg} />
    case 'triangles':
      return <Triangles color={color} bg={bg} />
    case 'cross':
      return <Cross color={color} bg={bg} />
    case 'circles':
      return <Circles color={color} bg={bg} />
    case 'diamonds':
      return <Diamonds color={color} bg={bg} />
    case 'rings':
      return <Rings color={color} bg={bg} />
    default:
      return null
  }
}

export function AvatarSVG({
  config = DEFAULT_AVATAR,
  size = 96,
  rounded = false,
}: {
  config?: AvatarConfig
  size?: number
  rounded?: boolean
}) {
  const { bg, pattern, rot, initial } = config
  const color = fg(bg)
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{
        display: 'block',
        borderRadius: rounded ? size / 2 : 0,
        border: '2px solid #000',
        background: bg,
      }}
    >
      <g transform={`rotate(${rot} ${VIEW / 2} ${VIEW / 2})`}>
        <PatternLayer pattern={pattern} color={color} bg={bg} />
      </g>
      {initial && (
        <text
          x={VIEW / 2}
          y={VIEW / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, sans-serif"
          fontWeight={900}
          fontSize={120}
          fill={color}
          style={{
            paintOrder: 'stroke',
            stroke: bg,
            strokeWidth: 18,
            strokeLinejoin: 'round',
          }}
        >
          {initial}
        </text>
      )}
    </svg>
  )
}
