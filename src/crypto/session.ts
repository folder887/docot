/**
 * High-level helpers used by the rest of the app:
 *
 *   - `encryptForUser(userId, plaintext)` — establishes a Signal session if
 *     needed (X3DH from a freshly-fetched bundle), then encrypts via the
 *     Double Ratchet.
 *   - `decryptFromUser(userId, envelope)` — decrypts an incoming envelope.
 *
 * Messages are wrapped in a JSON envelope and base64-encoded with a
 * `__sig1:` marker. The marker is what other code uses to detect ciphertext.
 */

import {
  SessionBuilder,
  SessionCipher,
  SignalProtocolAddress,
} from '@privacyresearch/libsignal-protocol-typescript'

import { api } from '../api'
import { ab2b64, b642ab, ab2utf8, utf82ab } from './encoding'
import { signalStore } from './store'

const DEVICE_ID = 1
const ENVELOPE_PREFIX = '__sig1:'

type Envelope = {
  v: 1
  /** 1 = WhisperMessage, 3 = PreKeyWhisperMessage. */
  t: 1 | 3
  /** registrationId of the sender. */
  r: number
  /** base64 ciphertext body (libsignal `body`). */
  b: string
}

export function isEncryptedEnvelope(text: string): boolean {
  return typeof text === 'string' && text.startsWith(ENVELOPE_PREFIX)
}

export function encodeEnvelope(env: Envelope): string {
  return ENVELOPE_PREFIX + btoa(JSON.stringify(env))
}

export function decodeEnvelope(text: string): Envelope | null {
  if (!isEncryptedEnvelope(text)) return null
  try {
    const json = atob(text.slice(ENVELOPE_PREFIX.length))
    return JSON.parse(json) as Envelope
  } catch {
    return null
  }
}

function addressFor(userId: string): SignalProtocolAddress {
  return new SignalProtocolAddress(userId, DEVICE_ID)
}

async function ensureSession(userId: string): Promise<void> {
  const address = addressFor(userId)
  const existing = await signalStore.loadSession(address.toString())
  if (existing) return

  const bundle = await api.getKeyBundle(userId)
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

export async function encryptForUser(userId: string, plaintext: string): Promise<string> {
  await ensureSession(userId)
  const cipher = new SessionCipher(signalStore, addressFor(userId))
  const ct = await cipher.encrypt(utf82ab(plaintext))
  // libsignal returns `body` as a binary string in some builds. Normalise to
  // base64 so the wire format is JSON-friendly.
  let bodyB64: string
  const body: unknown = ct.body
  if (typeof body === 'string') {
    let s = ''
    for (let i = 0; i < body.length; i++) {
      s += String.fromCharCode(body.charCodeAt(i) & 0xff)
    }
    bodyB64 = btoa(s)
  } else if (body instanceof ArrayBuffer) {
    bodyB64 = ab2b64(body)
  } else {
    throw new Error('libsignal returned empty ciphertext')
  }
  return encodeEnvelope({
    v: 1,
    t: ct.type as 1 | 3,
    r: ct.registrationId ?? 0,
    b: bodyB64,
  })
}

export async function decryptFromUser(userId: string, text: string): Promise<string> {
  const env = decodeEnvelope(text)
  if (!env) throw new Error('not_encrypted')
  const cipher = new SessionCipher(signalStore, addressFor(userId))
  const body = b642ab(env.b)
  const plain = env.t === 3
    ? await cipher.decryptPreKeyWhisperMessage(body)
    : await cipher.decryptWhisperMessage(body)
  return ab2utf8(plain)
}

/**
 * Best-effort decryption: returns the original text untouched if it isn't a
 * Signal envelope, decrypts it otherwise. Errors fall back to a placeholder so
 * the UI still renders something rather than throwing.
 */
export async function maybeDecrypt(senderId: string, text: string): Promise<string> {
  if (!isEncryptedEnvelope(text)) return text
  try {
    return await decryptFromUser(senderId, text)
  } catch (err) {
    console.warn('decrypt failed', err)
    return ''
  }
}
