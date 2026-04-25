/**
 * High-level helpers used by the rest of the app:
 *
 *   - `encryptForUser(myId, peerId, plaintext)` — for every device the peer
 *     has registered (and every other device of mine, for self-sync) build a
 *     Signal session if needed, encrypt the plaintext, and pack the resulting
 *     ciphertexts into a single multi-recipient envelope.
 *   - `decryptFromUser(myId, senderId, envelope)` — locate the entry addressed
 *     to *this* device, decrypt via the matching Signal session.
 *
 * Two wire formats coexist:
 *
 *   `__sig1:`  legacy single-recipient envelope (deviceId hard-coded to 1).
 *   `__sig1m:` multi-recipient envelope used when either side has registered
 *              a non-default deviceId. Includes the sender's deviceId so the
 *              receiver builds a session against the right address.
 *
 * Both formats are accepted on decryption; new sends always use `__sig1m:`.
 */

import {
  SessionBuilder,
  SessionCipher,
  SignalProtocolAddress,
} from '@privacyresearch/libsignal-protocol-typescript'

import { api } from '../api'
import { ab2b64, b642ab, ab2utf8, utf82ab } from './encoding'
import { localDeviceId } from './identity'
import { signalStore } from './store'

const LEGACY_DEVICE_ID = 1
const ENVELOPE_PREFIX_LEGACY = '__sig1:'
const ENVELOPE_PREFIX_MULTI = '__sig1m:'

/** One ciphertext addressed to a single (uid, deviceId) recipient. */
type Recipient = {
  /** Recipient userId. */
  uid: string
  /** Recipient deviceId. */
  did: number
  /** 1 = WhisperMessage, 3 = PreKeyWhisperMessage. */
  t: 1 | 3
  /** Sender registrationId. */
  r: number
  /** Base64 ciphertext body. */
  b: string
}

type MultiEnvelope = {
  v: 2
  /** Sender deviceId — needed so receivers address the right session. */
  s: number
  rcpts: Recipient[]
}

type LegacyEnvelope = {
  v: 1
  t: 1 | 3
  r: number
  b: string
}

export function isEncryptedEnvelope(text: string): boolean {
  return (
    typeof text === 'string' &&
    (text.startsWith(ENVELOPE_PREFIX_LEGACY) || text.startsWith(ENVELOPE_PREFIX_MULTI))
  )
}

/** Best-effort extraction of the sender's deviceId from a multi-device
 * envelope. Legacy envelopes implicitly use device 1; malformed payloads
 * return null so callers can fall back. */
export function envelopeSenderDeviceId(text: string): number | null {
  if (text.startsWith(ENVELOPE_PREFIX_LEGACY)) return LEGACY_DEVICE_ID
  const env = decodeMulti(text)
  return env ? env.s : null
}

/** True iff the sealed envelope's sender deviceId is one of *our* devices —
 * i.e. it was sent from a sibling browser/install of the same account. We use
 * this to distinguish self-sync messages (we are the author) from peer sends.
 * Errors and missing data conservatively return false so the caller falls
 * back to attributing the message to the DM peer.
 */
export async function isOwnEnvelope(myId: string, text: string): Promise<boolean> {
  try {
    const senderDevice = envelopeSenderDeviceId(text)
    if (senderDevice === null) return false
    const myDevices = await listDevicesSafe(myId)
    return myDevices.includes(senderDevice)
  } catch {
    return false
  }
}

function decodeMulti(text: string): MultiEnvelope | null {
  if (!text.startsWith(ENVELOPE_PREFIX_MULTI)) return null
  try {
    return JSON.parse(atob(text.slice(ENVELOPE_PREFIX_MULTI.length))) as MultiEnvelope
  } catch {
    return null
  }
}

function decodeLegacy(text: string): LegacyEnvelope | null {
  if (!text.startsWith(ENVELOPE_PREFIX_LEGACY)) return null
  try {
    return JSON.parse(atob(text.slice(ENVELOPE_PREFIX_LEGACY.length))) as LegacyEnvelope
  } catch {
    return null
  }
}

function addressFor(userId: string, deviceId: number): SignalProtocolAddress {
  return new SignalProtocolAddress(userId, deviceId)
}

/**
 * Per-(peer, device) serialization. Signal's Double Ratchet mutates session
 * state on every encrypt and decrypt; concurrent operations on the same
 * address race on read-modify-write of the IDB session blob and corrupt the
 * ratchet. We chain every session-touching call through a per-address promise
 * so they run strictly in order while still allowing different addresses to
 * proceed in parallel.
 */
const sessionLocks = new Map<string, Promise<unknown>>()
function withSessionLock<T>(addrKey: string, fn: () => Promise<T>): Promise<T> {
  const prev = sessionLocks.get(addrKey) ?? Promise.resolve()
  const next = prev.then(fn, fn)
  sessionLocks.set(
    addrKey,
    next.catch(() => undefined),
  )
  return next
}

async function ensureSessionFromBundle(
  userId: string,
  deviceId: number,
): Promise<void> {
  const address = addressFor(userId, deviceId)
  const existing = await signalStore.loadSession(address.toString())
  if (existing) return

  const bundle = await api.getKeyBundleForDevice(userId, deviceId)
  const builder = new SessionBuilder(signalStore, address)
  await builder.processPreKey({
    identityKey: b642ab(bundle.identityKey),
    registrationId: bundle.registrationId,
    signedPreKey: {
      keyId: bundle.signedPreKeyId,
      publicKey: b642ab(bundle.signedPreKey),
      signature: b642ab(bundle.signedPreKeySignature),
    },
    preKey: bundle.preKey
      ? { keyId: bundle.preKey.keyId, publicKey: b642ab(bundle.preKey.publicKey) }
      : undefined,
  })
}

