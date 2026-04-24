import { useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useApp } from '../store'
import { t } from '../i18n'
import { ScreenHeader } from '../components/ScreenHeader'
import { Avatar } from '../components/Avatar'
import { IconBell, IconChevron, IconMoreH } from '../components/Icons'

export function GroupInfoScreen() {
  const { id } = useParams<{ id: string }>()
  const { state, userById, setPrefs, loadUser } = useApp()

  const chat = useMemo(() => state.chats.find((c) => c.id === id) ?? null, [id, state.chats])

  useEffect(() => {
    if (!chat) return
    for (const pid of chat.participants) {
      if (!userById(pid)) void loadUser(pid)
    }
  }, [chat, userById, loadUser])

  if (!chat) {
    return (
      <div className="flex h-full flex-col bg-paper">
        <ScreenHeader title="Chat" />
        <div className="p-6 text-muted">Not found.</div>
      </div>
    )
  }

  const kindLabel =
    chat.kind === 'channel'
      ? t('profile.channel', state.lang)
      : chat.kind === 'group'
        ? t('profile.group', state.lang)
        : ''

  const members = chat.participants
    .map((pid) => userById(pid))
    .filter((u): u is NonNullable<typeof u> => !!u)

  return (
    <div className="flex min-h-0 flex-col bg-paper">
      <ScreenHeader
        title=""
        right={
          <button className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink">
            <IconMoreH size={18} />
          </button>
        }
      />

      <div className="flex flex-col items-center gap-2 px-6 py-6">
        <Avatar name={chat.title} size={112} filled />
        <div className="mt-3 text-center">
          <h1 className="italic-display text-2xl">{chat.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {members.length} {chat.kind === 'channel' ? t('profile.subscribers', state.lang) : t('profile.members', state.lang)}
          </p>
          {kindLabel && <p className="text-xs uppercase tracking-widest text-muted">{kindLabel}</p>}
        </div>
      </div>

      <div className="mx-4 grid grid-cols-3 gap-2">
        <ActionButton
          onClick={() => setPrefs({ muteAll: !state.prefs.muteAll })}
          icon={<IconBell size={20} muted={state.prefs.muteAll} />}
          label={state.prefs.muteAll ? t('profile.unmute', state.lang) : t('profile.mute', state.lang)}
        />
        <ActionButton label={t('profile.about', state.lang)} icon={<IconChevron size={18} />} />
        <ActionButton label={t('profile.more', state.lang)} icon={<IconMoreH size={18} />} />
      </div>

      <div className="mt-6 px-4">
        <h2 className="mb-2 text-xs font-black uppercase tracking-[0.2em]">
          {members.length} {chat.kind === 'channel' ? t('profile.subscribers', state.lang) : t('profile.members', state.lang)}
        </h2>
        <div className="flex flex-col gap-1">
          {members.map((m) => (
            <Link
              key={m.id}
              to={`/profile/${m.id}`}
              className="row-press flex items-center gap-3 rounded-2xl border border-line px-3 py-2"
            >
              <Avatar name={m.name} size={40} filled={m.id !== state.me?.id} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{m.name}</div>
                <div className="truncate text-xs text-muted">{m.handle || ''}</div>
              </div>
              <IconChevron size={16} />
            </Link>
          ))}
        </div>
      </div>

      <div className="h-10" />
    </div>
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
