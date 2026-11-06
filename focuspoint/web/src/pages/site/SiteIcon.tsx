// Extra stroke icons for the marketing pages (24×24, same style as ui/Icon). Falls back to the shared ui icon set.
import type { SVGProps } from 'react'
import { Icon, type IconName } from '../../ui'

const EXTRA = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  quiet: '<path d="M11 5L6.5 9H3v6h3.5L11 19z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  // RTL "forward": points to the left
  arrow: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/>',
  map: '<path d="M9 4L3 6.5v13.5L9 17.5l6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
  book: '<path d="M4 19V5a2 2 0 0 1 2-2h14v14H6a2 2 0 0 0-2 2zm0 0a2 2 0 0 0 2 2h14v-4"/><path d="M9 7h7"/>',
  laptop: '<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 19.5h20"/>',
  present: '<rect x="3" y="3.5" width="18" height="11" rx="1.5"/><path d="M12 14.5V18M8 21l4-3 4 3"/><path d="M7 11l3-3 2 2 4-4"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z"/>',
  award: '<circle cx="12" cy="9" r="5.5"/><path d="M8.5 13.5L7 21l5-2.5 5 2.5-1.5-7.5"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="2.5"/><path d="M3 10h18M16 15h2"/><path d="M6 6l9-3 1 3"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.4 2.4M15.3 15.3l2.4 2.4M6.3 17.7l2.4-2.4M15.3 8.7l2.4-2.4"/>',
  zoom: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4M11 8v6M8 11h6"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  // optional brand links (footer, /contact) — shown only when the admin set them
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M4 7l8 6 8-6"/>',
  facebook: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12.5 21v-8.5a3 3 0 0 1 3-3h1.5M9.5 13.5h6"/>',
  tiktok: '<path d="M13.5 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M13.5 3c.4 2.6 2.3 4.5 5 4.8"/>',
  play: '<path d="M6.5 4.2v15.6a.8.8 0 0 0 1.2.7l12.5-7.8a.8.8 0 0 0 0-1.4L7.7 3.5a.8.8 0 0 0-1.2.7z"/>',
} as const

export type SiteIconName = IconName | keyof typeof EXTRA

export function SiteIcon({ name, size = 20, ...rest }: { name: SiteIconName; size?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  if (name in EXTRA) {
    return (
      <svg
        width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"
        {...rest}
        dangerouslySetInnerHTML={{ __html: EXTRA[name as keyof typeof EXTRA] }}
      />
    )
  }
  return <Icon name={name as IconName} size={size} {...rest} />
}
