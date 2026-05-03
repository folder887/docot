import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { API_URL, getToken } from '../api'
import { useApp } from '../store'
import type { CallState, MediaKind, SignalEvent } from './types'

// Public STUN servers — fine for most home/office networks. We
// intentionally don't ship a TURN URL: TURN requires authenticated
// credentials and a relay we'd have to operate. ~85% of 1:1 calls
// connect via STUN alone, and the symptom for the remaining 15% is
// "audio/video doesn't connect" — a known v0.1.5 limitation.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

type CallsCtx = {
  state: CallState
  /** Local media stream attached to the local <video>; null when no call. */
  localStream: MediaStream | null
  /** Remote media stream attached to the remote <video>; null until ICE connects. */
  remoteStream: MediaStream | null
  /** Initiate an outgoing call to a user. Resolves immediately; UI tracks `state`. */
  startCall: (peerId: string, media: MediaKind) => Promise<void>
  /** Accept the currently-ringing inbound call. */
  acceptCall: () => Promise<void>
  /** Reject (incoming) / cancel (outgoing pre-answer) / hang up (in-call) — symmetric API. */
  endCall: () => void
  /** Toggle microphone track. */
  toggleMic: () => void
  /** Toggle camera track. Only meaningful for video calls. */
  toggleCam: () => void
  /** Dismiss the post-call "ended" banner. */
  clearEnded: () => void
}

const CallsContext = createContext<CallsCtx | null>(null)

export function useCalls(): CallsCtx {
  const ctx = useContext(CallsContext)
  if (!ctx) throw new Error('useCalls must be used inside <CallsProvider>')
  return ctx
}

function newCallId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function buildWsUrl(token: string): string {
  const url = new URL(API_URL.replace(/^http/, 'ws') + '/calls/ws')
  url.searchParams.set('token', token)
  return url.toString()
}

