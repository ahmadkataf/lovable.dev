// What a file really is, from its first bytes, never from its name or a declared MIME type. Patient files are
// pictures and PDFs; anything else (an HTML page renamed to .pdf, an SVG with script) is kept as plain bytes
// (application/octet-stream), which no viewer runs.

/** The patient-file types the app shows, by their magic bytes. */
export const SAFE_FILE_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff', 'image/heic', 'image/heif', 'image/avif', 'application/pdf',
] as const
export type SafeFileType = typeof SAFE_FILE_TYPES[number]
export const UNKNOWN_FILE_TYPE = 'application/octet-stream'

/** How many leading bytes sniffMime() needs (a PDF header may sit after some junk in the first kilobyte). */
export const SNIFF_BYTES = 1024

const ascii = (b: Uint8Array, at: number, s: string) => {
  if (b.length < at + s.length) return false
  for (let i = 0; i < s.length; i++) if (b[at + i] !== s.charCodeAt(i)) return false
  return true
}

/** The type the bytes prove, or null when they are none of SAFE_FILE_TYPES. */
export function sniffMime(head: Uint8Array): SafeFileType | null {
  const b = head
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 'PNG') && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png'
  if (ascii(b, 0, 'GIF87a') || ascii(b, 0, 'GIF89a')) return 'image/gif'
  if (ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP')) return 'image/webp'
  if (ascii(b, 0, 'BM') && b.length >= 14) return 'image/bmp'
  if ((ascii(b, 0, 'II') && b[2] === 0x2a && b[3] === 0) || (ascii(b, 0, 'MM') && b[2] === 0 && b[3] === 0x2a)) return 'image/tiff'
  if (ascii(b, 4, 'ftyp')) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11])
    if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis'].includes(brand)) return 'image/heic'
    if (['mif1', 'msf1'].includes(brand)) return 'image/heif'
    if (['avif', 'avis'].includes(brand)) return 'image/avif'
  }
  // %PDF- within the first kilobyte (readers accept a little junk before it)
  const limit = Math.min(b.length - 5, SNIFF_BYTES - 5)
  for (let i = 0; i <= limit; i++) if (b[i] === 0x25 && ascii(b, i, '%PDF-')) return 'application/pdf'
  return null
}

/** The type a stored patient file gets: the proven type, or plain bytes. */
export function safeFileType(head: Uint8Array): string {
  return sniffMime(head) ?? UNKNOWN_FILE_TYPE
}
