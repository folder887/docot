/**
 * `SignalProtocolStore` — implementation of `StorageType` from
 * `@privacyresearch/libsignal-protocol-typescript`, backed by IndexedDB.
 *
 * Private keys never leave the browser. They are persisted in the local IDB
 * `docot-e2e` database. Resetting (logout) clears all stores.
 */

import type {
  Direction,
  KeyPairType,
  StorageType,
} from '@privacyresearch/libsignal-protocol-typescript'

import { ab2b64, abEqual, b642ab } from './encoding'
import { idbDelete, idbGet, idbPut, STORES } from './idb'

type SerializedKeyPair = { pub: string; priv: string }

function serKeyPair(kp: KeyPairType): SerializedKeyPair {
  return { pub: ab2b64(kp.pubKey), priv: ab2b64(kp.privKey) }
}

function deKeyPair(s: SerializedKeyPair | undefined): KeyPairType | undefined {
  if (!s) return undefined
  return { pubKey: b642ab(s.pub), privKey: b642ab(s.priv) }
}

const META = {
  identity: 'identityKeyPair',
  registrationId: 'registrationId',
  deviceId: 'deviceId',
} as const

export class SignalProtocolStore implements StorageType {
  Direction!: typeof Direction

  // ---------- bootstrap helpers ----------

  async setIdentity(kp: KeyPairType, registrationId: number): Promise<void> {
    await idbPut(STORES.meta, META.identity, serKeyPair(kp))
    await idbPut(STORES.meta, META.registrationId, registrationId)
  }

  /**
   * Each browser/app install gets its own deviceId so multiple devices for the
   * same user can coexist. Generated lazily and pinned in IDB.
   */
  async getOrCreateDeviceId(): Promise<number> {
    const existing = await idbGet<number>(STORES.meta, META.deviceId)
    if (typeof existing === 'number' && existing > 0) return existing
    // 1 is reserved for legacy single-device clients (the initial public release
    // shipped with DEVICE_ID = 1 hard-coded). New installs draw from
    // [2, 2^31 - 1].
    const id = 2 + Math.floor(Math.random() * (0x7fff_fffe - 1))
    await idbPut(STORES.meta, META.deviceId, id)
    return id
  }

  // ---------- StorageType interface ----------

  async getIdentityKeyPair(): Promise<KeyPairType | undefined> {
    const s = await idbGet<SerializedKeyPair>(STORES.meta, META.identity)
    return deKeyPair(s)
  }

  async getLocalRegistrationId(): Promise<number | undefined> {
    return idbGet<number>(STORES.meta, META.registrationId)
  }

  async isTrustedIdentity(
    identifier: string,
    identityKey: ArrayBuffer,
  ): Promise<boolean> {
    const stored = await idbGet<string>(STORES.identityKeys, identifier)
    if (!stored) return true // TOFU: trust on first use
    return abEqual(b642ab(stored), identityKey)
  }

  async saveIdentity(encodedAddress: string, publicKey: ArrayBuffer): Promise<boolean> {
    const stored = await idbGet<string>(STORES.identityKeys, encodedAddress)
    await idbPut(STORES.identityKeys, encodedAddress, ab2b64(publicKey))
    return !!stored && !abEqual(b642ab(stored), publicKey)
  }

  async loadPreKey(keyId: number | string): Promise<KeyPairType | undefined> {
    const s = await idbGet<SerializedKeyPair>(STORES.preKeys, String(keyId))
    return deKeyPair(s)
  }

  async storePreKey(keyId: number | string, keyPair: KeyPairType): Promise<void> {
    await idbPut(STORES.preKeys, String(keyId), serKeyPair(keyPair))
  }

  async removePreKey(keyId: number | string): Promise<void> {
    await idbDelete(STORES.preKeys, String(keyId))
  }

  async loadSignedPreKey(keyId: number | string): Promise<KeyPairType | undefined> {
    const s = await idbGet<SerializedKeyPair>(STORES.signedPreKeys, String(keyId))
    return deKeyPair(s)
  }

  async storeSignedPreKey(keyId: number | string, keyPair: KeyPairType): Promise<void> {
    await idbPut(STORES.signedPreKeys, String(keyId), serKeyPair(keyPair))
  }

  async removeSignedPreKey(keyId: number | string): Promise<void> {
    await idbDelete(STORES.signedPreKeys, String(keyId))
  }

  async loadSession(encodedAddress: string): Promise<string | undefined> {
    return idbGet<string>(STORES.sessions, encodedAddress)
  }

  async storeSession(encodedAddress: string, record: string): Promise<void> {
    await idbPut(STORES.sessions, encodedAddress, record)
  }
}

export const signalStore = new SignalProtocolStore()