export function CallsProvider({ children }: { children: ReactNode }) {
  const { state: appState } = useApp()
  const myId = appState.me?.id ?? null

  const [state, setState] = useState<CallState>({ kind: 'idle' })
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([])
  // Mirror state into a ref so async signalling handlers always see the
  // latest state without re-binding the WS each render.
  const stateRef = useRef<CallState>(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  // --- Signalling socket ---------------------------------------------------
  // Reconnects with simple backoff while the user is logged in. The
  // server evicts the previous socket on reconnect, so we never end up
  // with two open relays for the same user.
  useEffect(() => {
    if (!myId) return
    let cancelled = false
    let retryMs = 1000
    let timer: number | null = null

    const connect = () => {
      const token = getToken()
      if (!token) return
      const ws = new WebSocket(buildWsUrl(token))
      wsRef.current = ws
      ws.onopen = () => {
        retryMs = 1000
      }
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data) as SignalEvent
          void handleSignal(msg)
        } catch {
          /* ignore */
        }
      }
      ws.onclose = () => {
        if (cancelled) return
        if (wsRef.current === ws) wsRef.current = null
        timer = window.setTimeout(connect, retryMs)
        retryMs = Math.min(retryMs * 2, 15_000)
      }
      ws.onerror = () => {
        try {
          ws.close()
        } catch {
          /* ignore */
        }
      }
    }

    connect()
    return () => {
      cancelled = true
      if (timer != null) window.clearTimeout(timer)
      try {
        wsRef.current?.close()
      } catch {
        /* ignore */
      }
      wsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId])

  const sendSignal = useCallback((ev: SignalEvent) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    try {
      ws.send(JSON.stringify(ev))
    } catch {
      /* ignore */
    }
  }, [])

  // --- WebRTC plumbing -----------------------------------------------------
  const cleanupPC = useCallback(() => {
    const pc = pcRef.current
    pcRef.current = null
    if (pc) {
      pc.onicecandidate = null
      pc.ontrack = null
      pc.onconnectionstatechange = null
      try {
        pc.close()
      } catch {
        /* ignore */
      }
    }
    const ls = localStreamRef.current
    localStreamRef.current = null
    if (ls) {
      for (const t of ls.getTracks()) {
        try {
          t.stop()
        } catch {
          /* ignore */
        }
      }
    }
    setLocalStream(null)
    setRemoteStream(null)
    pendingIceRef.current = []
  }, [])

  const buildPC = useCallback(
    (peerId: string, callId: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
      pcRef.current = pc
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendSignal({
            type: 'call:ice',
            to: peerId,
            callId,
            candidate: e.candidate.toJSON(),
          })
        }
      }
      const remote = new MediaStream()
      setRemoteStream(remote)
      pc.ontrack = (e) => {
        for (const track of e.streams[0]?.getTracks() ?? [e.track]) {
          if (!remote.getTracks().includes(track)) remote.addTrack(track)
        }
      }
      pc.onconnectionstatechange = () => {
        const cs = pc.connectionState
        if (cs === 'connected') {
          setState((s) => {
            if (s.kind === 'connecting' || s.kind === 'in-call') {
              return s.kind === 'in-call'
                ? s
                : {
                    kind: 'in-call',
                    peerId: s.peerId,
                    media: s.media,
                    callId: s.callId,
                    mic: s.mic,
                    cam: s.cam,
                    peerMic: true,
                    peerCam: s.media === 'video',
                    startedAt: Date.now(),
                  }
            }
            return s
          })
        } else if (cs === 'failed' || cs === 'disconnected' || cs === 'closed') {
          if (stateRef.current.kind === 'in-call' || stateRef.current.kind === 'connecting') {
            cleanupPC()
            setState({ kind: 'ended', peerId, reason: cs === 'failed' ? 'failed' : 'remote-hangup' })
          }
        }
      }
      return pc
    },
    [sendSignal, cleanupPC],
  )

  const acquireMedia = useCallback(
    async (media: MediaKind): Promise<MediaStream> => {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: media === 'video' ? { width: 640, height: 480 } : false,
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      localStreamRef.current = stream
      setLocalStream(stream)
      return stream
    },
    [],
  )

  const drainPendingIce = useCallback(async () => {
    const pc = pcRef.current
    if (!pc || !pc.remoteDescription) return
    const queue = pendingIceRef.current
    pendingIceRef.current = []
    for (const c of queue) {
      try {
        await pc.addIceCandidate(c)
      } catch {
        /* ignore */
      }
    }
  }, [])

  // --- Inbound signal handler ---------------------------------------------
  const handleSignal = useCallback(
    async (ev: SignalEvent) => {
      const cur = stateRef.current
      switch (ev.type) {
        case 'call:offer': {
          // Reject a second incoming call while we're busy.
          if (cur.kind !== 'idle' && cur.kind !== 'ended') {
            sendSignal({ type: 'call:reject', to: ev.from!, callId: ev.callId })
            return
          }
          setState({
            kind: 'incoming',
            peerId: ev.from!,
            media: ev.media,
            callId: ev.callId,
          })
          // We'll create the PC and apply this SDP only when the user
          // accepts; until then, hold the offer.
          incomingOfferRef.current = { from: ev.from!, sdp: ev.sdp, callId: ev.callId, media: ev.media }
          sendSignal({ type: 'call:ringing', to: ev.from!, callId: ev.callId })
          break
        }
        case 'call:answer': {
          if (cur.kind !== 'outgoing' && cur.kind !== 'ringing' && cur.kind !== 'connecting') return
          if (cur.callId !== ev.callId) return
          const pc = pcRef.current
          if (!pc) return
          await pc.setRemoteDescription({ type: 'answer', sdp: ev.sdp })
          await drainPendingIce()
          setState({
            kind: 'connecting',
            peerId: cur.peerId,
            media: cur.media,
            callId: cur.callId,
            mic: 'mic' in cur ? cur.mic : true,
            cam: 'cam' in cur ? cur.cam : cur.media === 'video',
          })
          break
        }
        case 'call:ice': {
          if (cur.kind === 'idle' || cur.kind === 'ended') return
          if ('callId' in cur && cur.callId !== ev.callId) return
          const pc = pcRef.current
          if (!pc || !pc.remoteDescription) {
            pendingIceRef.current.push(ev.candidate)
            return
          }
          try {
            await pc.addIceCandidate(ev.candidate)
          } catch {
            /* ignore */
          }
          break
        }
        case 'call:ringing': {
          if (cur.kind === 'outgoing' && cur.callId === ev.callId) {
            setState({ ...cur, kind: 'ringing' } as CallState)
          }
          break
        }
        case 'call:reject':
        case 'call:cancel':
        case 'call:end': {
          if (cur.kind === 'idle' || cur.kind === 'ended') return
          if ('callId' in cur && cur.callId !== ev.callId) return
          cleanupPC()
          incomingOfferRef.current = null
          setState({
            kind: 'ended',
            peerId: 'peerId' in cur ? cur.peerId : ev.from ?? '',
            reason: ev.type === 'call:reject' ? 'rejected' : 'remote-hangup',
          })
          break
        }
        case 'call:media': {
          if (cur.kind === 'in-call' && cur.callId === ev.callId) {
            setState({ ...cur, peerMic: ev.mic, peerCam: ev.cam })
          }
          break
        }
        case 'call:unreachable': {
          if ((cur.kind === 'outgoing' || cur.kind === 'ringing') && cur.peerId === ev.to) {
            cleanupPC()
            setState({ kind: 'ended', peerId: cur.peerId, reason: 'unreachable' })
          }
          break
        }
      }
    },
    [sendSignal, drainPendingIce, cleanupPC],
  )

  const incomingOfferRef = useRef<
    { from: string; sdp: string; callId: string; media: MediaKind } | null
  >(null)

  // --- Public actions ------------------------------------------------------
  const startCall = useCallback(
    async (peerId: string, media: MediaKind) => {
      // Use the ref, not the closure: `acquireMedia` awaits the browser
      // permission prompt (can take seconds), during which an inbound
      // call may have transitioned us into `incoming`. Re-checking
      // closure state would clobber that with an outgoing call the user
      // never asked for. Same pattern as acceptCall / endCall.
      if (stateRef.current.kind !== 'idle' && stateRef.current.kind !== 'ended') return
      const callId = newCallId()
      try {
        const stream = await acquireMedia(media)
        // Re-check after the await: a `call:offer` could have arrived
        // during the permission prompt and won the race.
        if (stateRef.current.kind !== 'idle' && stateRef.current.kind !== 'ended') {
          for (const tr of stream.getTracks()) {
            try {
              tr.stop()
            } catch {
              /* ignore */
            }
          }
          localStreamRef.current = null
          setLocalStream(null)
          return
        }
        const pc = buildPC(peerId, callId)
        for (const track of stream.getTracks()) pc.addTrack(track, stream)
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        sendSignal({
          type: 'call:offer',
          to: peerId,
          callId,
          media,
          sdp: offer.sdp ?? '',
        })
        setState({
          kind: 'outgoing',
          peerId,
          media,
          callId,
          mic: true,
          cam: media === 'video',
        })
      } catch {
        cleanupPC()
        setState({ kind: 'ended', peerId, reason: 'failed' })
      }
    },
    [acquireMedia, buildPC, sendSignal, cleanupPC],
  )

  const acceptCall = useCallback(async () => {
    const cur = stateRef.current
    if (cur.kind !== 'incoming') return
    const offer = incomingOfferRef.current
    if (!offer) return
    incomingOfferRef.current = null
    try {
      const stream = await acquireMedia(cur.media)
      // Same race as startCall: while the user was clicking through the
      // browser permission prompt the caller could have sent
      // `call:cancel` / `call:end`, which moved us to `ended`. Bail out
      // (and free the just-opened mic/camera) instead of answering into
      // the void and leaving the callee stuck on "Connecting…".
      if (stateRef.current.kind !== 'incoming') {
        for (const tr of stream.getTracks()) {
          try {
            tr.stop()
          } catch {
            /* ignore */
          }
        }
        localStreamRef.current = null
        setLocalStream(null)
        return
      }
      const pc = buildPC(cur.peerId, cur.callId)
      for (const track of stream.getTracks()) pc.addTrack(track, stream)
      await pc.setRemoteDescription({ type: 'offer', sdp: offer.sdp })
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      await drainPendingIce()
      sendSignal({
        type: 'call:answer',
        to: cur.peerId,
        callId: cur.callId,
        sdp: answer.sdp ?? '',
      })
      setState({
        kind: 'connecting',
        peerId: cur.peerId,
        media: cur.media,
        callId: cur.callId,
        mic: true,
        cam: cur.media === 'video',
      })
    } catch {
      cleanupPC()
      sendSignal({ type: 'call:reject', to: cur.peerId, callId: cur.callId })
      setState({ kind: 'ended', peerId: cur.peerId, reason: 'failed' })
    }
  }, [acquireMedia, buildPC, sendSignal, drainPendingIce, cleanupPC])

  const endCall = useCallback(() => {
    const cur = stateRef.current
    if (cur.kind === 'idle' || cur.kind === 'ended') return
    let signal: SignalEvent['type'] | null = null
    if (cur.kind === 'incoming') signal = 'call:reject'
    else if (cur.kind === 'outgoing' || cur.kind === 'ringing') signal = 'call:cancel'
    else signal = 'call:end'
    if (signal && 'peerId' in cur && 'callId' in cur) {
      sendSignal({ type: signal, to: cur.peerId, callId: cur.callId } as SignalEvent)
    }
    cleanupPC()
    incomingOfferRef.current = null
    setState({
      kind: 'ended',
      peerId: 'peerId' in cur ? cur.peerId : '',
      reason: 'local-hangup',
    })
  }, [sendSignal, cleanupPC])

  const sendMediaState = useCallback(
    (mic: boolean, cam: boolean) => {
      const cur = stateRef.current
      if (cur.kind !== 'in-call' && cur.kind !== 'connecting' && cur.kind !== 'outgoing' && cur.kind !== 'ringing') return
      sendSignal({ type: 'call:media', to: cur.peerId, callId: cur.callId, mic, cam })
    },
    [sendSignal],
  )

  // Toggle helpers keep the setState updater pure — sending the
  // `call:media` signal lives outside it, so React.StrictMode's
  // double-invocation of updaters won't ship the change twice.
  const toggleMic = useCallback(() => {
    const ls = localStreamRef.current
    if (!ls) return
    const audio = ls.getAudioTracks()[0]
    if (!audio) return
    audio.enabled = !audio.enabled
    setState((s) => (('mic' in s) ? ({ ...s, mic: audio.enabled } as CallState) : s))
    const cur = stateRef.current
    const cam = 'cam' in cur ? (cur as { cam: boolean }).cam : false
    sendMediaState(audio.enabled, cam)
  }, [sendMediaState])

  const toggleCam = useCallback(() => {
    const ls = localStreamRef.current
    if (!ls) return
    const video = ls.getVideoTracks()[0]
    if (!video) return
    video.enabled = !video.enabled
    setState((s) => (('cam' in s) ? ({ ...s, cam: video.enabled } as CallState) : s))
    const cur = stateRef.current
    const mic = 'mic' in cur ? (cur as { mic: boolean }).mic : true
    sendMediaState(mic, video.enabled)
  }, [sendMediaState])

  const clearEnded = useCallback(() => {
    setState((s) => (s.kind === 'ended' ? { kind: 'idle' } : s))
  }, [])

  const ctx = useMemo<CallsCtx>(
    () => ({ state, localStream, remoteStream, startCall, acceptCall, endCall, toggleMic, toggleCam, clearEnded }),
    [state, localStream, remoteStream, startCall, acceptCall, endCall, toggleMic, toggleCam, clearEnded],
  )

  return <CallsContext.Provider value={ctx}>{children}</CallsContext.Provider>
}
