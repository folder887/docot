import { useEffect, useRef, useState } from 'react'
import { api, type ApiStickerPack } from '../api'
import { encodeMedia, type MediaDescriptor } from '../messageMedia'
import { uploadUrl } from '../api'
import { useApp } from '../store'
import { t } from '../i18n'
import { showToast } from './Toast'

type Props = {
  open: boolean
  onClose: () => void
  onPick: (text: string) => void
}

/** Bottom sheet with sticker packs the user can browse. Tapping a sticker
 *  emits a `kind:"sticker"` media descriptor as a normal message. The
 *  composer hands that to `onSend`, so the existing E2E / WS pipeline
 *  carries it through unchanged. */
export function StickerPicker({ open, onClose, onPick }: Props) {
  const { state } = useApp()
  const [packs, setPacks] = useState<ApiStickerPack[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newPackTitle, setNewPackTitle] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    api
      .listStickerPacks()
      .then((rows) => {
        if (!alive) return
        setPacks(rows)
        if (!active && rows.length > 0) setActive(rows[0].id)
      })
      .catch(() => {
        if (alive) showToast('Failed to load stickers', 'error')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const activePack = packs.find((p) => p.id === active) ?? null
  const isMine = activePack ? activePack.creatorId && state.me && activePack.creatorId === state.me.id : false

  const onPickSticker = (url: string, packId: string) => {
    const desc: MediaDescriptor = { kind: 'sticker', u: url, pk: packId }
    onPick(encodeMedia(desc))
    onClose()
  }

  const createPack = async () => {
    const title = newPackTitle.trim()
    if (!title) return
    try {
      const p = await api.createStickerPack(title)
      setPacks((prev) => [...prev, p])
      setActive(p.id)
      setNewPackTitle('')
      setCreating(false)
    } catch {
      showToast('Failed to create pack', 'error')
    }
  }

  const onUploadSticker = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !activePack) return
    if (!file.type.startsWith('image/')) {
      showToast('Sticker must be an image', 'error')
      return
    }
    try {
      const up = await api.uploadFile(file, file.name || 'sticker.webp')
      const s = await api.addSticker(activePack.id, up.url, '')
      setPacks((prev) =>
        prev.map((p) => (p.id === activePack.id ? { ...p, stickers: [...p.stickers, s] } : p)),
      )
    } catch {
      showToast('Failed to add sticker', 'error')
    }
  }

  if (!open) return null
  return (
    <>
      <button
        type="button"
        aria-label="close-sticker-picker"
        onClick={onClose}
        className="fixed inset-0 z-30 cursor-default bg-black/30"
      />
      <div className="fixed inset-x-0 bottom-0 z-40 max-h-[60vh] overflow-hidden rounded-t-3xl border-t-2 border-ink bg-paper">
        <div className="flex items-center justify-between border-b-2 border-ink px-3 py-2">
          <span className="text-sm font-black uppercase">{t('stickers.title', state.lang)}</span>
          <button type="button" onClick={onClose} className="text-sm font-bold underline">
            {t('common.close', state.lang)}
          </button>
        </div>
        {loading && (
          <p className="p-4 text-center text-sm text-muted">{t('common.loading', state.lang)}</p>
        )}
        {!loading && (
          <>
            <div className="flex gap-1 overflow-x-auto border-b border-ink/15 px-2 py-2">
              {packs.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActive(p.id)}
                  className={`flex h-10 min-w-[40px] items-center justify-center rounded-full border-2 px-2 text-base ${
                    p.id === active ? 'border-ink bg-ink text-paper' : 'border-ink bg-paper text-ink'
                  }`}
                  title={p.title}
                >
                  <span>{p.coverEmoji || '🟩'}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex h-10 min-w-[40px] items-center justify-center rounded-full border-2 border-dashed border-ink px-2 text-base text-ink"
                title={t('stickers.newPack', state.lang)}
              >
                +
              </button>
            </div>
            {creating && (
              <div className="flex items-center gap-2 border-b border-ink/15 p-2">
                <input
                  className="bw-input flex-1"
                  value={newPackTitle}
                  onChange={(e) => setNewPackTitle(e.target.value)}
                  placeholder={t('stickers.packTitle', state.lang)}
                  maxLength={80}
                />
                <button type="button" className="bw-btn-primary" onClick={() => void createPack()}>
                  {t('common.save', state.lang)}
                </button>
                <button type="button" onClick={() => setCreating(false)} className="text-sm">
                  {t('common.cancel', state.lang)}
                </button>
              </div>
            )}
            {activePack && (
              <div className="grid grid-cols-4 gap-2 overflow-y-auto p-3 sm:grid-cols-6">
                {activePack.stickers.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onPickSticker(s.url, activePack.id)}
                    className="flex aspect-square items-center justify-center rounded-xl border-2 border-ink bg-paper p-1 hover:bg-ink/5"
                    title={s.emoji}
                  >
                    <img
                      src={uploadUrl(s.url)}
                      alt={s.emoji}
                      className="max-h-full max-w-full object-contain"
                      loading="lazy"
                      draggable={false}
                    />
                  </button>
                ))}
                {isMine && (
                  <>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-ink p-1 text-ink"
                    >
                      +
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      hidden
                      accept="image/*"
                      onChange={onUploadSticker}
                    />
                  </>
                )}
                {activePack.stickers.length === 0 && !isMine && (
                  <p className="col-span-full p-2 text-center text-sm text-muted">
                    {t('stickers.empty', state.lang)}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
