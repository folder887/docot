/* AvatarBuilder — modal that lets the user assemble a paper-doll avatar
 * from a small set of layered SVG primitives, then persist it to their
 * profile as a compact JSON config.
 */

import { useState } from 'react'
import { Modal } from './Modal'
import {
  AvatarSVG,
  BG,
  SKIN,
  HEAD,
  HAIR,
  EYES,
  MOUTH,
  ACCESSORY,
  DEFAULT_AVATAR,
  type AvatarConfig,
} from './AvatarSVG'
import { useApp } from '../store'
import { t } from '../i18n'

type Tab = 'bg' | 'skin' | 'head' | 'hair' | 'eyes' | 'mouth' | 'accessory'

const TABS: { key: Tab; labelKey: string }[] = [
  { key: 'bg', labelKey: 'avatar.bg' },
  { key: 'skin', labelKey: 'avatar.skin' },
  { key: 'head', labelKey: 'avatar.head' },
  { key: 'hair', labelKey: 'avatar.hair' },
  { key: 'eyes', labelKey: 'avatar.eyes' },
  { key: 'mouth', labelKey: 'avatar.mouth' },
  { key: 'accessory', labelKey: 'avatar.accessory' },
]

function randomConfig(): AvatarConfig {
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]
  return {
    bg: pick(Object.keys(BG)) as keyof typeof BG,
    skin: pick(Object.keys(SKIN)) as keyof typeof SKIN,
    head: pick(HEAD),
    hair: pick(HAIR),
    eyes: pick(EYES),
    mouth: pick(MOUTH),
    accessory: pick(ACCESSORY),
  }
}

export function AvatarBuilder({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean
  initial: AvatarConfig | null
  onClose: () => void
  onSave: (config: AvatarConfig) => void | Promise<void>
}) {
  const { state } = useApp()
  const lang = state.lang
  const [config, setConfig] = useState<AvatarConfig>(initial ?? DEFAULT_AVATAR)
  const [tab, setTab] = useState<Tab>('bg')
  const [busy, setBusy] = useState(false)

  const set = <K extends keyof AvatarConfig>(k: K, v: AvatarConfig[K]) =>
    setConfig((c) => ({ ...c, [k]: v }))

  const renderOptions = () => {
    switch (tab) {
      case 'bg':
        return (
          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(BG) as (keyof typeof BG)[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => set('bg', k)}
                className={`flex h-12 items-center justify-center rounded-xl border-2 ${
                  config.bg === k ? 'border-ink ring-2 ring-ink' : 'border-ink/40'
                }`}
                style={{ background: BG[k] }}
                aria-label={k}
              />
            ))}
          </div>
        )
      case 'skin':
        return (
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(SKIN) as (keyof typeof SKIN)[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => set('skin', k)}
                className={`flex h-12 items-center justify-center rounded-xl border-2 ${
                  config.skin === k ? 'border-ink ring-2 ring-ink' : 'border-ink/40'
                }`}
                style={{ background: SKIN[k] }}
                aria-label={k}
              />
            ))}
          </div>
        )
      case 'head':
      case 'hair':
      case 'eyes':
      case 'mouth':
      case 'accessory': {
        const opts =
          tab === 'head' ? HEAD : tab === 'hair' ? HAIR : tab === 'eyes' ? EYES : tab === 'mouth' ? MOUTH : ACCESSORY
        return (
          <div className="grid grid-cols-4 gap-2">
            {opts.map((opt) => {
              const previewConfig = { ...config, [tab]: opt } as AvatarConfig
              const selected = (config as Record<string, string>)[tab] === opt
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => set(tab, opt as never)}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 p-2 ${
                    selected ? 'border-ink ring-2 ring-ink' : 'border-ink/40'
                  }`}
                >
                  <AvatarSVG config={previewConfig} size={56} />
                  <span className="text-[10px] font-bold capitalize">{opt}</span>
                </button>
              )
            })}
          </div>
        )
      }
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('avatar.title', lang)} align="center">
      <div className="flex flex-col items-center gap-4">
        <AvatarSVG config={config} size={144} />

        <div className="flex flex-wrap justify-center gap-2">
          {TABS.map((tabDef) => (
            <button
              key={tabDef.key}
              type="button"
              onClick={() => setTab(tabDef.key)}
              className={`rounded-full border-2 border-ink px-3 py-1 text-xs font-bold ${
                tab === tabDef.key ? 'bg-ink text-paper' : 'bg-paper text-ink'
              }`}
            >
              {t(tabDef.labelKey, lang)}
            </button>
          ))}
        </div>

        <div className="w-full">{renderOptions()}</div>

        <div className="flex w-full gap-2">
          <button
            type="button"
            onClick={() => setConfig(randomConfig())}
            className="flex-1 rounded-full border-2 border-ink bg-paper px-3 py-2 text-sm font-bold transition-transform active:scale-95"
          >
            🎲 {t('avatar.random', lang)}
          </button>
          <button
            type="button"
            onClick={() => setConfig(DEFAULT_AVATAR)}
            className="flex-1 rounded-full border-2 border-ink bg-paper px-3 py-2 text-sm font-bold"
          >
            {t('common.reset', lang)}
          </button>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await onSave(config)
              onClose()
            } finally {
              setBusy(false)
            }
          }}
          className="w-full rounded-full border-2 border-ink bg-ink py-3 font-black text-paper disabled:opacity-50"
        >
          {busy ? '…' : t('common.save', lang)}
        </button>
      </div>
    </Modal>
  )
}
