type Props = { size?: number; className?: string }

export function Logo({ size = 40, className = '' }: Props) {
  return (
    <svg
      viewBox="0 0 2000 2000"
      width={size}
      height={size}
      className={className}
      aria-label="docot"
    >
      <circle cx="1354" cy="892" r="259" fill="currentColor" />
      <circle cx="647" cy="892" r="259" fill="currentColor" />
      <path
        d="M1438.03 987L1595 987C1595 987 1518.28 1157.04 1438.03 1241.06C1274.72 1412.04 804.185 1648.08 743.306 1419.23C721.787 1338.34 1846.56 1174.25 764.811 1282.69C650.682 1294.13 1068.62 1198.49 1172.97 1150.7C1283.54 1100.06 1438.03 987 1438.03 987Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function LogoWithWord({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <Logo size={size} />
      <span className="italic-display text-2xl leading-none">docot</span>
    </div>
  )
}
