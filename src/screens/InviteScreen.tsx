import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../store'
import { t } from '../i18n'
import { ScreenHeader } from '../components/ScreenHeader'
import { Avatar } from '../components/Avatar'
import { api, type ApiInviteInfo } from '../api'

export function InviteScreen() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { state, refresh } = useApp()
  const [info, setInfo] = useState<ApiInviteInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let alive = true
    api
      .getInviteInfo(token)
      .then((i) => {
        if (alive) setInfo(i)
      })
      .catch(() => {
        if (alive) setError('not-found')
      })
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [token])

  const onJoin = async () => {
    if (!token) return
    if (state.status !== 'authed') {
      navigate(`/welcome?invite=${token}`)
      return
    }
    setJoining(true)
    try {
      const chat = await api.joinViaInvite(token)
      await refresh()
      navigate(`/chats/${chat.id}`)
    } catch {
      setError('join-failed')
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="flex h-full flex-col bg-paper">
      <ScreenHeader title={t('invite.title', state.lang)} />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-4 p-6">
        {loading && <p className="text-sm text-muted">{t('common.loading', state.lang)}</p>}
        {error && (
          <p className="text-center text-sm text-muted">{t('invite.invalid', state.lang)}</p>
        )}
        {info && info.valid && (
          <>
            <Avatar name={info.title} size={120} filled />
            <h1 className="italic-display text-center text-3xl">{info.title}</h1>
            <p className="text-xs uppercase tracking-widest text-muted">
              {info.kind === 'channel'
                ? t('profile.channel', state.lang)
                : t('profile.group', state.lang)}{' '}
              · {info.memberCount} {t('profile.members', state.lang)}
            </p>
            {info.description && (
              <p className="whitespace-pre-wrap text-center text-sm">{info.description}</p>
            )}
            {state.status === 'authed' && state.me && (
              <p className="text-xs text-muted">
                {t('invite.joinAs', state.lang)} <strong>@{state.me.handle}</strong>
              </p>
            )}
            <button
              onClick={onJoin}
              disabled={joining}
              className="bw-btn-primary mt-2 w-full disabled:opacity-50"
            >
              {joining ? t('common.loading', state.lang) : t('invite.join', state.lang)}
            </button>
          </>
        )}
        {info && !info.valid && (
          <p className="text-center text-sm text-muted">{t('invite.invalid', state.lang)}</p>
        )}
      </div>
    </div>
  )
}
