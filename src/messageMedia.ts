import { uploadUrl } from './api'

/**
 * Messages can carry plain text or a media descriptor encoded as JSON.
 * Format: a single line of JSON starting with `{"kind":"...","u":"<path>",...}`.
 * Backwards compatible — anything that fails to parse is rendered as text.
 */

export type MediaKind = 'voice' | 'image' | 'video' | 'file'

export type MediaDescriptor = {
  kind: MediaKind
  /** server path returned from /uploads */
  u: string
  /** mime type */
  t?: string
  /** original filename */
  n?: string
  /** size in bytes */
  s?: number
  /** duration seconds (voice / video) */
  d?: number
  /** optional caption (image / file) */
  c?: string
}

export function encodeMedia(m: MediaDescriptor): string {
  return JSON.stringify(m)
}

export function decodeMedia(text: string): MediaDescriptor | null {
  if (!text) return null
  if (text.charCodeAt(0) !== 123 /* { */) return null
  try {
    const parsed = JSON.parse(text) as Partial<MediaDescriptor>
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.kind === 'string' &&
      typeof parsed.u === 'string' &&
      ['voice', 'image', 'video', 'file'].includes(parsed.kind)
    ) {
      return parsed as MediaDescriptor
    }
  } catch {
    /* fallthrough — treat as text */
  }
  return null
}

export function mediaUrl(m: MediaDescriptor): string {
  return uploadUrl(m.u)
}
