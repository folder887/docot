/** Shared types for the WebRTC call subsystem. */

/** Wire-level signalling envelope. The `from`/`to` fields are user-ids;
 * the relay stamps `from` with the authenticated sender so the receiver
 * never has to trust a client-supplied identity. */
export type SignalEvent =
  | { type: 'call:offer'; to: string; from?: string; sdp: string; media: 'audio' | 'video'; callId: string }
  | { type: 'call:answer'; to: string; from?: string; sdp: string; callId: string }
  | { type: 'call:ice'; to: string; from?: string; candidate: RTCIceCandidateInit; callId: string }
  | { type: 'call:reject'; to: string; from?: string; callId: string }
  | { type: 'call:end'; to: string; from?: string; callId: string }
  | { type: 'call:cancel'; to: string; from?: string; callId: string }
  | { type: 'call:ringing'; to: string; from?: string; callId: string }
  | { type: 'call:media'; to: string; from?: string; callId: string; mic: boolean; cam: boolean }
  | { type: 'call:unreachable'; to: string }

/** Public state of an active call as exposed to React UI. */
export type CallState =
  | { kind: 'idle' }
  | { kind: 'outgoing'; peerId: string; media: 'audio' | 'video'; callId: string; mic: boolean; cam: boolean }
  | { kind: 'ringing'; peerId: string; media: 'audio' | 'video'; callId: string }
  | { kind: 'incoming'; peerId: string; media: 'audio' | 'video'; callId: string }
  | { kind: 'connecting'; peerId: string; media: 'audio' | 'video'; callId: string; mic: boolean; cam: boolean }
  | { kind: 'in-call'; peerId: string; media: 'audio' | 'video'; callId: string; mic: boolean; cam: boolean; peerMic: boolean; peerCam: boolean; startedAt: number }
  | { kind: 'ended'; peerId: string; reason: 'rejected' | 'unreachable' | 'remote-hangup' | 'local-hangup' | 'failed' }

export type MediaKind = 'audio' | 'video'
