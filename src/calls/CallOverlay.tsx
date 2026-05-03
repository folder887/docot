import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../store'
import { t } from '../i18n'
import { Avatar } from '../components/Avatar'
import { useCalls } from './CallsProvider'

function fmtElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  const ss = (s % 60).toString().padStart(2, '0')
  return `${m}:${ss}`
}

/** Floating overlay for incoming / outgoing / active calls. Renders nothing
 * when state.kind === 'idle'. Stays mounted globally so a call survives
 * route changes. */
export function CallOverlay() {
  const { state: appState, userById, loadUser } = useApp()
  const lang = appState.lang
  const calls = useCalls()
  const { state, localStream, remoteStream, acceptCall, endCall, toggleMic, toggleCam, clearEnded } = calls
  // Callback refs: video / audio elements are conditionally mounted (the
  // <video> tags exist only while `showVideo` is true; the <audio> only
  // for audio calls). Streams are set inside the provider *before* state
  // transitions to a kind that mounts those elements, so a regular
  // useRef + useEffect would never see the element when the stream is
  // ready, leaving srcObject null. Callback refs run the moment the
  // element attaches, so we wire srcObject as soon as both are present.
  const remoteAttach = useCallback(
    (el: HTMLVideoElement | HTMLAudioElement | null) => {
      if (el) el.srcObject = remoteStream
    },
    [remoteStream],
  )
  const localAttach = useCallback(
    (el: HTMLVideoElement | null) => {
      if (el) el.srcObject = localStream
    },
    [localStream],
  )
  const [tick, setTick] = useState(0)

  // Tick once a second to refresh the elapsed timer in `in-call`.
  useEffect(() => {
    if (state.kind !== 'in-call') return
    const id = window.setInterval(() => setTick((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [state.kind])

  // Ensure we have a User record for the peer so we can show name/avatar.
  const peerId = 'peerId' in state ? state.peerId : null
  useEffect(() => {
    if (peerId && !appState.users[peerId]) void loadUser(peerId)
  }, [peerId, appState.users, loadUser])

  // Auto-dismiss the "ended" banner after a few seconds.
  useEffect(() => {
    if (state.kind !== 'ended') return
    const id = window.setTimeout(clearEnded, 3500)
    return () => window.clearTimeout(id)
  }, [state.kind, clearEnded])

  if (state.kind === 'idle') return null
  const peer = peerId ? userById(peerId) : null
  const peerName = peer?.name || (peer?.handle ? `@${peer.handle}` : peerId || '…')

  // Status line under the peer name.
  let status = ''
  if (state.kind === 'outgoing') status = t('call.calling', lang)
  else if (state.kind === 'ringing') status = t('call.ringing', lang)
  else if (state.kind === 'incoming') status = t('call.incoming', lang)
  else if (state.kind === 'connecting') status = t('call.connecting', lang)
  else if (state.kind === 'in-call') status = fmtElapsed(Date.now() - state.startedAt + tick * 0)
  else if (state.kind === 'ended') {
    if (state.reason === 'rejected') status = t('call.rejected', lang)
    else if (state.reason === 'unreachable') status = t('call.unreachable', lang)
    else if (state.reason === 'failed') status = t('call.failed', lang)
    else status = t('call.ended', lang)
  }

  const isVideo = 'media' in state && state.media === 'video'
  const showVideo = isVideo && (state.kind === 'connecting' || state.kind === 'in-call')

  return (
    <div className="fixed inset-0 z-[90] flex flex-col items-center justify-between bg-ink/95 p-6 text-paper">
      {/* Top: peer info */}
      <div className="flex flex-col items-center gap-3 pt-8">
        <Avatar name={peerName} size={88} filled />
        <div className="text-center">
          <div className="text-2xl font-black">{peerName}</div>
          <div className="text-sm opacity-80">{status}</div>
        </div>
      </div>

      {/* Middle: video tiles (only for video calls that have started) */}
      {showVideo && (
        <div className="relative my-4 flex w-full max-w-[480px] flex-1 items-center justify-center">
          <video
            ref={remoteAttach}
            autoPlay
            playsInline
            className="max-h-full w-full rounded-2xl border-2 border-paper bg-black object-contain"
          />
          <video
            ref={localAttach}
            autoPlay
            playsInline
            muted
            className="absolute bottom-2 right-2 h-24 w-32 rounded-xl border-2 border-paper bg-black object-cover"
          />
        </div>
      )}

      {/* Hidden audio for audio-only calls — must still play to expose remote audio. */}
      {!isVideo && <audio ref={remoteAttach} autoPlay />}

      {/* Bottom: call controls */}
      <div className="flex w-full max-w-md items-center justify-center gap-4 pb-6">
        {state.kind === 'incoming' ? (
          <>
            <button
              type="button"
              onClick={endCall}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-2xl font-black text-paper"
              aria-label={t('call.reject', lang)}
            >
              ✕
            </button>
            <button
              type="button"
              onClick={() => void acceptCall()}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-green-600 text-2xl font-black text-paper"
              aria-label={t('call.accept', lang)}
            >
              ✓
            </button>
          </>
        ) : state.kind === 'ended' ? (
          <button
            type="button"
            onClick={clearEnded}
            className="rounded-2xl border-2 border-paper bg-paper px-6 py-2 font-bold text-ink"
          >
            {t('common.close', lang)}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={toggleMic}
              className={`flex h-14 w-14 items-center justify-center rounded-full border-2 border-paper text-xl font-black ${
                'mic' in state && state.mic ? 'bg-paper text-ink' : 'bg-transparent text-paper'
              }`}
              aria-label={t('call.mute', lang)}
            >
              {'mic' in state && state.mic ? '🎤' : '🔇'}
            </button>
            {isVideo && (
              <button
                type="button"
                onClick={toggleCam}
                className={`flex h-14 w-14 items-center justify-center rounded-full border-2 border-paper text-xl font-black ${
                  'cam' in state && state.cam ? 'bg-paper text-ink' : 'bg-transparent text-paper'
                }`}
                aria-label={t('call.cam', lang)}
              >
                {'cam' in state && state.cam ? '📹' : '🚫'}
              </button>
            )}
            <button
              type="button"
              onClick={endCall}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-2xl font-black text-paper"
              aria-label={t('call.end', lang)}
            >
              ✕
            </button>
          </>
        )}
      </div>
    </div>
  )
}
