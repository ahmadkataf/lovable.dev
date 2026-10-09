import type { SiteSettings } from '@shared/types'

export const fmtNumber = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n)

export function fmtMoney(n: number, s: Pick<SiteSettings, 'currency'>) {
  return `${fmtNumber(n)} ${s.currency.symbol}`
}

export function fmtSecondary(n: number, s: Pick<SiteSettings, 'secondaryCurrency'>) {
  const sc = s.secondaryCurrency
  if (!sc.enabled || !sc.rate) return null
  return `≈ ${fmtNumber(Math.round(n * sc.rate))} ${sc.symbol}`
}

export const fmtDate = (t: number | string) => new Date(t).toLocaleDateString('ar-SY-u-nu-latn', { year: 'numeric', month: 'short', day: 'numeric' })
export const fmtDateTime = (t: number) => new Date(t).toLocaleString('ar-SY-u-nu-latn', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
export const today = () => new Date().toISOString().slice(0, 10)
export const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)

export function waLink(number: string, text: string) {
  const digits = number.replace(/\D/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

/** Shrinks an image file in the browser to a JPEG data URL small enough for the API. */
export function compressImage(file: File, maxSide = 1200, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      const keepPng = file.type === 'image/png' && file.size < 400_000
      resolve(keepPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('تعذّر قراءة الصورة')) }
    img.src = url
  })
}
