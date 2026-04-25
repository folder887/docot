/**
 * Identity bootstrap and key-bundle management.
 *
 * On first login (or when local IDB is empty) we generate:
 *   - one identity key pair (long-lived, persistent)
 *   - one signed prekey (rotated periodically, but for now we keep a single one)
 *   - 100 one-time prekeys
 *
 * Public halves are uploaded to the backend via `POST /keys/bundle`. The OTP
 * pool is replenished automatically when the server reports < 20 remaining.
 */

import { KeyHelper } from '@privacyresearch/libsignal-protocol-typescript'
import type {
  PreKeyPairType,
  SignedPreKeyPairType,
} from '@privacyresearch/libsignal-protocol-typescript'

import { api } from '../api'
import { ab2b64 } from './encoding'
import { signalStore } from './store'

const SIGNED_PRE_KEY_ID = 1
const INITIAL_OTP_COUNT = 100
const OTP_REFILL_THRESHOLD = 20
const OTP_REFILL_BATCH = 80

function nextPreKeyId(): number {
  // 31-bit positive integer; the libsignal protocol expects uint32 IDs.
  return 1 + Math.floor(Math.random() * 0x7fff_ffff)
}

async function generateOneTime(count: number): Promise<PreKeyPairType[]> {
  const out: PreKeyPairType[] = []
  for (let i = 0; i < count; i++) {
    const kid = nextPreKeyId()
    const kp = await KeyHelper.generatePreKey(kid)
    await signalStore.storePreKey(kid, kp.keyPair)
    out.push(kp)
  }
  return out
}

/** Produce serialised public halves of one-time prekeys for upload. */
function publicOneTime(otps: PreKeyPairType[]): { keyId: number; publicKey: string }[] {
  return otps.map((k) => ({ keyId: k.keyId, publicKey: ab2b64(k.keyPair.pubKey) }))
}

/** Produce serialised signed prekey bundle parts. */
function publicSigned(spk: SignedPreKeyPairType): {
  signedPreKeyId: number
  signedPreKey: string
  signedPreKeySignature: string
} {
  return {
    signedPreKeyId: spk.keyId,
    signedPreKey: ab2b64(spk.keyPair.pubKey),
    signedPreKeySignature: ab2b64(spk.signature),
  }
}

/**
 * Ensure the local device has an identity, signed prekey and OTP pool, and
 * that the backend has up-to-date public bundles. Idempotent and cheap to call
 * after login.
 */
export async function ensureIdentity(): Promise<void> {
  let kp = await signalStore.getIdentityKeyPair()
  let regId = await signalStore.getLocalRegistrationId()

  if (!kp || !regId) {
    kp = await KeyHelper.generateIdentityKeyPair()
    regId = KeyHelper.generateRegistrationId()
    await signalStore.setIdentity(kp, regId)
  }

  // Re-create signed prekey if missing locally.
  let spk = await signalStore.loadSignedPreKey(SIGNED_PRE_KEY_ID)
  let signature: ArrayBuffer | null = null
  let needsServerUpload = false
  if (!spk) {
    const fresh = await KeyHelper.generateSignedPreKey(kp, SIGNED_PRE_KEY_ID)
    await signalStore.storeSignedPreKey(SIGNED_PRE_KEY_ID, fresh.keyPair)
    spk = fresh.keyPair
    signature = fresh.signature
    needsServerUpload = true
  }

  // Check server status; (re)upload bundle if missing or OTPs are running low.
  let status: { hasBundle: boolean; oneTimeRemaining: number }
  try {
    status = await api.keysStatus()
  } catch {
    return // network blip — try again later
  }

  if (!status.hasBundle || needsServerUpload) {
    if (!signature) {
      // No fresh signature available (signed prekey came from IDB) — re-sign.
      const re = await KeyHelper.generateSignedPreKey(kp, SIGNED_PRE_KEY_ID)
      await signalStore.storeSignedPreKey(SIGNED_PRE_KEY_ID, re.keyPair)
      spk = re.keyPair
      signature = re.signature
    }
    const otps = await generateOneTime(INITIAL_OTP_COUNT)
    await api.uploadBundle({
      registrationId: regId,
      identityKey: ab2b64(kp.pubKey),
      signedPreKeyId: SIGNED_PRE_KEY_ID,
      signedPreKey: ab2b64(spk.pubKey),
      signedPreKeySignature: ab2b64(signature),
      oneTimePreKeys: publicOneTime(otps),
    })
    return
  }

  if (status.oneTimeRemaining < OTP_REFILL_THRESHOLD) {
    const otps = await generateOneTime(OTP_REFILL_BATCH)
    await api.replenishOneTime({ keys: publicOneTime(otps) })
  }
}

export const _signedTest = publicSigned // keeps the helper exported for tests
