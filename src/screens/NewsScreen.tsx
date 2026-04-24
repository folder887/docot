import { useState } from 'react'
import { useApp } from '../store'
import { relTime, t } from '../i18n'
import { Avatar } from '../components/Avatar'
import { IconHeart, IconRepeat, IconReply } from '../components/Icons'

export function NewsScreen() {
  const { state, addPost, toggleLike, repost } = useApp()
  const [text, setText] = useState('')

  const authorOf = (id: string) =>
    id === 'me' ? state.me : state.contacts.find((c) => c.id === id) ?? state.me

  return (
    <div className="flex flex-col bg-white">
      <form
        className="border-b-2 border-black p-4"
        onSubmit={(e) => {
          e.preventDefault()
          addPost(text)
          setText('')
        }}
      >
        <div className="flex gap-3">
          <Avatar name={state.me.name} size={40} filled />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder={t('news.composer', state.lang)}
            className="flex-1 resize-none bg-transparent text-base focus:outline-none"
          />
        </div>
        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            type="submit"
            disabled={!text.trim()}
            className="bw-btn-primary px-5 py-2 text-sm disabled:opacity-40"
          >
            {t('news.post', state.lang)}
          </button>
        </div>
      </form>

      <ul>
        {state.news.map((p) => {
          const a = authorOf(p.authorId)
          return (
            <li key={p.id} className="border-b border-black/15 p-4">
              <div className="flex gap-3">
                <Avatar name={a.name} size={40} filled={p.authorId !== 'me'} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 text-sm">
                    <span className="font-black">{a.name}</span>
                    <span className="opacity-70">{a.handle}</span>
                    <span className="opacity-50">· {relTime(p.at, state.lang)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed">{p.text}</p>
                  <div className="mt-3 flex items-center justify-between pr-4 text-black/70">
                    <ActionBtn icon={<IconReply size={18} />} count={p.replies} onClick={() => {}} />
                    <ActionBtn icon={<IconRepeat size={18} />} count={p.reposts} onClick={() => repost(p.id)} />
                    <ActionBtn
                      icon={<IconHeart size={18} filled={p.liked} />}
                      count={p.likes}
                      onClick={() => toggleLike(p.id)}
                      active={p.liked}
                    />
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
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
  return (
    <button onClick={onClick} className={`flex items-center gap-1 text-xs font-bold ${active ? 'text-black' : ''}`}>
      <span className={`flex h-7 w-7 items-center justify-center rounded-full ${active ? 'bg-black text-white' : ''}`}>
        {icon}
      </span>
      {count}
    </button>
  )
}
