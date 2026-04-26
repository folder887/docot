export type ToastItem = { id: number; text: string; kind: 'info' | 'error' }

let nextId = 1
const listeners = new Set<(t: ToastItem) => void>()

export function showToast(text: string, kind: ToastItem['kind'] = 'info') {
  const item: ToastItem = { id: nextId++, text, kind }
  for (const fn of listeners) fn(item)
}

export function subscribe(fn: (t: ToastItem) => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
