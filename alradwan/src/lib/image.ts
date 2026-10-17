/** A picture made small enough to keep inside a product record (and to sync): at most 320 px, JPEG. */
export async function shrinkImage(blob: Blob, max = 320): Promise<string> {
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image(); img.src = url
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej })
    const k = Math.min(1, max / Math.max(img.width, img.height))
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k))
    const ctx = c.getContext('2d')!
    // transparent PNGs get a white background instead of black
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.8)
  } finally { URL.revokeObjectURL(url) }
}
