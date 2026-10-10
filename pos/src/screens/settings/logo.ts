// The store logo: a picked image file becomes a small PNG data URL (max 256px on the long side).

/** The size an image gets when its long side is capped at `max` (never upscaled). */
export function fitSize(w: number, h: number, max: number): { w: number; h: number } {
  if (w <= 0 || h <= 0) return { w: 1, h: 1 }
  const scale = Math.min(1, max / Math.max(w, h))
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) }
}

export function resizeImageFile(file: File, max = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const { w, h } = fitSize(img.naturalWidth || img.width, img.naturalHeight || img.height, max)
        const c = document.createElement('canvas')
        c.width = w; c.height = h
        const ctx = c.getContext('2d')
        if (!ctx) throw new Error('canvas')
        ctx.drawImage(img, 0, 0, w, h)
        resolve(c.toDataURL('image/png'))
      } catch (e) { reject(e) } finally { URL.revokeObjectURL(url) }
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')) }
    img.src = url
  })
}
