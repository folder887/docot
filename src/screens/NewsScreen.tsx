import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../store'
import { relTime, t } from '../i18n'
import { Avatar } from '../components/Avatar'
import { ConfirmDialog } from '../components/Modal'
import {
  IconHeart,
  IconRepeat,
  IconReply,
  IconImage,
  IconMic,
  IconPaperclip,
  IconUser,
  IconTrash,
} from '../components/Icons'
import { api } from '../api'
import type { NewsPost, PostMediaItem } from '../types'

type Tab = 'feed' | 'mine' | 'reposts'

export function NewsScreen() {
  const { state, addPost, toggleLike, repost, userById, deletePost } = useApp()
  const [tab, setTab] = useState<Tab>('feed')
  const [text, setText] = useState('')
  const [media, setMedia] = useState<PostMediaItem[]>([])
  const [mine, setMine] = useState<NewsPost[]>([])
  const [reposts, setReposts] = useState<NewsPost[]>([])
  const [loading, setLoading] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const audioInput = useRef<HTMLInputElement>(null)
  const me = state.me

  const reload = useCallback(async () => {
    if (tab === 'feed') return
    setLoading(true)
    try {
      const list = await (tab === 'mine' ? api.listMyPosts() : api.listMyReposts())
      const mapped: NewsPost[] = list.map((p) => ({
        id: p.id,
        authorId: p.authorId,
        text: p.text,
        at: p.at,
        likes: p.likes,
        reposts: p.reposts,
        replies: p.replies,
        liked: p.liked,
        reposted: p.reposted,
        media: p.media,
      }))
      if (tab === 'mine') setMine(mapped)
      else setReposts(mapped)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [reload])

  const onPickMedia = async (e: React.ChangeEvent<HTMLInputElement>, kind: PostMediaItem['kind']) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const up = await api.uploadFile(file, file.name)
      setMedia((m) => [
        ...m,
        {
          url: up.url,
          kind,
          name: up.name ?? file.name,
          mime: up.type ?? file.type,
          size: up.size ?? file.size,
        },
      ])
    } catch {
      /* ignore */
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const t0 = text.trim()
    if (!t0 && media.length === 0) return
    setText('')
    const m0 = media
    setMedia([])
    try {
      await addPost(t0, m0)
      if (tab === 'mine') void reload()
    } catch {
      /* ignore */
    }
  }

  const list = tab === 'feed' ? state.news : tab === 'mine' ? mine : reposts

  return (
    <div className="flex flex-col bg-paper text-ink">
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <Tabs tab={tab} onChange={setTab} lang={state.lang} />
        {me && (
          <Link
            to={`/profile/${me.id}`}
            aria-label={t('news.profile', state.lang)}
            className="row-press flex items-center gap-2 rounded-full border-2 border-ink px-3 py-1.5 text-xs font-bold"
          >
            <IconUser size={14} />
            <span className="hidden sm:inline">{t('news.profile', state.lang)}</span>
          </Link>
        )}
      </div>

      {tab === 'feed' && (
        <form className="border-b-2 border-ink p-4" onSubmit={submit}>
          <div className="flex gap-3">
            <Avatar name={me?.name ?? '?'} size={40} filled />
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              placeholder={t('news.composer', state.lang)}
              className="flex-1 resize-none bg-transparent text-base focus:outline-none"
            />
          </div>
          {media.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {media.map((m, i) => (
                <MediaThumb
                  key={i}
                  m={m}
                  onRemove={() => setMedia((arr) => arr.filter((_, j) => j !== i))}
                />
              ))}
            </div>
          )}
          <div className="mt-2 flex items-center gap-2">
            <input
              ref={fileInput}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                const k: PostMediaItem['kind'] = f && f.type.startsWith('video') ? 'video' : 'image'
                void onPickMedia(e, k)
              }}
            />
            <input
              ref={audioInput}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => void onPickMedia(e, 'audio')}
            />
            <IconBtn
              onClick={() => fileInput.current?.click()}
              title={t('news.media.add', state.lang)}
            >
              <IconImage size={18} />
            </IconBtn>
            <IconBtn
              onClick={() => audioInput.current?.click()}
              title={t('news.audio.add', state.lang)}
            >
              <IconMic size={18} />
            </IconBtn>
            <IconBtn
              onClick={() => fileInput.current?.click()}
              title="Attach"
            >
              <IconPaperclip size={18} />
            </IconBtn>
            <span className="flex-1" />
            <button
              type="submit"
              disabled={!text.trim() && media.length === 0}
              className="bw-btn-primary px-5 py-2 text-sm disabled:opacity-40"
            >
              {t('news.post', state.lang)}
            </button>
          </div>
        </form>
      )}

      {loading && tab !== 'feed' && (
        <p className="p-6 text-center text-sm text-muted">{t('common.loading', state.lang)}</p>
      )}

      {!loading && list.length === 0 && (
        <p className="p-6 text-center text-sm text-muted">
          {tab === 'feed'
            ? t('empty.news', state.lang)
            : tab === 'mine'
              ? t('news.empty.mine', state.lang)
              : t('news.empty.reposts', state.lang)}
        </p>
      )}

      <ul>
        {list.map((p) => {
          const a = userById(p.authorId)
          const displayName = a?.name ?? p.authorId
          const displayHandle = a?.handle ? `@${a.handle}` : ''
          const isMine = p.authorId === me?.id
          return (
            <li key={p.id} className="border-b border-line p-4 fade-in">
              <div className="flex gap-3">
                <Link to={`/profile/${p.authorId}`} className="shrink-0">
                  <Avatar name={displayName} size={40} filled={p.authorId !== me?.id} />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 text-sm">
                    <Link to={`/profile/${p.authorId}`} className="font-black hover:underline">
                      {displayName}
                    </Link>
                    {displayHandle && (
                      <Link to={`/profile/${p.authorId}`} className="opacity-70 hover:underline">
                        {displayHandle}
                      </Link>
                    )}
                    <span className="opacity-50">· {relTime(p.at, state.lang)}</span>
                    {isMine && (
                      <button
                        onClick={() => setDeleteId(p.id)}
                        className="ml-auto opacity-60 hover:opacity-100"
                        aria-label="delete"
                      >
                        <IconTrash size={14} />
                      </button>
                    )}
                  </div>
                  {p.text && (
                    <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                      {p.text}
                    </p>
                  )}
                  {p.media && p.media.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {p.media.map((m, i) => (
                        <MediaView key={i} m={m} />
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-between pr-4 text-muted">
                    <ActionBtn icon={<IconReply size={18} />} count={p.replies} onClick={() => {}} />
                    <ActionBtn
                      icon={<IconRepeat size={18} />}
                      count={p.reposts}
                      onClick={() => void repost(p.id)}
                      active={p.reposted}
                    />
                    <ActionBtn
                      icon={<IconHeart size={18} filled={p.liked} />}
                      count={p.likes}
                      onClick={() => void toggleLike(p.id)}
                      active={p.liked}
                    />
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      <ConfirmDialog
        open={!!deleteId}
        message={t('news.delete.confirm', state.lang)}
        okLabel={t('common.delete', state.lang)}
        cancelLabel={t('common.cancel', state.lang)}
        destructive
        onResolve={(ok) => {
          const id = deleteId
          setDeleteId(null)
          if (ok && id) {
            void deletePost(id).then(() => {
              setMine((arr) => arr.filter((p) => p.id !== id))
            })
          }
        }}
      />
    </div>
  )
}

function Tabs({ tab, onChange, lang }: { tab: Tab; onChange: (t: Tab) => void; lang: 'en' | 'ru' }) {
  return (
    <div className="flex gap-1">
      {(['feed', 'mine', 'reposts'] as Tab[]).map((k) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${
            tab === k ? 'bg-ink text-paper' : 'text-muted'
          }`}
        >
          {t(`news.tabs.${k}`, lang)}
        </button>
      ))}
    </div>
  )
}

function IconBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode
  onClick: () => void
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="row-press flex h-9 w-9 items-center justify-center rounded-full border border-line"
    >
      {children}
    </button>
  )
}

function MediaThumb({ m, onRemove }: { m: PostMediaItem; onRemove: () => void }) {
  return (
    <div className="relative">
      <MediaView m={m} small />
      <button
        type="button"
        onClick={onRemove}
        aria-label="remove"
        className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-paper text-xs"
      >
        ×
      </button>
    </div>
  )
}

function MediaView({ m, small }: { m: PostMediaItem; small?: boolean }) {
  const size = small ? 80 : 200
  if (m.kind === 'image') {
    return (
      <img
        src={m.url}
        alt={m.name}
        className="rounded-xl border border-line object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  if (m.kind === 'video') {
    return (
      <video
        src={m.url}
        controls
        className="rounded-xl border border-line"
        style={{ maxWidth: 320 }}
      />
    )
  }
  if (m.kind === 'audio') {
    return <audio src={m.url} controls className="max-w-full" />
  }
  return (
    <a
      href={m.url}
      target="_blank"
      rel="noopener noreferrer"
      className="row-press inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm font-bold"
    >
      <IconPaperclip size={16} /> {m.name}
    </a>
  )
}

function ActionBtn({
  icon,
  count,
  onClick,
  active,
}: {
  icon: React.ReactNode
  count: number
  onClick: () => void
  active?: boolean
}) {
  const [popping, setPopping] = useState(false)
  return (
    <button
      onClick={() => {
        setPopping(true)
        window.setTimeout(() => setPopping(false), 320)
        onClick()
      }}
      className={`flex items-center gap-1 text-xs font-bold transition-colors ${active ? 'text-ink' : 'text-muted'}`}
    >
      <span
        className={`${popping ? 'pop' : ''} flex h-7 w-7 items-center justify-center rounded-full transition-colors ${active ? 'bg-ink text-paper' : ''}`}
      >
        {icon}
      </span>
      {count}
    </button>
  )
}
