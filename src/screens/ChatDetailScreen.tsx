import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../store'
import { relTime, t } from '../i18n'
import { ScreenHeader } from '../components/ScreenHeader'
import { Avatar } from '../components/Avatar'
import { IconSend } from '../components/Icons'
import { api, getToken, openChatWebSocket } from '../api'
import type { Message } from '../types'

export function ChatDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const { state, sendMessage, peerOf, userById, loadUser, addIncomingMessage } = useApp()
  const navigate = useNavigate()
  const chat = useMemo(() => state.chats.find((c) => c.id === id), [id, state.chats])
  const peer = chat ? peerOf(chat) : null
  const [text, setText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const myId = state.me?.id

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat?.messages.length])

  // pre-load any unknown participants so bubbles render author name/avatar
  useEffect(() => {
    if (!chat) return
    for (const pid of chat.participants) {
      if (!state.users[pid] && pid !== state.me?.id) void loadUser(pid)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?.id])

  // load full message history once on open
  useEffect(() => {
    if (!id) return
    void api
      .getChat(id)
      .then((full) => {
        for (const m of full.messages) {
          addIncomingMessage(id, m)
        }
      })
      .catch(() => {
        /* ignore */
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // live websocket: accept new messages from others
  useEffect(() => {
    if (!chat) return
    const tok = getToken()
    if (!tok) return
    const ws = openChatWebSocket(chat.id, tok)
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as { type: string; message?: Message }
        if (data.type === 'message' && data.message) {
          if (data.message.authorId !== myId) {
            addIncomingMessage(chat.id, data.message)
          }
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
              <div className="truncate text-[11px] font-normal text-muted">{subtitle}</div>
            </div>
          </button>
        }
      />
      <div className="chat-wallpaper flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-4">
        <div className="wallpaper" />
        {chat.messages.map((m, i) => {
          const mine = m.authorId === myId
          const author = userById(m.authorId)
          const showAvatar = !mine && chat.kind !== 'dm' && (i === 0 || chat.messages[i - 1].authorId !== m.authorId)
          return (
            <div key={m.id} className={`relative z-10 flex items-end gap-2 bubble-in ${mine ? 'justify-end' : 'justify-start'}`}>
              {!mine && chat.kind !== 'dm' && (
                <button
                  onClick={() => author && navigate(`/profile/${author.id}`)}
                  className={`shrink-0 ${showAvatar ? '' : 'invisible'}`}
                >
                  <Avatar name={author?.name ?? '?'} size={28} filled />
                </button>
              )}
              <div
                className={`max-w-[78%] rounded-2xl border-2 border-ink px-3 py-2 text-sm`}
                style={{
                  background: mine ? 'var(--mine-bg)' : 'var(--theirs-bg)',
                  color: mine ? 'var(--mine-fg)' : 'var(--theirs-fg)',
                }}
              >
                {!mine && chat.kind !== 'dm' && showAvatar && author && (
                  <button
                    onClick={() => navigate(`/profile/${author.id}`)}
                    className="mb-0.5 block text-left text-[11px] font-black"
                  >
                    {author.name}
                  </button>
                )}
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
                <div className={`mt-1 text-right text-[10px] opacity-70`}>
                  {relTime(m.at, state.lang)}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
      <form
        className="flex items-end gap-2 border-t-2 border-ink bg-paper px-3 py-2"
        onSubmit={(e) => {
          e.preventDefault()
          const t0 = text
          setText('')
          void sendMessage(chat.id, t0)
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={1}
          placeholder={t('chat.placeholder', state.lang)}
          className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border-2 border-ink bg-paper px-4 py-2.5 text-base text-ink focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              const t0 = text
              setText('')
              void sendMessage(chat.id, t0)
            }
          }}
        />
        <button
          type="submit"
          aria-label={t('chat.send', state.lang)}
          className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-ink bg-ink text-paper"
        >
          <IconSend size={20} />
        </button>
      </form>
    </div>
  )
}
