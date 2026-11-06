// The announcement bar (content.announcement): a slim flat band above the site header on every customer page.
// info → light blue with a blue bell, success → light green with a green check, warning → neutral grey with an orange
// dot. Optional link; the visitor can hide it for the rest of the session (a new announcement shows again).
import { useState } from 'react'
import type { AnnouncementTone } from '@shared/content'
import { Icon } from '../../ui'
import { ContentText, SmartLink, hasText, useSite } from './siteContent'
import './chrome.css'

const KEY = 'fp_announce_hidden'
const TONES: readonly AnnouncementTone[] = ['info', 'success', 'warning']

/** A short fingerprint of the announcement, so hiding one does not hide the next. */
function fingerprint(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

function readHidden(): string | null {
  try { return sessionStorage.getItem(KEY) } catch { return null }
}

export function AnnouncementBar() {
  const { c, vars } = useSite()
  const a = c.announcement
  const [hidden, setHidden] = useState<string | null>(readHidden)
  const tone: AnnouncementTone = TONES.includes(a.tone) ? a.tone : 'info'
  const id = fingerprint(`${tone}|${a.text}|${a.link_label}|${a.link_url}`)
  if (!a.enabled || !hasText(a.text) || hidden === id) return null

  const hide = () => {
    setHidden(id)
    try { sessionStorage.setItem(KEY, id) } catch { /* private mode: hidden until the page reloads */ }
  }
  const link = hasText(a.link_label) && hasText(a.link_url) ? a.link_url : null
  return (
    <aside className={`announce is-${tone}`} aria-label="إعلان">
      <div className="container announce-inner">
        <span className="announce-ico" aria-hidden="true">
          {tone === 'warning' ? <span className="announce-dot" /> : <Icon name={tone === 'success' ? 'check' : 'bell'} size={18} />}
        </span>
        <p className="announce-text">
          <ContentText text={a.text} vars={vars} />
          {link && <> <SmartLink href={link} className="announce-link"><ContentText text={a.link_label} vars={vars} /></SmartLink></>}
        </p>
        <button type="button" className="announce-close" onClick={hide} aria-label="إخفاء الإعلان" title="إخفاء">
          <Icon name="x" size={18} />
        </button>
      </div>
    </aside>
  )
}
