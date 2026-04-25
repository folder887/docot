import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useApp } from '../store'
import { api } from '../api'

/** /u/:handle → resolves handle to user id and redirects to /profile/:id. */
export function UserHandleRedirect() {
  const { handle } = useParams<{ handle: string }>()
  const { state } = useApp()
  const [resolvedId, setResolvedId] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!handle) return
    let alive = true
    void (async () => {
      try {
        const cleanHandle = handle.replace(/^@/, '')
        const list = await api.searchUsers(cleanHandle)
        const exact = list.find((u) => u.handle.toLowerCase() === cleanHandle.toLowerCase())
        if (alive) {
          if (exact) setResolvedId(exact.id)
          else setNotFound(true)
        }
      } catch {
        if (alive) setNotFound(true)
      }
    })()
    return () => {
      alive = false
    }
  }, [handle])

  if (resolvedId) return <Navigate to={`/profile/${resolvedId}`} replace />
  if (notFound) return <Navigate to="/chats" replace />
  return (
    <div className="flex h-full items-center justify-center bg-paper text-sm text-muted">
      {state.lang === 'ru' ? 'Загрузка…' : 'Loading…'}
    </div>
  )
}
