import { useState } from 'react'

import { Modal } from './Modal'
import {
  AvatarSVG,
  BG_COLORS,
  DEFAULT_AVATAR,
  PATTERNS,
  ROTATIONS,
  type AvatarConfig,
  type BgColor,
  type Pattern,
  type Rotation,
} from './AvatarSVG'
import { useApp } from '../store'
import { t } from '../i18n'

function randomConfig(initial: string): AvatarConfig {
  return {
    bg: BG_COLORS[Math.floor(Math.random() * BG_COLORS.length)],
    pattern: PATTERNS[Math.floor(Math.random() * PATTERNS.length)],
    rot: ROTATIONS[Math.floor(Math.random() * ROTATIONS.length)],
    initial,
  }
}

export function AvatarBuilder({
  open,
  initial,
  defaultLetter = '',
  onClose,
  onSave,
}: {
  open: boolean
  initial?: AvatarConfig | null
  defaultLetter?: string
  onClose: () => void
  onSave: (cfg: AvatarConfig) => void
}) {
  const { state } = useApp()
  const [cfg, setCfg] = useState<AvatarConfig>(
    initial ?? { ...DEFAULT_AVATAR, initial: defaultLetter.slice(0, 1).toUpperCase() },
  )

  if (!open) return null

  const setBg = (bg: BgColor) => setCfg((c) => ({ ...c, bg }))
  const setPattern = (pattern: Pattern) => setCfg((c) => ({ ...c, pattern }))
  const setRot = (rot: Rotation) => setCfg((c) => ({ ...c, rot }))
  const setInitial = (s: string) =>
    setCfg((c) => ({ ...c, initial: s.slice(0, 1).toUpperCase() }))

  return (
    <Modal open={open} onClose={onClose} title={t('avatar.title', state.lang)}>
      <div className="flex flex-col items-stretch gap-4">
        <div className="flex flex-col items-center gap-3">
          <AvatarSVG config={cfg} size={160} rounded />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCfg(randomConfig(cfg.initial))}
              className="bw-btn"
            >
              {t('avatar.random', state.lang)}
            </button>
          </div>
        </div>

        {/* Background */}
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider opacity-60">
            {t('avatar.bg', state.lang)}
          </div>
          <div className="flex gap-2">
            {BG_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => setBg(c)}
                className={`h-10 w-10 border-2 border-ink ${cfg.bg === c ? 'ring-2 ring-ink ring-offset-2 ring-offset-paper' : ''}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>

        {/* Pattern */}
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider opacity-60">
            {t('avatar.pattern', state.lang)}
          </div>
          <div className="grid grid-cols-6 gap-2">
            {PATTERNS.map((p) => {
              const sample: AvatarConfig = { ...cfg, pattern: p, initial: '' }
              const active = cfg.pattern === p
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPattern(p)}
                  className={`flex items-center justify-center rounded-sm border-2 ${active ? 'border-ink ring-2 ring-ink ring-offset-2 ring-offset-paper' : 'border-ink/30'}`}
                >
                  <AvatarSVG config={sample} size={44} />
                </button>
              )
            })}
          </div>
        </div>

        {/* Rotation */}
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider opacity-60">
            {t('avatar.rot', state.lang)}
          </div>
          <div className="flex gap-2">
            {ROTATIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRot(r)}
                className={`bw-btn !px-3 !py-1.5 text-xs ${cfg.rot === r ? '!bg-ink !text-paper' : ''}`}
              >
                {r}°
              </button>
            ))}
          </div>
        </div>

        {/* Initial letter */}
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider opacity-60">
            {t('avatar.initial', state.lang)}
          </div>
          <input
            type="text"
            value={cfg.initial}
            maxLength={1}
            onChange={(e) => setInitial(e.target.value)}
            placeholder="A"
            className="bw-input w-20 text-center font-black uppercase"
          />
        </div>

        <div className="mt-2 flex justify-end gap-2 border-t-2 border-ink pt-3">
          <button type="button" onClick={onClose} className="bw-btn">
            {t('common.cancel', state.lang)}
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(cfg)
              onClose()
            }}
            className="bw-btn !bg-ink !text-paper"
          >
            {t('common.save', state.lang)}
          </button>
        </div>
      </div>
    </Modal>
  )
}