function normaliseBody(body: unknown): string {
  // libsignal returns `body` as a binary string in some builds. Normalise to
  // base64 so the wire format is JSON-friendly.
  if (typeof body === 'string') {
    let s = ''
    for (let i = 0; i < body.length; i++) s += String.fromCharCode(body.charCodeAt(i) & 0xff)
    return btoa(s)
  }
  if (body instanceof ArrayBuffer) return ab2b64(body)
  throw new Error('libsignal returned empty ciphertext')
}

async function encryptOneRecipient(
  userId: string,
  deviceId: number,
  plaintext: string,
): Promise<Recipient> {
  return withSessionLock(`${userId}:${deviceId}`, async () => {
    await ensureSessionFromBundle(userId, deviceId)
    const cipher = new SessionCipher(signalStore, addressFor(userId, deviceId))
    const ct = await cipher.encrypt(utf82ab(plaintext))
    return {
      uid: userId,
      did: deviceId,
      t: ct.type as 1 | 3,
      r: ct.registrationId ?? 0,
      b: normaliseBody(ct.body),
    }
  })
}

/**
 * Encrypt `plaintext` for every device of `peerId` plus every *other* device
 * of `myId` (so my own siblings see the message).
 *
 * If neither side has registered any devices yet (e.g. a brand-new account
 * whose bundle hasn't reached the server) the call falls back to the legacy
 * single-device format keyed at deviceId=1 — keeps interop with old clients.
 */
export async function encryptForUser(
  myId: string,
  peerId: string,
  plaintext: string,
): Promise<string> {
  const myDeviceId = await localDeviceId()
  const [peerDevices, myDevices] = await Promise.all([
    listDevicesSafe(peerId),
    listDevicesSafe(myId),
  ])

  const targets: { uid: string; did: number }[] = []
  for (const d of peerDevices) targets.push({ uid: peerId, did: d })
  for (const d of myDevices) {
    if (d !== myDeviceId) targets.push({ uid: myId, did: d })
  }

  if (targets.length === 0) {
    // No devices known yet — try the legacy DEVICE_ID = 1 endpoint as a last
    // resort. This handles peers running the pre-multi-device build.
    targets.push({ uid: peerId, did: LEGACY_DEVICE_ID })
  }

  const recipients = await Promise.all(
    targets.map(({ uid, did }) => encryptOneRecipient(uid, did, plaintext)),
  )
  const env: MultiEnvelope = { v: 2, s: myDeviceId, rcpts: recipients }
  return ENVELOPE_PREFIX_MULTI + btoa(JSON.stringify(env))
}

async function listDevicesSafe(userId: string): Promise<number[]> {
  try {
    const r = await api.listUserDevices(userId)
    return r.devices.map((d) => d.deviceId)
  } catch {
    return []
  }
}

/**
 * Decrypt an incoming envelope addressed to (myId, current device). Throws if
 * the envelope is malformed or doesn't carry an entry for this device.
 */
export async function decryptFromUser(
  myId: string,
  senderId: string,
  text: string,
): Promise<string> {
  const myDeviceId = await localDeviceId()

  const multi = decodeMulti(text)
  if (multi) {
    const entry = multi.rcpts.find(
      (r) => r.uid === myId && r.did === myDeviceId,
    )
    if (!entry) {
      // Some peer's old build sent only to deviceId=1 (the legacy bundle).
      // Try that fallback before giving up.
      const fallback = multi.rcpts.find(
        (r) => r.uid === myId && r.did === LEGACY_DEVICE_ID,
      )
      if (!fallback) throw new Error('no_entry_for_device')
      return runDecrypt(senderId, multi.s, fallback)
    }
    return runDecrypt(senderId, multi.s, entry)
  }

  const legacy = decodeLegacy(text)
  if (legacy) {
    return runDecrypt(senderId, LEGACY_DEVICE_ID, {
      uid: myId,
      did: LEGACY_DEVICE_ID,
      t: legacy.t,
      r: legacy.r,
      b: legacy.b,
    })
  }
  throw new Error('not_encrypted')
}

function runDecrypt(
  senderId: string,
  senderDeviceId: number,
  entry: Recipient,
): Promise<string> {
  return withSessionLock(`${senderId}:${senderDeviceId}`, async () => {
    const cipher = new SessionCipher(signalStore, addressFor(senderId, senderDeviceId))
    const body = b642ab(entry.b)
    const plain =
      entry.t === 3
        ? await cipher.decryptPreKeyWhisperMessage(body)
        : await cipher.decryptWhisperMessage(body)
    return ab2utf8(plain)
  })
}

/**
 * Best-effort decryption: returns the original text untouched if it isn't a
 * Signal envelope, decrypts it otherwise. Errors fall back to a placeholder so
 * the UI still renders something rather than throwing.
 */
export async function maybeDecrypt(
  myId: string,
  senderId: string,
  text: string,
): Promise<string> {
  if (!isEncryptedEnvelope(text)) return text
  try {
    return await decryptFromUser(myId, senderId, text)
  } catch (err) {
    console.warn('decrypt failed', err)
    return ''
  }
}
