import type { Chat, User } from '../types'

/** Export a chat to a JSON file the user can keep / migrate elsewhere.
 *
 * The export is plaintext from the client's point of view — already-decrypted
 * messages, names, timestamps. Sealed/E2E ciphertext that the client could not
 * decrypt is exported as-is so the user can still archive it. */
export function exportChatAsJSON(chat: Chat, users: Record<string, User>): void {
  const data = {
    schema: 'docot-chat-export/1',
    exportedAt: new Date().toISOString(),
    chat: {
      id: chat.id,
      title: chat.title,
      kind: chat.kind,
      description: chat.description ?? '',
      participants: chat.participants.map((id) => ({
        id,
        name: users[id]?.name ?? '',
        handle: users[id]?.handle ?? '',
      })),
    },
    messages: chat.messages.map((m) => ({
      id: m.id,
      authorId: m.authorId,
      authorName: users[m.authorId]?.name ?? '',
      text: m.text,
      at: m.at,
      atIso: new Date(m.at).toISOString(),
      editedAt: m.editedAt ?? null,
      deletedAt: m.deletedAt ?? null,
      replyToId: m.replyToId ?? null,
      sealed: !!m.sealed,
      pinned: !!m.pinned,
      reactions: m.reactions ?? [],
    })),
  }
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const safe = chat.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'chat'
  const stamp = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `docot-${safe}-${stamp}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Free the object URL on next tick so the click has time to dispatch.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
