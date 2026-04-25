/** Local cache of plaintext we sent.
 *
 * The Signal protocol is asymmetric — we can decrypt messages from peers but
 * not our own outgoing ciphertext. To restore plaintext after a reload, we
 * persist a local copy keyed by message id when the server confirms the send.
 */

import { idbGet, idbPut, STORES } from './idb'

export async function rememberOutgoing(messageId: string, plaintext: string): Promise<void> {
  await idbPut(STORES.outgoing, messageId, plaintext)
}

export async function recallOutgoing(messageId: string): Promise<string | undefined> {
  return idbGet<string>(STORES.outgoing, messageId)
}
