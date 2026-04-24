import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../store'
import { relTime, t } from '../i18n'
import { ScreenHeader } from '../components/ScreenHeader'
import { Avatar } from '../components/Avatar'
import { IconSend } from '../components/Icons'

export function ChatDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const { state, sendMessage } = useApp()
  const chat = useMemo(() => state.chats.find((c) => c.id === id), [id, state.chats])
  const [text, setText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat?.messages.length])

  if (!chat) {
    return (
      <div className="flex h-full flex-col">
        <ScreenHeader title="Chat" />
        <div className="p-6 text-black/60">Chat not found.</div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <ScreenHeader
        title={
          <div className="flex items-center justify-center gap-2">
            <Avatar name={chat.title} size={28} filled={chat.kind === 'channel'} />
            <span className="truncate">{chat.title}</span>
          </div>
        }
      />
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-4">
        {chat.messages.map((m) => {
          const mine = m.authorId === 'me'
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[78%] rounded-2xl border-2 border-black px-3 py-2 text-sm ${
                  mine ? 'bg-black text-white' : 'bg-white text-black'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
                <div className={`mt-1 text-[10px] ${mine ? 'text-white/70' : 'text-black/60'} text-right`}>
                  {relTime(m.at, state.lang)}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
      <form
        className="flex items-end gap-2 border-t-2 border-black bg-white px-3 py-2"
        onSubmit={(e) => {
          e.preventDefault()
          sendMessage(chat.id, text)
          setText('')
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={1}
          placeholder={t('chat.placeholder', state.lang)}
          className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border-2 border-black bg-white px-4 py-2.5 text-base text-black placeholder:text-black/40 focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              sendMessage(chat.id, text)
              setText('')
            }
          }}
        />
        <button
          type="submit"
          aria-label={t('chat.send', state.lang)}
          className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-black bg-black text-white"
        >
          <IconSend size={20} />
        </button>
      </form>
    </div>
  )
}
