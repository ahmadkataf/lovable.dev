// The centre's public facts in one place (site pages, header, footer, menu). Live values from GET /v1/settings win;
// these are the fallbacks while the settings load or when offline. Never add numbers or claims that are not true.
import type { PublicSettings } from '@shared/types'
import { useCached } from '../../lib/data'

export const CENTRE = {
  name: 'فوكس بوينت',
  nameLatin: 'Focus Point',
  firstOfItsKind: 'المشروع الأول من نوعه بدرعا',
  slogan: 'مساحتك وركنك الهادئ للإبداع',
  address: 'درعا – شارع المجمع الحكومي – بناء العايش',
  open: '09:00',
  close: '23:00',
  phone: '0985258963',
  phoneIntl: '+963985258963',
  whatsapp: 'https://wa.me/963985258963',
  instagram: 'its_focus_point',
  url: 'https://focuspoint.raqeem.dev',
} as const

export const mapsUrl = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
export const instagramUrl = (handle: string) => `https://instagram.com/${handle.replace(/^@/, '')}`
/** "0985258963" → "+963985258963" for tel: links (keeps an already international number). */
export const telHref = (phone: string) => {
  const d = phone.replace(/[^\d+]/g, '')
  return `tel:${d.startsWith('+') ? d : d.startsWith('0') ? `+963${d.slice(1)}` : d}`
}
/** wa.me link for a Syrian number (falls back to the centre's WhatsApp). */
export const whatsappHref = (phone?: string | null) => {
  if (!phone) return CENTRE.whatsapp
  const d = phone.replace(/\D/g, '')
  return `https://wa.me/${d.startsWith('0') ? `963${d.slice(1)}` : d}`
}

export interface CentreInfo {
  name: string; address: string; phone: string; instagram: string; open: string; close: string
  tel: string; whatsapp: string; maps: string; insta: string
  settings: PublicSettings | undefined
}

/** Live centre info (settings) with the fallbacks above. */
export function useCentre(): CentreInfo {
  const { data: s } = useCached<PublicSettings>('/v1/settings')
  const phone = s?.phone || CENTRE.phone
  const address = s?.address || CENTRE.address
  const instagram = (s?.instagram || CENTRE.instagram).replace(/^@/, '')
  return {
    name: s?.centre_name || CENTRE.name, address, phone, instagram,
    open: s?.open || CENTRE.open, close: s?.close || CENTRE.close,
    tel: telHref(phone), whatsapp: whatsappHref(phone), maps: mapsUrl(address), insta: instagramUrl(instagram),
    settings: s,
  }
}
