/** Reads a picked image and returns a small JPEG data URL (longest side `max` px) for product cards. */
export function resizeImageFile(file: File, max = 256, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const scale = Math.min(1, max / Math.max(img.naturalWidth || 1, img.naturalHeight || 1))
        const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale))
        const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('canvas')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', quality))
      } catch (e) { reject(e) } finally { URL.revokeObjectURL(url) }
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')) }
    img.src = url
  })
}
