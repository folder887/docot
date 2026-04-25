/**
 * Tiny IndexedDB wrapper used by the Signal protocol store.
 *
 * The DB has a few simple key/value stores (identity metadata, prekeys, signed
 * prekeys, sessions, peer identities). All values are JSON-serialisable: we
 * convert ArrayBuffer ↔ base64 at the SignalProtocolStore boundary.
 */

const DB_NAME = 'docot-e2e'
const DB_VERSION = 2

export const STORES = {
  meta: 'meta',
  identityKeys: 'identityKeys',
  preKeys: 'preKeys',
  signedPreKeys: 'signedPreKeys',
  sessions: 'sessions',
  /** plaintext of messages we sent ourselves; we cannot decrypt our own
   * outgoing ciphertext, so we keep a local copy keyed by message id. */
  outgoing: 'outgoing',
} as const

export type StoreName = (typeof STORES)[keyof typeof STORES]

let dbPromise: Promise<IDBDatabase> | null = null

export function openCryptoDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const name of Object.values(STORES)) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name)
        }
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

export async function idbGet<T>(store: StoreName, key: string): Promise<T | undefined> {
  const db = await openCryptoDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

export async function idbPut(store: StoreName, key: string, value: unknown): Promise<void> {
  const db = await openCryptoDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function idbDelete(store: StoreName, key: string): Promise<void> {
  const db = await openCryptoDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function idbClear(store: StoreName): Promise<void> {
  const db = await openCryptoDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function idbClearAll(): Promise<void> {
  for (const s of Object.values(STORES)) {
    await idbClear(s)
  }
}
