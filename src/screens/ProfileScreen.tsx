import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../store'
import { relTime, t } from '../i18n'
import { ScreenHeader } from '../components/ScreenHeader'
import { Avatar } from '../components/Avatar'
import { Modal, ConfirmDialog } from '../components/Modal'
import { QRCode } from '../components/QRCode'
import { api } from '../api'
import type { User } from '../types'
import {
  IconBell,
  IconChat,
  IconChevron,
  IconMoreH,
  IconPhone,
  IconQR,
} from '../components/Icons'

export function ProfileScreen() {
  const { id } = useParams<{ id: string }>()
  const { state, userById, loadUser, createChat, muteChat } = useApp()
  const navigate = useNavigate()

  const me = state.me
  const isMe = id === 'me' || (me && id === me.id)
  const [user, setUser] = useState<User | null>(() => (id ? userById(id) : null))
  const [acting, setActing] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [showCall, setShowCall] = useState(false)
  const [confirmBlock, setConfirmBlock] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!id) return
    const cached = userById(id)
    if (cached) {
      const h = window.setTimeout(() => setUser(cached), 0)
      return () => window.clearTimeout(h)
    }
    void loadUser(id).then(setUser)
  }, [id, userById, loadUser])

  const sharedChats = useMemo(() => {
    if (!user || isMe) return []
    return state.chats.filter((c) => c.participants.includes(user.id) && c.kind !== 'dm')
  }, [user, isMe, state.chats])

  const dm = useMemo(() => {
    if (!user || isMe) return null
    return state.chats.find((c) => c.kind === 'dm' && c.participants.includes(user.id)) ?? null
  }, [user, isMe, state.chats])

  if (!user) {
    return (
      <div className="flex h-full flex-col bg-paper">
        <ScreenHeader title="Profile" />
        <div className="p-6 text-muted">{t('common.loading', state.lang)}</div>
      </div>
    )
  }

  const kind = user.kind ?? 'user'
  const subtitle = isMe
    ? t('settings.myAccount', state.lang)
    : kind === 'bot'
      ? t('profile.bot', state.lang)
      : kind === 'channel'
        ? t('profile.channel', state.lang)
        : kind === 'group'
          ? t('profile.group', state.lang)
          : user.lastSeen
            ? `${t('profile.lastSeen', state.lang)} ${relTime(user.lastSeen, state.lang)}`
            : t('profile.online', state.lang)

  const openDm = async () => {
    if (dm) {
      navigate(`/chats/${dm.id}`)
      return
    }
    const newId = await createChat([user.id], 'dm')
    navigate(`/chats/${newId}`)
  }

  const toggleContact = async () => {
    if (acting) return
    setActing(true)
    try {
      const next = user.isContact
        ? await api.removeContact(user.id)
        : await api.addContact(user.id)
      setUser({ ...user, isContact: next.isContact, blocked: next.blocked })
    } finally {
      setActing(false)
    }
  }

  const toggleBlock = async () => {
    if (acting) return
    setActing(true)
    try {
      const next = user.blocked ? await api.unblock(user.id) : await api.block(user.id)
      setUser({ ...user, isContact: next.isContact, blocked: next.blocked })
    } finally {
      setActing(false)
    }
  }

  const copyHandle = async () => {
    if (!user.handle) return
    try {
      await navigator.clipboard.writeText(`@${user.handle}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex min-h-0 flex-col bg-paper">
      <ScreenHeader
        title={isMe ? t('settings.myAccount', state.lang) : ''}
        right={
          <button
            aria-label={t('profile.more', state.lang)}
            className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink"
            onClick={() => setShowMore(true)}
          >
            <IconMoreH size={18} />
          </button>
        }
      />

      <div className="flex flex-col items-center gap-2 px-6 py-6">
        <Avatar name={user.name} size={112} filled={!isMe} src={user.avatarUrl} />
        <div className="mt-3 text-center">
          <h1 className="italic-display text-2xl">{user.name}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
      </div>

      {!isMe && (
        <div className="mx-4 grid grid-cols-3 gap-2">
          <ActionButton onClick={openDm} icon={<IconChat size={20} stroke={2} />} label={t('profile.message', state.lang)} />
          <ActionButton
            disabled={!dm}
            onClick={() => {
              if (!dm) return
              void muteChat(dm.id, !dm.muted)
            }}
            icon={<IconBell size={20} muted={!!dm?.muted} />}
            label={dm?.muted ? t('profile.unmute', state.lang) : t('profile.mute', state.lang)}
          />
          <ActionButton
            onClick={() => setShowCall(true)}
            icon={<IconPhone size={20} />}
            label={t('profile.call', state.lang)}
          />
        </div>
      )}

      <div className="mt-6 px-4">
        {user.handle && (
          <button onClick={() => setShowQR(true)} className="row-press w-full text-left">
            <InfoRow
              label={t('profile.username', state.lang)}
              value={`@${user.handle}`}
              right={<IconQR size={18} />}
            />
          </button>
        )}
        {user.phone && (
          <InfoRow label={t('profile.phone', state.lang)} value={user.phone} />
        )}
        {user.bio && <InfoRow label={t('profile.bio', state.lang)} value={user.bio} multiline />}
      </div>

      {sharedChats.length > 0 && (
        <div className="mt-6 px-4">
          <h2 className="mb-2 text-xs font-black uppercase tracking-[0.2em]">
            {sharedChats.length} {t('profile.sharedGroups', state.lang)}
          </h2>
          <div className="flex flex-col gap-2">
            {sharedChats.map((c) => (
              <Link
                key={c.id}
                to={`/chats/${c.id}`}
                className="row-press flex items-center gap-3 rounded-2xl border border-line px-3 py-2"
              >
                <Avatar name={c.title} size={40} filled />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{c.title}</div>
                  <div className="truncate text-xs text-muted">{c.kind}</div>
                </div>
                <IconChevron size={16} />
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="h-10" />

      {/* More actions sheet */}
      <Modal open={showMore} onClose={() => setShowMore(false)} title={user.name}>
        <ul className="flex flex-col gap-1 text-base font-bold">
          {user.handle && (
            <SheetRow
              label={`${t('common.copy', state.lang)} @${user.handle}`}
              onClick={() => {
                void copyHandle()
                setShowMore(false)
              }}
            />
          )}
          <SheetRow
            label={t('profile.qr', state.lang)}
            onClick={() => {
              setShowMore(false)
              setShowQR(true)
            }}
          />
          {!isMe && kind === 'user' && (
            <SheetRow
              label={user.isContact ? t('profile.removeContact', state.lang) : t('profile.addContact', state.lang)}
              onClick={() => {
                setShowMore(false)
                void toggleContact()
              }}
            />
          )}
          {!isMe && (
            <SheetRow
              destructive
              label={user.blocked ? t('profile.unblock', state.lang) : t('profile.block', state.lang)}
              onClick={() => {
                setShowMore(false)
                if (user.blocked) void toggleBlock()
                else setConfirmBlock(true)
              }}
            />
          )}
        </ul>
        <button
          className="mt-3 w-full rounded-full border-2 border-ink py-2 text-sm font-bold"
          onClick={() => setShowMore(false)}
        >
          {t('common.close', state.lang)}
        </button>
        {copied && (
          <div className="mt-3 text-center text-xs uppercase tracking-wider text-muted">
            {t('common.copied', state.lang)}
          </div>
        )}
      </Modal>

      {/* QR modal */}
      <Modal open={showQR} onClose={() => setShowQR(false)} title={`@${user.handle ?? user.id}`}>
        <div className="flex flex-col items-center gap-3">
          <QRCode text={`${window.location.origin}/u/${user.handle ?? user.id}`} size={220} />
          <p className="text-center text-xs text-muted">
            {state.lang === 'ru' ? 'Поделись ником через QR' : 'Share this user via QR'}
          </p>
          <button
            className="bw-btn-primary mt-2 w-full"
            onClick={() => setShowQR(false)}
          >
            {t('common.close', state.lang)}
          </button>
        </div>
      </Modal>

      {/* Call screen */}
      <CallScreen
        open={showCall}
        onClose={() => setShowCall(false)}
        user={user}
        lang={state.lang}
      />

      <ConfirmDialog
        open={confirmBlock}
        title={user.name}
        message={
          state.lang === 'ru'
            ? `Заблокировать ${user.name}? Вы перестанете получать от него сообщения.`
            : `Block ${user.name}? You will stop receiving messages.`
        }
        okLabel={t('profile.block', state.lang)}
        cancelLabel={t('common.cancel', state.lang)}
        destructive
        onResolve={(ok) => {
          setConfirmBlock(false)
          if (ok) void toggleBlock()
        }}
      />
    </div>
  )
}

function SheetRow({
  label,
  onClick,
  destructive,
}: {
  label: string
  onClick: () => void
  destructive?: boolean
}) {
  return (
    <li>
      <button
        className={`row-press flex w-full items-center justify-between rounded-2xl border-2 border-ink px-4 py-3 text-left ${
          destructive ? 'bg-paper text-ink' : 'bg-paper text-ink'
        }`}
        onClick={onClick}
      >
        <span>{label}</span>
        <IconChevron size={16} />
      </button>
    </li>
  )
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode
  label: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="ripple row-press flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-ink bg-paper px-2 py-3 text-ink disabled:opacity-50"
    >
      {icon}
      <span className="text-[11px] font-bold uppercase tracking-wide">{label}</span>
    </button>
  )
}

function InfoRow({
  label,
  value,
  right,
  multiline,
}: {
  label: string
  value: string
  right?: React.ReactNode
  multiline?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line py-3">
      <div className="min-w-0 flex-1">
        <div className={`${multiline ? 'whitespace-pre-wrap' : 'truncate'} font-bold`}>{value}</div>
        <div className="text-xs text-muted">{label}</div>
      </div>
      {right && <div className="pt-1 text-muted">{right}</div>}
    </div>
  )
}



/* ---------------- Call screen (in-app overlay, replaces window.alert) ---------------- */
function CallScreen({
  open,
  onClose,
  user,
  lang,
}: {
  open: boolean
  onClose: () => void
  user: User
  lang: 'en' | 'ru'
}) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (!open) return
    const reset = window.setTimeout(() => setSeconds(0), 0)
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => {
      window.clearTimeout(reset)
      window.clearInterval(id)
    }
  }, [open])
  if (!open) return null
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-between bg-ink py-12 text-paper"
      style={{ paddingBottom: 'max(3rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex flex-col items-center gap-2 pt-8">
        <div className="text-xs uppercase tracking-[0.3em] opacity-70">{t('call.title', lang)}</div>
        <Avatar name={user.name} size={140} filled={false} src={user.avatarUrl} />
        <div className="italic-display mt-4 text-3xl">{user.name}</div>
        <div className="font-mono text-lg opacity-80">{mm}:{ss}</div>
        <div className="mt-2 max-w-[260px] text-center text-xs opacity-60">
          {t('call.unavailable', lang)}
        </div>
      </div>
      <button
        onClick={onClose}
        aria-label={t('call.tapToEnd', lang)}
        className="flex h-20 w-20 items-center justify-center rounded-full"
        style={{ background: 'var(--paper)', color: 'var(--ink)' }}
      >
        <IconPhone size={32} />
      </button>
    </div>
  )
}
