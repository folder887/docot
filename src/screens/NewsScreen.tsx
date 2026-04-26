import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../store'
import { relTime, t } from '../i18n'
import { Avatar } from '../components/Avatar'
import { ConfirmDialog, Modal } from '../components/Modal'
import {
  IconArrowDown,
  IconArrowUp,
  IconComment,
  IconRepeat,
  IconImage,
  IconMic,
  IconPaperclip,
  IconUser,
  IconTrash,
  IconPlus,
} from '../components/Icons'
import { api } from '../api'
import type { NewsPost, PostMediaItem, Community } from '../types'
import type { SortBy } from '../api'

type Tab = 'feed' | 'mine' | 'reposts'

export function NewsScreen() {
  const { state, addPost, userById, deletePost, votePost, repost } = useApp()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('feed')
  const [text, setText] = useState('')
  const [title, setTitle] = useState('')
  const [media, setMedia] = useState<PostMediaItem[]>([])
  const [mine, setMine] = useState<NewsPost[]>([])
  const [reposts, setReposts] = useState<NewsPost[]>([])
  const [feed, setFeed] = useState<NewsPost[]>([])
  const [communities, setCommunities] = useState<Community[]>([])
  const [activeCommunity, setActiveCommunity] = useState<string>('')
  const [sort, setSort] = useState<SortBy>('hot')
  const [loading, setLoading] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [openPost, setOpenPost] = useState<NewsPost | null>(null)
  const [newCommunityOpen, setNewCommunityOpen] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const audioInput = useRef<HTMLInputElement>(null)
  const me = state.me

  const reloadCommunities = useCallback(async () => {
    try {
      const list = await api.listCommunities()
      setCommunities(
        list.map((c) => ({
          id: c.id,
          slug: c.slug,
          name: c.name,
          description: c.description,
          createdBy: c.createdBy,
          createdAt: c.createdAt,
          members: c.members,
          joined: c.joined,
          role: c.role,
        })),
      )
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reloadCommunities()
  }, [reloadCommunities])

  const reloadFeed = useCallback(async () => {
    setLoading(true)
    try {
      const list = await api.listPosts({
        community: activeCommunity || undefined,
        sort,
      })
      setFeed(list.map(mapApi))
    } finally {
      setLoading(false)
    }
  }, [activeCommunity, sort])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tab === 'feed') void reloadFeed()
  }, [tab, reloadFeed])

  const reloadOther = useCallback(async () => {
    if (tab === 'feed') return
    setLoading(true)
    try {
      const list = await (tab === 'mine' ? api.listMyPosts() : api.listMyReposts())
      const mapped = list.map(mapApi)
      if (tab === 'mine') setMine(mapped)
      else setReposts(mapped)
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reloadOther()
  }, [reloadOther])

  const onPickMedia = async (
    e: React.ChangeEvent<HTMLInputElement>,
    kind: PostMediaItem['kind'],
  ) => {
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
    const ti = title.trim()
    if (!t0 && media.length === 0 && !ti) return
    setText('')
    setTitle('')
    const m0 = media
    setMedia([])
    try {
      await addPost(t0, m0, {
        title: ti,
        communityId: activeCommunity || undefined,
      })
      void reloadFeed()
    } catch {
      /* ignore */
    }
  }

  const list = tab === 'feed' ? feed : tab === 'mine' ? mine : reposts

  const onVote = async (post: NewsPost, value: -1 | 0 | 1) => {
    try {
      const newValue = post.myVote === value ? 0 : value
      await votePost(post.id, newValue)
      // optimistic in our local lists
      const upd = (n: NewsPost): NewsPost => {
        if (n.id !== post.id) return n
        const oldVote = post.myVote ?? 0
        const oldUps = post.ups ?? 0
        const oldDowns = post.downs ?? 0
        const ups = oldUps + (newValue === 1 ? 1 : 0) - (oldVote === 1 ? 1 : 0)
        const downs = oldDowns + (newValue === -1 ? 1 : 0) - (oldVote === -1 ? 1 : 0)
        return { ...n, myVote: newValue, ups, downs, score: ups - downs, likes: ups }
      }
      setFeed((arr) => arr.map(upd))
      setMine((arr) => arr.map(upd))
      setReposts((arr) => arr.map(upd))
    } catch {
      /* ignore */
    }
  }

  const handleAddCommunity = async (slug: string, name: string, description: string) => {
    await api.createCommunity({ slug, name, description })
    await reloadCommunities()
    setActiveCommunity(slug)
  }

  const handleJoinCommunity = async (slug: string, joined: boolean) => {
    try {
      if (joined) await api.leaveCommunity(slug)
      else await api.joinCommunity(slug)
      await reloadCommunities()
    } catch {
      /* ignore */
    }
  }

  const composerCommunityName = useMemo(() => {
    if (!activeCommunity) return ''
    const c = communities.find((x) => x.slug === activeCommunity)
    return c ? c.name : activeCommunity
  }, [activeCommunity, communities])

  return (
    <div className="flex bg-paper text-ink">
      <CommunitySidebar
        communities={communities}
        active={activeCommunity}
        onPick={setActiveCommunity}
        onNew={() => setNewCommunityOpen(true)}
        onToggleJoin={handleJoinCommunity}
        lang={state.lang}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 border-b-2 border-ink px-4 py-2">
          <Tabs tab={tab} onChange={setTab} lang={state.lang} />
          <div className="flex items-center gap-1">
            {tab === 'feed' &&
              (['hot', 'new', 'top'] as SortBy[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${sort === s ? 'bg-ink text-paper' : 'text-muted'}`}
                >
                  {t(`news.sort.${s}`, state.lang)}
                </button>
              ))}
          </div>
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
            <div className="flex items-center gap-2 text-xs text-muted">
              <span>
                {activeCommunity
                  ? `c/${activeCommunity}${composerCommunityName ? ` · ${composerCommunityName}` : ''}`
                  : t('news.composer.scope.global', state.lang)}
              </span>
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={300}
              placeholder={t('news.composer.title', state.lang)}
              className="mt-2 w-full bg-transparent text-base font-bold focus:outline-none"
            />
            <div className="mt-2 flex gap-3">
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
                  const k: PostMediaItem['kind'] =
                    f && f.type.startsWith('video') ? 'video' : 'image'
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
              <span className="flex-1" />
              <button
                type="submit"
                disabled={!text.trim() && media.length === 0 && !title.trim()}
                className="bw-btn-primary px-5 py-2 text-sm disabled:opacity-40"
              >
                {t('news.post', state.lang)}
              </button>
            </div>
          </form>
        )}

        {loading && (
          <p className="p-6 text-center text-sm text-muted">
            {t('common.loading', state.lang)}
          </p>
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
          {list.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              author={userById(p.authorId)}
              community={communities.find((c) => c.id === p.communityId)}
              meId={me?.id ?? ''}
              onVote={onVote}
              onRepost={() => void repost(p.id)}
              onOpen={() => setOpenPost(p)}
              onProfile={(uid) => navigate(`/profile/${uid}`)}
              onDelete={() => setDeleteId(p.id)}
              lang={state.lang}
            />
          ))}
        </ul>
      </div>

      {openPost && (
        <PostDetailModal
          post={openPost}
          onClose={() => setOpenPost(null)}
          lang={state.lang}
        />
      )}

      {newCommunityOpen && (
        <NewCommunityModal
          onClose={() => setNewCommunityOpen(false)}
          onSubmit={async (slug, name, desc) => {
            await handleAddCommunity(slug, name, desc)
            setNewCommunityOpen(false)
          }}
          lang={state.lang}
        />
      )}

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
              setFeed((arr) => arr.filter((p) => p.id !== id))
            })
          }
        }}
      />
    </div>
  )
}

function mapApi(p: import('../api').ApiPost): NewsPost {
  return {
    id: p.id,
    authorId: p.authorId,
    text: p.text,
    at: p.at,
    likes: p.likes,
    reposts: p.reposts,
    replies: p.replies,
    liked: p.liked,
    reposted: p.reposted,
    media: p.media ?? [],
    communityId: p.communityId ?? '',
    title: p.title ?? '',
    score: p.score ?? 0,
    ups: p.ups ?? 0,
    downs: p.downs ?? 0,
    myVote: p.myVote ?? 0,
  }
}

function CommunitySidebar({
  communities,
  active,
  onPick,
  onNew,
  onToggleJoin,
  lang,
}: {
  communities: Community[]
  active: string
  onPick: (slug: string) => void
  onNew: () => void
  onToggleJoin: (slug: string, joined: boolean) => void
  lang: 'en' | 'ru'
}) {
  return (
    <aside className="hidden w-56 shrink-0 border-r-2 border-ink bg-paper py-3 lg:block">
      <div className="px-3 pb-2">
        <button
          onClick={onNew}
          className="row-press flex w-full items-center gap-2 rounded-full border-2 border-ink px-3 py-1.5 text-xs font-bold"
        >
          <IconPlus size={14} /> {t('news.community.new', lang)}
        </button>
      </div>
      <ul>
        <li>
          <button
            onClick={() => onPick('')}
            className={`row-press w-full px-4 py-2 text-left text-sm font-bold ${active === '' ? 'bg-ink text-paper' : ''}`}
          >
            {t('news.community.all', lang)}
          </button>
        </li>
        {communities.map((c) => (
          <li key={c.id} className="flex items-center gap-1">
            <button
              onClick={() => onPick(c.slug)}
              className={`row-press flex-1 truncate px-4 py-2 text-left text-sm font-bold ${active === c.slug ? 'bg-ink text-paper' : ''}`}
            >
              c/{c.slug}
              <span className="ml-1 text-[10px] opacity-60">· {c.members}</span>
            </button>
            <button
              onClick={() => onToggleJoin(c.slug, c.joined)}
              className="mr-2 rounded-full border border-line px-2 py-0.5 text-[10px] font-bold"
              title={c.joined ? t('news.community.leave', lang) : t('news.community.join', lang)}
            >
              {c.joined ? '−' : '+'}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}

function PostCard({
  post,
  author,
  community,
  meId,
  onVote,
  onRepost,
  onOpen,
  onProfile,
  onDelete,
  lang,
}: {
  post: NewsPost
  author: ReturnType<ReturnType<typeof useApp>['userById']>
  community: Community | undefined
  meId: string
  onVote: (p: NewsPost, v: -1 | 0 | 1) => void
  onRepost: () => void
  onOpen: () => void
  onProfile: (uid: string) => void
  onDelete: () => void
  lang: 'en' | 'ru'
}) {
  const displayName = author?.name ?? post.authorId
  const displayHandle = author?.handle ? `@${author.handle}` : ''
  const isMine = post.authorId === meId
  const score = post.score ?? 0
  const myVote = post.myVote ?? 0
  return (
    <li className="border-b border-line p-4 fade-in">
      <div className="flex gap-3">
        <div className="flex flex-col items-center gap-0.5">
          <button
            onClick={() => onVote(post, 1)}
            className={`row-press flex h-7 w-7 items-center justify-center rounded ${myVote === 1 ? 'bg-ink text-paper' : 'text-muted hover:text-ink'}`}
            aria-label={t('news.vote.up', lang)}
          >
            <IconArrowUp size={18} filled={myVote === 1} />
          </button>
          <span
            className={`text-xs font-black ${myVote === 1 ? 'text-ink' : myVote === -1 ? 'text-red-600' : 'text-muted'}`}
          >
            {score}
          </span>
          <button
            onClick={() => onVote(post, -1)}
            className={`row-press flex h-7 w-7 items-center justify-center rounded ${myVote === -1 ? 'bg-red-600 text-paper' : 'text-muted hover:text-red-600'}`}
            aria-label={t('news.vote.down', lang)}
          >
            <IconArrowDown size={18} filled={myVote === -1} />
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2 text-xs">
            {community && (
              <span className="font-black">c/{community.slug}</span>
            )}
            <button
              onClick={() => onProfile(post.authorId)}
              className="opacity-70 hover:underline"
            >
              {displayName}
            </button>
            {displayHandle && (
              <button
                onClick={() => onProfile(post.authorId)}
                className="opacity-50 hover:underline"
              >
                {displayHandle}
              </button>
            )}
            <span className="opacity-50">· {relTime(post.at, lang)}</span>
            {isMine && (
              <button
                onClick={onDelete}
                className="ml-auto opacity-60 hover:opacity-100"
                aria-label="delete"
              >
                <IconTrash size={14} />
              </button>
            )}
          </div>
          <button
            onClick={onOpen}
            className="block w-full text-left"
          >
            {post.title && (
              <h3 className="mt-1 break-words text-base font-black leading-snug">
                {post.title}
              </h3>
            )}
            {post.text && (
              <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                {post.text}
              </p>
            )}
          </button>
          {post.media && post.media.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {post.media.map((m, i) => (
                <MediaView key={i} m={m} />
              ))}
            </div>
          )}
          <div className="mt-3 flex items-center gap-4 text-muted">
            <button
              onClick={onOpen}
              className="row-press flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold hover:text-ink"
            >
              <IconComment size={16} /> {post.replies}
            </button>
            <button
              onClick={onRepost}
              className={`row-press flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${post.reposted ? 'text-ink' : 'hover:text-ink'}`}
            >
              <IconRepeat size={16} /> {post.reposts}
            </button>
          </div>
        </div>
      </div>
    </li>
  )
}

function PostDetailModal({
  post,
  onClose,
  lang,
}: {
  post: NewsPost
  onClose: () => void
  lang: 'en' | 'ru'
}) {
  const { state, userById } = useApp()
  const [comments, setComments] = useState<import('../types').PostComment[]>([])
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const me = state.me

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const list = await api.listPostComments(post.id)
      setComments(list as import('../types').PostComment[])
    } finally {
      setLoading(false)
    }
  }, [post.id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [reload])

  const submit = async () => {
    const txt = text.trim()
    if (!txt) return
    setText('')
    const parent = replyTo
    setReplyTo('')
    try {
      const c = await api.createPostComment(post.id, {
        text: txt,
        parentId: parent || undefined,
      })
      setComments((arr) => [...arr, c as import('../types').PostComment])
    } catch {
      /* ignore */
    }
  }

  const onVoteComment = async (cid: string, v: -1 | 0 | 1) => {
    const c = comments.find((x) => x.id === cid)
    if (!c) return
    const newValue = c.myVote === v ? 0 : v
    try {
      const upd = await api.votePostComment(post.id, cid, newValue)
      setComments((arr) =>
        arr.map((x) => (x.id === cid ? (upd as import('../types').PostComment) : x)),
      )
    } catch {
      /* ignore */
    }
  }

  const onDeleteComment = async (cid: string) => {
    try {
      await api.deletePostComment(post.id, cid)
      setComments((arr) =>
        arr.map((x) => (x.id === cid ? { ...x, deleted: true, text: '' } : x)),
      )
    } catch {
      /* ignore */
    }
  }

  // Build tree
  const byParent = useMemo(() => {
    const m = new Map<string, import('../types').PostComment[]>()
    for (const c of comments) {
      const arr = m.get(c.parentId) ?? []
      arr.push(c)
      m.set(c.parentId, arr)
    }
    return m
  }, [comments])

  return (
    <Modal open onClose={onClose} title={post.title || t('news.post.detail', lang)}>
      <div className="max-h-[70vh] overflow-y-auto">
        {post.text && (
          <p className="mb-3 whitespace-pre-wrap break-words text-sm">{post.text}</p>
        )}
        {post.media && post.media.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {post.media.map((m, i) => (
              <MediaView key={i} m={m} />
            ))}
          </div>
        )}
        <div className="mb-2 text-xs font-black uppercase text-muted">
          {t('news.comments', lang)}
        </div>
        {loading ? (
          <p className="text-sm text-muted">{t('common.loading', lang)}</p>
        ) : (
          <CommentList
            byParent={byParent}
            parentId=""
            depth={0}
            meId={me?.id ?? ''}
            userById={userById}
            onVote={onVoteComment}
            onDelete={onDeleteComment}
            onReply={(id) => setReplyTo(id)}
            replyTo={replyTo}
            lang={lang}
          />
        )}
      </div>
      <div className="mt-3 border-t border-line pt-3">
        {replyTo && (
          <div className="mb-1 text-xs text-muted">
            {t('news.replyingTo', lang)} · {' '}
            <button onClick={() => setReplyTo('')} className="underline">
              {t('common.cancel', lang)}
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('news.comment.placeholder', lang)}
            className="bw-input flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void submit()
              }
            }}
          />
          <button
            onClick={() => void submit()}
            disabled={!text.trim()}
            className="bw-btn-primary px-4 py-2 text-sm disabled:opacity-40"
          >
            {t('news.comment.send', lang)}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function CommentList({
  byParent,
  parentId,
  depth,
  meId,
  userById,
  onVote,
  onDelete,
  onReply,
  replyTo,
  lang,
}: {
  byParent: Map<string, import('../types').PostComment[]>
  parentId: string
  depth: number
  meId: string
  userById: ReturnType<typeof useApp>['userById']
  onVote: (id: string, v: -1 | 0 | 1) => void
  onDelete: (id: string) => void
  onReply: (id: string) => void
  replyTo: string
  lang: 'en' | 'ru'
}) {
  const list = byParent.get(parentId) ?? []
  if (list.length === 0) return null
  return (
    <ul style={{ paddingLeft: depth === 0 ? 0 : 12 }} className={depth > 0 ? 'border-l border-line pl-2' : ''}>
      {list.map((c) => {
        const a = userById(c.authorId)
        const isMine = c.authorId === meId
        return (
          <li key={c.id} className="py-1">
            <div className="flex items-baseline gap-2 text-xs">
              <span className="font-black">{a?.name ?? c.authorId}</span>
              <span className="opacity-50">· {relTime(c.at, lang)}</span>
              <span
                className={`ml-1 ${c.myVote === 1 ? 'text-ink' : c.myVote === -1 ? 'text-red-600' : 'text-muted'}`}
              >
                {c.score}
              </span>
            </div>
            <p
              className={`mt-0.5 whitespace-pre-wrap break-words text-sm ${c.deleted ? 'italic opacity-60' : ''}`}
            >
              {c.deleted ? t('news.comment.deleted', lang) : c.text}
            </p>
            {!c.deleted && (
              <div className="mt-1 flex items-center gap-2 text-[10px] text-muted">
                <button
                  onClick={() => onVote(c.id, 1)}
                  className={`row-press rounded px-1 ${c.myVote === 1 ? 'bg-ink text-paper' : 'hover:text-ink'}`}
                  aria-label={t('news.vote.up', lang)}
                >
                  ▲
                </button>
                <button
                  onClick={() => onVote(c.id, -1)}
                  className={`row-press rounded px-1 ${c.myVote === -1 ? 'bg-red-600 text-paper' : 'hover:text-red-600'}`}
                  aria-label={t('news.vote.down', lang)}
                >
                  ▼
                </button>
                <button
                  onClick={() => onReply(c.id)}
                  className={`row-press rounded px-1 ${replyTo === c.id ? 'bg-ink text-paper' : 'hover:text-ink'}`}
                >
                  {t('news.comment.reply', lang)}
                </button>
                {isMine && (
                  <button
                    onClick={() => onDelete(c.id)}
                    className="row-press rounded px-1 hover:text-red-600"
                  >
                    {t('common.delete', lang)}
                  </button>
                )}
              </div>
            )}
            <CommentList
              byParent={byParent}
              parentId={c.id}
              depth={depth + 1}
              meId={meId}
              userById={userById}
              onVote={onVote}
              onDelete={onDelete}
              onReply={onReply}
              replyTo={replyTo}
              lang={lang}
            />
          </li>
        )
      })}
    </ul>
  )
}

function NewCommunityModal({
  onClose,
  onSubmit,
  lang,
}: {
  onClose: () => void
  onSubmit: (slug: string, name: string, desc: string) => Promise<void>
  lang: 'en' | 'ru'
}) {
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  return (
    <Modal open onClose={onClose} title={t('news.community.new', lang)}>
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setErr(null)
          try {
            await onSubmit(slug.trim(), name.trim(), desc.trim())
          } catch (e) {
            setErr(e instanceof Error ? e.message : 'Failed')
          } finally {
            setBusy(false)
          }
        }}
      >
        <input
          className="bw-input"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
          placeholder="slug (a-z 0-9 - _)"
          required
          minLength={2}
          maxLength={40}
        />
        <input
          className="bw-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('news.community.name', lang)}
          required
          maxLength={80}
        />
        <textarea
          className="bw-input min-h-[60px]"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder={t('news.community.description', lang)}
          maxLength={2000}
        />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex gap-3">
          <button type="button" className="bw-btn-ghost flex-1" onClick={onClose}>
            {t('common.cancel', lang)}
          </button>
          <button type="submit" className="bw-btn-primary flex-1" disabled={busy}>
            {busy ? '…' : t('common.save', lang)}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function Tabs({ tab, onChange, lang }: { tab: Tab; onChange: (t: Tab) => void; lang: 'en' | 'ru' }) {
  return (
    <div className="flex gap-1">
      {(['feed', 'mine', 'reposts'] as Tab[]).map((k) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${tab === k ? 'bg-ink text-paper' : 'text-muted'}`}
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
