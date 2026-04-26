import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../store'
import { t } from '../i18n'
import { ScreenHeader } from '../components/ScreenHeader'
import { Avatar } from '../components/Avatar'
import { Modal, ConfirmDialog } from '../components/Modal'
import { QRCode } from '../components/QRCode'
import {
  IconBell,
  IconChevron,
  IconMoreH,
  IconPlus,
  IconTrash,
  IconUserPlus,
  IconQR,
  IconCheck,
  IconCopy,
} from '../components/Icons'
import { api, type ApiChatMember, type ApiInvite } from '../api'
import type { Chat, ChatRole, User } from '../types'

export function GroupInfoScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    state,
    userById,
    loadUser,
    muteChat,
    deleteChat,
    patchChat,
    searchUsers,
    refresh,
  } = useApp()

  const chat = useMemo(() => state.chats.find((c) => c.id === id) ?? null, [id, state.chats])

  const [members, setMembers] = useState<ApiChatMember[]>([])
  const [invites, setInvites] = useState<ApiInvite[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [memberSheetUser, setMemberSheetUser] = useState<{ user: User; member: ApiChatMember } | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [showInvites, setShowInvites] = useState(false)
  const [inviteToShare, setInviteToShare] = useState<ApiInvite | null>(null)
  const [showAddMember, setShowAddMember] = useState(false)

  const role = chat?.role ?? 'member'
  const isAdmin = role === 'owner' || role === 'admin'
  const isOwner = role === 'owner'

  const reloadMembers = useCallback(async () => {
    if (!id) return
    try {
      const list = await api.listChatMembers(id)
      setMembers(list)
      for (const m of list) if (!userById(m.userId)) void loadUser(m.userId)
    } catch {
      /* ignore */
    }
  }, [id, userById, loadUser])

  const reloadInvites = useCallback(async () => {
    if (!id || !isAdmin) return
    try {
      setInvites(await api.listInvites(id))
    } catch {
      /* ignore */
    }
  }, [id, isAdmin])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reloadMembers()
  }, [reloadMembers])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reloadInvites()
  }, [reloadInvites])

  if (!chat) {
    return (
      <div className="flex h-full flex-col bg-paper">
        <ScreenHeader title="Chat" />
        <div className="p-6 text-muted">Not found.</div>
      </div>
    )
  }

  const kindLabel =
    chat.kind === 'channel' ? t('profile.channel', state.lang) : t('profile.group', state.lang)

  const memberRows = members.map((m) => ({ user: userById(m.userId), member: m }))

  const onLeave = async () => {
    if (!chat) return
    try {
      await api.removeChatMember(chat.id, state.me!.id)
      await refresh()
      navigate('/chats', { replace: true })
    } catch {
      /* ignore */
    }
  }

  const onPromote = async (m: ApiChatMember, newRole: ChatRole) => {
    try {
      await api.patchChatMember(chat.id, m.userId, newRole)
      await reloadMembers()
    } catch {
      /* ignore */
    }
  }

  const onRemove = async (m: ApiChatMember) => {
    try {
      await api.removeChatMember(chat.id, m.userId)
      await reloadMembers()
    } catch {
      /* ignore */
    }
  }

  const createInvite = async () => {
    try {
      const inv = await api.createInvite(chat.id)
      setInvites((s) => [inv, ...s])
      setInviteToShare(inv)
    } catch {
      /* ignore */
    }
  }

  const revokeInvite = async (token: string) => {
    try {
      await api.revokeInvite(token)
      await reloadInvites()
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex min-h-0 flex-col overflow-y-auto bg-paper">
      <ScreenHeader
        title=""
        right={
          isAdmin ? (
            <button
              onClick={() => setEditOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink"
              aria-label={t('common.edit', state.lang)}
            >
              <IconMoreH size={18} />
            </button>
          ) : null
        }
      />

      <div className="flex flex-col items-center gap-2 px-6 py-6">
        <Avatar name={chat.title} size={112} filled />
        <div className="mt-3 text-center">
          <h1 className="italic-display text-2xl">{chat.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {members.length}{' '}
            {chat.kind === 'channel'
              ? t('profile.subscribers', state.lang)
              : t('profile.members', state.lang)}
            {chat.isPublic ? ` · ${t('group.public', state.lang)}` : ` · ${t('group.private', state.lang)}`}
          </p>
          <p className="text-xs uppercase tracking-widest text-muted">{kindLabel}</p>
          {chat.description && (
            <p className="mx-auto mt-3 max-w-sm whitespace-pre-wrap text-sm">{chat.description}</p>
          )}
        </div>
      </div>

      <div className="mx-4 grid grid-cols-3 gap-2">
        <ActionButton
          onClick={() => void muteChat(chat.id, !chat.muted)}
          icon={<IconBell size={20} muted={!!chat.muted} />}
          label={chat.muted ? t('profile.unmute', state.lang) : t('profile.mute', state.lang)}
        />
        <ActionButton
          onClick={() => setShowInvites(true)}
          icon={<IconQR size={18} />}
          label={t('invite.title', state.lang)}
        />
        <ActionButton
          onClick={() => setConfirmLeave(true)}
          icon={<IconTrash size={18} />}
          label={t('group.leave', state.lang)}
        />
      </div>

      {isAdmin && chat.kind !== 'channel' && (
        <div className="mx-4 mt-4">
          <button
            onClick={() => setShowAddMember(true)}
            className="row-press flex w-full items-center gap-3 rounded-2xl border-2 border-ink px-4 py-3 text-left font-bold"
          >
            <IconUserPlus size={18} />
            {t('group.addMember', state.lang)}
          </button>
        </div>
      )}

      <div className="mt-6 px-4">
        <h2 className="mb-2 text-xs font-black uppercase tracking-[0.2em]">
          {members.length}{' '}
          {chat.kind === 'channel'
            ? t('profile.subscribers', state.lang)
            : t('profile.members', state.lang)}
        </h2>
        <div className="flex flex-col gap-1">
          {memberRows.map(({ user, member }) =>
            user ? (
              <div
                key={member.userId}
                className="row-press flex items-center gap-3 rounded-2xl border border-line px-3 py-2"
              >
                <Link to={`/profile/${user.id}`} className="flex flex-1 items-center gap-3">
                  <Avatar name={user.name} size={40} filled={user.id !== state.me?.id} />
                  <div className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <div className="truncate font-bold">{user.name}</div>
                      {member.role !== 'member' && (
                        <span className="rounded-full border border-ink px-1.5 py-0.5 text-[10px] font-black uppercase">
                          {member.role}
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted">
                      {user.handle ? `@${user.handle}` : ''}
                    </div>
                  </div>
                </Link>
                {isAdmin && member.userId !== state.me?.id && (
                  <button
                    onClick={() => setMemberSheetUser({ user, member })}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-line"
                    aria-label="manage"
                  >
                    <IconMoreH size={14} />
                  </button>
                )}
              </div>
            ) : null,
          )}
        </div>
      </div>

      <div className="h-10" />

      {/* Edit title/desc/public sheet */}
      <EditSheet
        open={editOpen}
        chat={chat}
        onClose={() => setEditOpen(false)}
        onSubmit={async (patch) => {
          try {
            await patchChat(chat.id, patch)
            setEditOpen(false)
          } catch {
            /* ignore */
          }
        }}
      />

      {/* Member action sheet */}
      <Modal
        open={!!memberSheetUser}
        onClose={() => setMemberSheetUser(null)}
        title={memberSheetUser?.user.name}
      >
        {memberSheetUser && (
          <ul className="flex flex-col gap-1 text-base font-bold">
            {isOwner && memberSheetUser.member.role !== 'admin' && (
              <SheetRow
                label={t('group.makeAdmin', state.lang)}
                onClick={() => {
                  void onPromote(memberSheetUser.member, 'admin')
                  setMemberSheetUser(null)
                }}
              />
            )}
            {isOwner && memberSheetUser.member.role === 'admin' && (
              <SheetRow
                label={t('group.removeAdmin', state.lang)}
                onClick={() => {
                  void onPromote(memberSheetUser.member, 'member')
                  setMemberSheetUser(null)
                }}
              />
            )}
            {memberSheetUser.member.role !== 'owner' && (
              <SheetRow
                destructive
                label={t('group.removeMember', state.lang)}
                onClick={() => {
                  void onRemove(memberSheetUser.member)
                  setMemberSheetUser(null)
                }}
              />
            )}
          </ul>
        )}
      </Modal>

      {/* Confirm leave / delete */}
      <ConfirmDialog
        open={confirmLeave}
        title={t('group.leave', state.lang)}
        message={isOwner ? t('group.leaveOwner', state.lang) : t('group.leaveConfirm', state.lang)}
        okLabel={t('common.confirm', state.lang)}
        cancelLabel={t('common.cancel', state.lang)}
        destructive
        onResolve={(ok) => {
          setConfirmLeave(false)
          if (ok) void (isOwner ? deleteChat(chat.id).then(() => navigate('/chats')) : onLeave())
        }}
      />

      {/* Invite links sheet */}
      <Modal
        open={showInvites}
        onClose={() => setShowInvites(false)}
        title={t('invite.title', state.lang)}
      >
        <div className="flex flex-col gap-3">
          {!isAdmin ? (
            <p className="text-sm text-muted">{t('invite.adminOnly', state.lang)}</p>
          ) : (
            <>
              <button onClick={() => void createInvite()} className="bw-btn-primary">
                <IconPlus size={16} /> {t('invite.create', state.lang)}
              </button>
              <ul className="flex flex-col gap-2">
                {invites.length === 0 && (
                  <li className="text-center text-sm text-muted">
                    {t('invite.empty', state.lang)}
                  </li>
                )}
                {invites.map((inv) => (
                  <li
                    key={inv.token}
                    className={`flex items-center gap-2 rounded-2xl border border-line px-3 py-2 ${
                      inv.revoked ? 'opacity-60 line-through' : ''
                    }`}
                  >
                    <button
                      onClick={() => setInviteToShare(inv)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="truncate font-mono text-xs">{inviteUrl(inv)}</div>
                      <div className="text-[10px] text-muted">
                        {inv.uses}
                        {inv.maxUses ? `/${inv.maxUses}` : ''} · {inv.revoked ? 'revoked' : 'active'}
                      </div>
                    </button>
                    {!inv.revoked && (
                      <button
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-line"
                        onClick={() => void revokeInvite(inv.token)}
                        aria-label="revoke"
                      >
                        <IconTrash size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </Modal>

      {inviteToShare && (
        <Modal
          open
          onClose={() => setInviteToShare(null)}
          title={t('invite.share', state.lang)}
        >
          <ShareInviteBlock invite={inviteToShare} chat={chat} />
        </Modal>
      )}

      {showAddMember && (
        <AddMemberSheet
          open
          onClose={() => setShowAddMember(false)}
          chat={chat}
          searchUsers={searchUsers}
          onAdd={async (uid) => {
            try {
              const inv = await api.createInvite(chat.id, { maxUses: 1 })
              // Best effort: also actually add the user via a join-on-their-behalf
              // would need a separate endpoint; for now we just open share modal so
              // the admin can send the invite link. Users with an account join via the
              // invite link.
              setInviteToShare(inv)
              setShowAddMember(false)
              void uid
            } catch {
              /* ignore */
            }
          }}
        />
      )}
    </div>
  )
}

function inviteUrl(inv: ApiInvite): string {
  return `${window.location.origin}/invite/${inv.token}`
}

function ShareInviteBlock({ invite, chat }: { invite: ApiInvite; chat: Chat }) {
  const url = inviteUrl(invite)
  const [copied, setCopied] = useState(false)
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-center text-xs uppercase tracking-widest text-muted">{chat.title}</div>
      <QRCode text={url} size={220} />
      <div className="w-full select-all break-all rounded-xl border border-line px-3 py-2 text-center font-mono text-xs">
        {url}
      </div>
      <button onClick={onCopy} className="bw-btn-primary w-full">
        {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
        {copied ? 'Copied' : 'Copy link'}
      </button>
    </div>
  )
}

function EditSheet({
  open,
  chat,
  onClose,
  onSubmit,
}: {
  open: boolean
  chat: Chat
  onClose: () => void
  onSubmit: (patch: {
    title?: string
    description?: string
    isPublic?: boolean
    slowModeSeconds?: number
    subscribersOnly?: boolean
    signedPosts?: boolean
  }) => Promise<void>
}) {
  const { state } = useApp()
  const [title, setTitle] = useState(chat.title)
  const [description, setDescription] = useState(chat.description ?? '')
  const [isPublic, setIsPublic] = useState(!!chat.isPublic)
  const [slowSec, setSlowSec] = useState(chat.slowModeSeconds ?? 0)
  const [subOnly, setSubOnly] = useState(!!chat.subscribersOnly)
  const [signed, setSigned] = useState(!!chat.signedPosts)
  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      setTitle(chat.title)
      setDescription(chat.description ?? '')
      setIsPublic(!!chat.isPublic)
      setSlowSec(chat.slowModeSeconds ?? 0)
      setSubOnly(!!chat.subscribersOnly)
      setSigned(!!chat.signedPosts)
    })
  }, [open, chat])
  return (
    <Modal open={open} onClose={onClose} title={t('group.edit', state.lang)}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          void onSubmit({
            title,
            description,
            isPublic,
            slowModeSeconds: slowSec,
            subscribersOnly: subOnly,
            signedPosts: signed,
          })
        }}
      >
        <input
          className="bw-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('group.titlePlaceholder', state.lang)}
          maxLength={120}
        />
        <textarea
          className="bw-input min-h-[80px]"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('group.descriptionPlaceholder', state.lang)}
          maxLength={1000}
        />
        <label className="row-press flex items-center justify-between rounded-2xl border border-line px-3 py-2">
          <span className="text-sm font-bold">
            {t('group.public', state.lang)}
          </span>
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="h-5 w-5 accent-ink"
          />
        </label>
        {chat.kind === 'group' && (
          <label className="row-press flex items-center justify-between rounded-2xl border border-line px-3 py-2">
            <span className="text-sm font-bold">{t('channel.subscribersOnly', state.lang)}</span>
            <input
              type="checkbox"
              checked={subOnly}
              onChange={(e) => setSubOnly(e.target.checked)}
              className="h-5 w-5 accent-ink"
            />
          </label>
        )}
        {chat.kind === 'channel' && (
          <label className="row-press flex items-center justify-between rounded-2xl border border-line px-3 py-2">
            <span className="text-sm font-bold">{t('channel.signedPosts', state.lang)}</span>
            <input
              type="checkbox"
              checked={signed}
              onChange={(e) => setSigned(e.target.checked)}
              className="h-5 w-5 accent-ink"
            />
          </label>
        )}
        <label className="flex flex-col gap-1 rounded-2xl border border-line px-3 py-2">
          <span className="text-sm font-bold">{t('channel.slowMode', state.lang)}</span>
          <input
            type="number"
            min={0}
            max={3600}
            step={5}
            value={slowSec}
            onChange={(e) => setSlowSec(Math.max(0, Math.min(3600, Number(e.target.value) || 0)))}
            className="bw-input"
          />
        </label>
        <div className="flex gap-3">
          <button type="button" className="bw-btn-ghost flex-1" onClick={onClose}>
            {t('common.cancel', state.lang)}
          </button>
          <button type="submit" className="bw-btn-primary flex-1">
            {t('common.save', state.lang)}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function AddMemberSheet({
  open,
  onClose,
  chat,
  searchUsers,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  chat: Chat
  searchUsers: (q: string) => Promise<User[]>
  onAdd: (userId: string) => Promise<void> | void
}) {
  const { state } = useApp()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<User[]>([])
  useEffect(() => {
    let alive = true
    if (!q.trim()) {
      queueMicrotask(() => setResults([]))
      return
    }
    const id = setTimeout(async () => {
      try {
        const r = await searchUsers(q)
        if (alive) setResults(r.filter((u) => !chat.participants.includes(u.id)))
      } catch {
        /* ignore */
      }
    }, 250)
    return () => {
      alive = false
      clearTimeout(id)
    }
  }, [q, searchUsers, chat.participants])
  return (
    <Modal open={open} onClose={onClose} title={t('group.addMember', state.lang)}>
      <p className="mb-2 text-xs text-muted">{t('group.addMemberHint', state.lang)}</p>
      <input
        className="bw-input mb-3"
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('search.placeholder', state.lang)}
      />
      <ul className="flex max-h-[40vh] flex-col gap-1 overflow-y-auto">
        {results.map((u) => (
          <li key={u.id}>
            <button
              onClick={() => void onAdd(u.id)}
              className="row-press flex w-full items-center gap-3 rounded-2xl border border-line px-3 py-2 text-left"
            >
              <Avatar name={u.name} size={36} filled />
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{u.name}</div>
                <div className="truncate text-xs text-muted">@{u.handle}</div>
              </div>
              <IconChevron size={16} />
            </button>
          </li>
        ))}
      </ul>
      <button className="bw-btn-ghost mt-3 w-full" onClick={onClose}>
        {t('common.close', state.lang)}
      </button>
    </Modal>
  )
}

function SheetRow({
  label,
  onClick,
  destructive,
}: {
  label: string
  onClick?: () => void
  destructive?: boolean
}) {
  return (
    <li>
      <button
        onClick={onClick}
        className={`row-press w-full rounded-xl px-3 py-3 text-left ${
          destructive ? 'text-ink underline decoration-ink underline-offset-4' : ''
        }`}
      >
        {label}
      </button>
    </li>
  )
}

function ActionButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="ripple row-press flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-ink bg-paper px-2 py-3 text-ink"
    >
      {icon}
      <span className="text-[11px] font-bold uppercase tracking-wide">{label}</span>
    </button>
  )
}

