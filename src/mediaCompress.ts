/**
 * Client-side image compression. Browsers ship the canvas + Blob plumbing
 * we need; we don't pull in a dedicated library.
 *
 * - "fast": down-scale the longer edge to 1600 px (no upscale) and re-encode
 *   as JPEG q=0.78. Good visual quality at ~10× the size reduction.
 * - "original": passthrough, return the file as-is.
 *
 * Animated GIFs and SVGs are returned unchanged because canvas rasterisation
 * would lose semantics (animation, scalability).
 */

const MAX_DIM = 1600

const PASS_THROUGH_TYPES = new Set(['image/gif', 'image/svg+xml'])

export type CompressMode = 'fast' | 'original'

export async function maybeCompressImage(file: File, mode: CompressMode): Promise<File> {
  if (mode === 'original') return file
  if (!file.type.startsWith('image/')) return file
  if (PASS_THROUGH_TYPES.has(file.type)) return file
  try {
    const bitmap = await createImageBitmap(file)
    const longest = Math.max(bitmap.width, bitmap.height)
    const scale = longest > MAX_DIM ? MAX_DIM / longest : 1
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()
    const blob: Blob | null = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.78)
    })
    if (!blob || blob.size >= file.size) return file
    const renamed = file.name.replace(/\.[a-zA-Z0-9]+$/, '') + '.jpg'
    return new File([blob], renamed, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    return file
  }
}
