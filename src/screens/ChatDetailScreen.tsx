import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../store'
import { relTime, t } from '../i18n'
import { ScreenHeader } from '../components/ScreenHeader'
import { Avatar } from '../components/Avatar'
import { ChatComposer } from '../components/ChatComposer'
import { MessageContent } from '../components/MessageBubble'
import { Modal, ConfirmDialog } from '../components/Modal'
import { IconLock } from '../components/Icons'
import { api, getToken, openChatWebSocket } from '../api'
import type { Message } from '../types'
import { recallOutgoing } from '../crypto/outgoing'

// Same six picks exposed by Telegram, Slack and Apple Messages: covers the
// 80% case so most users never need to open a full picker.
const QUICK_REACTIONS = ['❤️', '👍', '😂', '🔥', '😮', '😢'] as const

export function ChatDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const {
    state,
    sendMessage,
    peerOf,
    userById,
    loadUser,
    addIncomingMessage,
    editMessage,
    deleteMessage,
    applyMessageEdit,
    applyMessageDelete,
    toggleReaction,
    applyReactionEvent,
  } = useApp()
  const navigate = useNavigate()
  const chat = useMemo(() => state.chats.find((c) => c.id === id), [id, state.chats])
  const peer = chat ? peerOf(chat) : null
  const endRef = useRef<HTMLDivElement>(null)
  const myId = state.me?.id

  const [actionFor, setActionFor] = useState<Message | null>(null)
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const [replyTo, setReplyTo] = useState<{ id: string; preview: string; author?: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Message | null>(null)
  const [forwardOpen, setForwardOpen] = useState<Message | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat?.messages.length])

  useEffect(() => {
    if (!chat) return
    for (const pid of chat.participants) {
      if (!state.users[pid] && pid !== state.me?.id) void loadUser(pid)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?.id])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    void (async () => {
      try {
        const full = await api.getChat(id)
        // Serialize: Signal Double Ratchet decryption mutates session state,
        // so concurrent decrypts of messages from the same peer would race.
        for (const m of full.messages) {
          if (cancelled) return
          await addIncomingMessage(id, m)
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (!chat) return
    const tok = getToken()
    if (!tok) return
    const ws = openChatWebSocket(chat.id, tok)
    // Serialize WS-driven decryption to avoid concurrent ratchet mutations.
    let queue: Promise<void> = Promise.resolve()
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as {
          type: string
          message?: Message
          messageId?: string
          deletedAt?: number
          userId?: string
          emoji?: string
          added?: boolean
          pollId?: string
        }
        if (data.type === 'message' && data.message) {
          const incoming = data.message
          // Skip the WebSocket echo of our own send: either the server
          // confirmed authorship (regular message) or we have the plaintext
          // cached locally (sealed message — the server stripped authorId).
          // Without this, the sealed echo bypasses the dedupe path and races
          // sendMessage's setState commit, overwriting our message with an
          // empty body when the ratchet refuses to decrypt our own send.
          queue = queue.then(async () => {
            if (incoming.authorId === myId) return
            if (incoming.sealed && (await recallOutgoing(incoming.id)) !== undefined) return
            await addIncomingMessage(chat.id, incoming)
          })
        } else if (data.type === 'message_edited' && data.message) {
          const edited = data.message
          queue = queue.then(() => applyMessageEdit(chat.id, edited))
        } else if (data.type === 'message_deleted' && data.messageId) {
          applyMessageDelete(chat.id, data.messageId, data.deletedAt ?? Date.now())
        } else if (data.type === 'poll_updated' && data.pollId) {
          window.dispatchEvent(
            new CustomEvent('docot:poll_updated', { detail: { pollId: data.pollId } }),
          )
        } else if (
          data.type === 'reactions_updated' &&
          data.messageId &&
          data.userId &&
          data.emoji
        ) {
          applyReactionEvent(
            chat.id,
            data.messageId,
            data.userId,
            data.emoji,
            !!data.added,
          )
        }
      } catch {
        /* ignore */
      }
    }
    return () => {
      try {
        ws.close()
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?.id])

  if (!chat) {
    return (
      <div className="flex h-full flex-col">
        <ScreenHeader title="Chat" />
        <div className="p-6 text-muted">Chat not found.</div>
      </div>
    )
  }

  const subtitle =
    chat.kind === 'dm'
      ? peer?.kind === 'bot'
        ? t('profile.bot', state.lang)
        : peer?.lastSeen
          ? `${t('profile.lastSeen', state.lang)} ${relTime(peer.lastSeen, state.lang)}`
          : t('profile.online', state.lang)
      : chat.kind === 'channel'
        ? `${chat.participants.length} ${t('profile.subscribers', state.lang)}`
        : `${chat.participants.length} ${t('profile.members', state.lang)}`

  const openInfo = () => {
    if (chat.kind === 'dm' && peer) {
      navigate(`/profile/${peer.id}`)
    } else {
      navigate(`/group/${chat.id}`)
    }
  }

  const messageById = (mid: string) => chat.messages.find((m) => m.id === mid) ?? null

  const onSend = (text0: string) => {
    void sendMessage(chat.id, text0, replyTo?.id ?? null)
    setReplyTo(null)
  }

  const onSubmitEdit = (mid: string, text0: string) => {
    void editMessage(chat.id, mid, text0)
    setEditing(null)
  }

  const onCopy = async (m: Message) => {
    try {
      await navigator.clipboard.writeText(m.text || '')
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-paper">
      <ScreenHeader
        title={
          <button
            onClick={openInfo}
            className="row-press flex items-center justify-center gap-2 rounded-full px-2 py-1"
          >
            <Avatar name={chat.title} size={32} filled={chat.kind !== 'dm' || peer?.kind !== 'user'} />
            <div className="min-w-0 text-left">
              <div className="truncate text-[15px] font-black leading-tight">{chat.title}</div>
              <div className="flex items-center gap-1 truncate text-[11px] font-normal text-muted">
                {chat.kind === 'dm' && <IconLock size={11} />}
                <span className="truncate">{subtitle}</span>
              </div>
            </div>
          </button>
        }
      />
      <div className="chat-wallpaper flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-4">
        <div className="wallpaper" />
        {chat.messages.map((m, i) => {
          const mine = m.authorId === myId
          const author = userById(m.authorId)
          const showAvatar =
            !mine && chat.kind !== 'dm' && (i === 0 || chat.messages[i - 1].authorId !== m.authorId)
          const replyMsg = m.replyToId ? messageById(m.replyToId) : null
          const replyAuthor = replyMsg ? userById(replyMsg.authorId) : null
          const isDeleted = !!m.deletedAt
          return (
            <div
              key={m.id}
              className={`relative z-10 flex items-end gap-2 bubble-in ${mine ? 'justify-end' : 'justify-start'}`}
            >
              {!mine && chat.kind !== 'dm' && (
                <button
                  onClick={() => author && navigate(`/profile/${author.id}`)}
                  className={`shrink-0 ${showAvatar ? '' : 'invisible'}`}
                >
                  <Avatar name={author?.name ?? '?'} size={28} filled />
                </button>
              )}
              <button
                onContextMenu={(e) => {
                  if (isDeleted) return
                  e.preventDefault()
                  setActionFor(m)
                }}
                onTouchStart={(e) => {
                  if (isDeleted) return
                  const start = Date.now()
                  const target = e.currentTarget
                  const onEnd = () => {
                    target.removeEventListener('touchend', onEnd)
                    if (Date.now() - start > 450) setActionFor(m)
                  }
                  target.addEventListener('touchend', onEnd, { once: true })
                }}
                className="block max-w-[78%] rounded-2xl border-2 border-ink px-3 py-2 text-left text-sm"
                style={{
                  background: mine ? 'var(--mine-bg)' : 'var(--theirs-bg)',
                  color: mine ? 'var(--mine-fg)' : 'var(--theirs-fg)',
                }}
              >
                {!mine && chat.kind !== 'dm' && showAvatar && author && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/profile/${author.id}`)
                    }}
                    className="mb-0.5 block text-left text-[11px] font-black"
                  >
                    {author.name}
                  </button>
                )}
                {replyMsg && (
                  <div
                    className="mb-1 cursor-pointer rounded-md border-l-2 border-current/40 bg-current/10 px-2 py-1 text-[11px]"
                    onClick={(e) => {
                      e.stopPropagation()
                      const el = document.getElementById(`msg-${replyMsg.id}`)
                      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }}
                  >
                    <div className="font-bold opacity-80">
                      {replyAuthor?.name ?? '?'}
                    </div>
                    <div className="truncate opacity-70">{replyMsg.text || '…'}</div>
                  </div>
                )}
                <div id={`msg-${m.id}`} />
                {isDeleted ? (
                  <p className="italic opacity-60">{t('msg.deleted', state.lang)}</p>
                ) : (
                  <MessageContent text={m.text} onMine={mine} />
                )}
                <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] opacity-70">
                  {m.editedAt && !isDeleted && <span>{t('msg.edited', state.lang)}</span>}
                  <span>{relTime(m.at, state.lang)}</span>
                </div>
              </button>
              {m.reactions && m.reactions.length > 0 && !isDeleted && (
                <div
                  className={`mt-1 flex flex-wrap gap-1 ${mine ? 'justify-end' : 'justify-start'}`}
                >
                  {m.reactions.map((r) => (
                    <button
                      key={r.emoji}
                      type="button"
                      onClick={() => void toggleReaction(chat.id, m.id, r.emoji)}
                      className={`flex items-center gap-1 rounded-full border-2 px-2 py-0.5 text-[12px] leading-none ${
                        r.mine
                          ? 'border-ink bg-ink text-paper'
                          : 'border-ink bg-paper text-ink'
                      }`}
                      aria-label={`Reaction ${r.emoji}`}
                    >
                      <span className="font-emoji">{r.emoji}</span>
                      <span className="font-bold tabular-nums">{r.count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
      <ChatComposer
        chatId={chat.id}
        onSend={onSend}
        editing={editing}
        onSubmitEdit={onSubmitEdit}
        onCancelEdit={() => setEditing(null)}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />

      {/* Long-press / right-click action sheet */}
      <Modal open={!!actionFor} onClose={() => setActionFor(null)} title={t('msg.copy', state.lang)}>
        {actionFor && (
          <ul className="flex flex-col gap-1 text-base font-bold">
            <li className="mb-1 flex items-center justify-between gap-1 rounded-2xl border-2 border-ink p-1">
              {QUICK_REACTIONS.map((emoji) => {
                const isMine =
                  actionFor.reactions?.find((r) => r.emoji === emoji)?.mine ?? false
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      void toggleReaction(chat.id, actionFor.id, emoji)
                      setActionFor(null)
                    }}
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-xl transition ${
                      isMine ? 'bg-ink text-paper' : 'hover:bg-ink/10'
                    }`}
                    aria-label={`React ${emoji}`}
                  >
                    <span className="font-emoji">{emoji}</span>
                  </button>
                )
              })}
            </li>
            <Sheet
              label={t('msg.reply', state.lang)}
              onClick={() => {
                const author = userById(actionFor.authorId)
                setReplyTo({
                  id: actionFor.id,
                  preview: actionFor.text || '…',
                  author: author?.name ? `@${author.handle ?? author.id}` : undefined,
                })
                setActionFor(null)
              }}
            />
            <Sheet
              label={t('msg.copy', state.lang)}
              onClick={() => {
                void onCopy(actionFor)
                setActionFor(null)
              }}
            />
            <Sheet
              label={t('msg.forward', state.lang)}
              onClick={() => {
                setForwardOpen(actionFor)
                setActionFor(null)
              }}
            />
            {actionFor.authorId === myId && (
              <Sheet
                label={t('msg.edit', state.lang)}
                onClick={() => {
                  setEditing({ id: actionFor.id, text: actionFor.text })
                  setActionFor(null)
                }}
              />
            )}
            <Sheet
              destructive
              label={t('msg.delete', state.lang)}
              onClick={() => {
                setConfirmDelete(actionFor)
                setActionFor(null)
              }}
            />
          </ul>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        message={t('msg.confirmDelete', state.lang)}
        okLabel={t('common.delete', state.lang)}
        cancelLabel={t('common.cancel', state.lang)}
        destructive
        onResolve={(ok) => {
          const m = confirmDelete
          setConfirmDelete(null)
          if (ok && m) void deleteMessage(chat.id, m.id)
        }}
      />

      {forwardOpen && (
        <ForwardSheet
          message={forwardOpen}
          onClose={() => setForwardOpen(null)}
          currentChatId={chat.id}
        />
      )}

      {copied && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-[80] -translate-x-1/2 rounded-full bg-ink px-4 py-1.5 text-xs font-bold text-paper">
          {t('common.copied', state.lang)}
        </div>
      )}
    </div>
  )
}

function Sheet({
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
        onClick={onClick}
        className={`row-press w-full rounded-xl px-3 py-3 text-left ${
          destructive ? 'underline decoration-ink underline-offset-4' : ''
        }`}
      >
        {label}
      </button>
    </li>
  )
}

function ForwardSheet({
  message,
  onClose,
  currentChatId,
}: {
  message: Message
  onClose: () => void
  currentChatId: string
}) {
  const { state, sendMessage } = useApp()
  const candidates = state.chats.filter((c) => c.id !== currentChatId)
  return (
    <Modal open onClose={onClose} title={t('msg.forward', state.lang)}>
      <ul className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto">
        {candidates.length === 0 && (
          <li className="text-center text-sm text-muted">No other chats</li>
        )}
        {candidates.map((c) => (
          <li key={c.id}>
            <button
              onClick={async () => {
                await sendMessage(c.id, message.text || '')
                onClose()
              }}
              className="row-press flex w-full items-center gap-3 rounded-2xl border border-line px-3 py-2 text-left"
            >
              <Avatar name={c.title} size={36} filled />
              <span className="min-w-0 flex-1 truncate font-bold">{c.title}</span>
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
