// The centre's public facts in one place (site pages, header, footer, menu). Live values from GET /v1/settings win;
// these are the fallbacks while the settings load or when offline. The editable texts and brand links (WhatsApp
// number, map link, social links) come from the site content (./siteContent). Never add numbers or claims that are not true.
import type { PublicSettings } from '@shared/types'
import { useCached } from '../../lib/data'
import { brandWhatsapp, emailLink, optionalLink, useSite } from './siteContent'

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

export interface SiteContact {
  phone: string; tel: string; address: string; maps: string; instagram: string; insta: string
  whatsapp: string; email: string | null; facebook: string | null; tiktok: string | null; play: string | null
}

/**
 * The contact links of the header menu and the footer, from the shared site content (no extra request): the centre's
 * phone/address/Instagram from settings (today's values while they load), WhatsApp = brand.whatsapp || phone,
 * map = brand.maps_url || a Maps search, and the optional brand links (null = not shown).
 */
export function useSiteContact(): SiteContact {
  const { c, vars } = useSite()
  const phone = vars.phone || CENTRE.phone
  const address = vars.address || CENTRE.address
  const instagram = vars.instagram || CENTRE.instagram
  return {
    phone, tel: telHref(phone), address, maps: optionalLink(c.brand.maps_url) || mapsUrl(address),
    instagram, insta: instagramUrl(instagram), whatsapp: brandWhatsapp(c, vars).href,
    email: emailLink(c.brand.email), facebook: optionalLink(c.brand.facebook_url), tiktok: optionalLink(c.brand.tiktok_url), play: optionalLink(c.brand.play_url),
  }
}

/** Live centre info (settings) with the fallbacks above; WhatsApp and the map link follow the content's brand links. */
export function useCentre(): CentreInfo {
  const { data: s } = useCached<PublicSettings>('/v1/settings')
  const { c, vars } = useSite()
  const phone = s?.phone || CENTRE.phone
  const address = s?.address || CENTRE.address
  const instagram = (s?.instagram || CENTRE.instagram).replace(/^@/, '')
  return {
    name: s?.centre_name || CENTRE.name, address, phone, instagram,
    open: s?.open || CENTRE.open, close: s?.close || CENTRE.close,
    tel: telHref(phone), whatsapp: brandWhatsapp(c, vars).href, maps: optionalLink(c.brand.maps_url) || mapsUrl(address), insta: instagramUrl(instagram),
    settings: s,
  }
}
