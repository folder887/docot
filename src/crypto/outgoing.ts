/** Local plaintext caches.
 *
 * The Signal protocol can only decrypt each ciphertext once — the ratchet
 * state advances after every successful decryption. We therefore persist:
 *
 *   - outgoing plaintext (we can never decrypt our own ciphertext at all)
 *   - incoming plaintext (so a page reload doesn't try to re-decrypt
 *     already-consumed ratchet messages)
 *
 * Both are keyed by message id and scoped per browser profile.
 */

import { idbGet, idbPut, STORES } from './idb'

export async function rememberOutgoing(messageId: string, plaintext: string): Promise<void> {
  await idbPut(STORES.outgoing, messageId, plaintext)
}

export async function recallOutgoing(messageId: string): Promise<string | undefined> {
  return idbGet<string>(STORES.outgoing, messageId)
}

export async function rememberIncoming(messageId: string, plaintext: string): Promise<void> {
  await idbPut(STORES.incoming, messageId, plaintext)
}

export async function recallIncoming(messageId: string): Promise<string | undefined> {
  return idbGet<string>(STORES.incoming, messageId)
}
