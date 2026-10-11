// The privacy policy, the terms of use and the open-source notices in one dialog, readable offline in Arabic and
// English. Opened from Settings → About and from the setup wizard (<LegalLinks/>).
import { useEffect, useState } from 'react'
import { FileText, Languages, Printer, Scale, ShieldCheck } from 'lucide-react'
import { useI18n, translate } from '@/i18n'
import type { Lang } from '@/db/types'
import { Badge, Button, Modal, Segmented, Skeleton } from '@/ui'
import { fmtDate } from '@/lib/dates'
import { openExternal, print } from '@/platform'
import { LegalText } from './LegalText'
import { LEGAL_DATE, LEGAL_DOCS, legalText, loadLegalDocs, type LegalDoc } from './lib'
import type { Notice } from './notices'
import './legal.css'

const ICON = { privacy: <ShieldCheck />, terms: <Scale />, notices: <FileText /> }

export interface LegalDialogProps {
  open: boolean
  onClose: () => void
  /** The document shown first (the others are one tap away). */
  doc?: LegalDoc
}
export function LegalDialog({ open, onClose, doc = 'privacy' }: LegalDialogProps) {
  if (!open) return null
  return <Dialog onClose={onClose} initial={doc} />
}

function Dialog({ onClose, initial }: { onClose: () => void; initial: LegalDoc }) {
  const { t, lang } = useI18n()
  const [doc, setDoc] = useState<LegalDoc>(initial)
  // the documents can be read in the other language too (a buyer abroad, a printed copy for the file)
  const [readLang, setReadLang] = useState<Lang>(lang)
  const other: Lang = readLang === 'ar' ? 'en' : 'ar'
  const tr = (k: string, p?: Record<string, string | number>) => translate(readLang, k, p)
  // the documents' text is loaded with the dialog, not with the app
  const [ready, setReady] = useState(false)
  useEffect(() => { let alive = true; void loadLegalDocs().then(() => { if (alive) setReady(true) }); return () => { alive = false } }, [])
  return (
    <Modal open onClose={onClose} size="lg" className="lg-modal" icon={ICON[doc]} title={t(`legal.${doc}`)}
      subtitle={doc !== 'notices' ? t('legal.updated', { date: fmtDate(LEGAL_DATE, lang, 'long') }) : t('legal.legalSub')}
      footer={<>
        {doc !== 'notices' && <Button variant="ghost" className="start" icon={<Languages />} onClick={() => setReadLang(other)} data-qa="legal-lang">{translate(readLang, 'legal.readIn')}</Button>}
        {doc !== 'notices' && <Button variant="secondary" icon={<Printer />} onClick={() => printLegal()} className="hide-mobile">{t('print')}</Button>}
        <Button variant="primary" onClick={onClose}>{t('close')}</Button>
      </>}>
      <div className="lg-switch no-print">
        <Segmented<LegalDoc> block value={doc} onChange={setDoc} options={LEGAL_DOCS.map(d => ({ value: d, label: t(`legal.tab.${d}`) }))} />
      </div>
      {doc === 'notices' ? <Notices /> : !ready ? <div className="col gap-3">{[0, 1, 2, 3].map(i => <Skeleton key={i} h={i ? 48 : 28} r={8} />)}</div> : (
        <article className="lg-sheet print-area" data-qa={`legal-${doc}`}>
          <h2 className="lg-title" lang={readLang} dir={readLang === 'ar' ? 'rtl' : 'ltr'}>{tr(`legal.${doc}`)}</h2>
          <div className="lg-date" lang={readLang} dir={readLang === 'ar' ? 'rtl' : 'ltr'}>{tr('legal.updated', { date: fmtDate(LEGAL_DATE, readLang, 'long') })}</div>
          <LegalText text={legalText(doc, readLang)} lang={readLang} />
        </article>
      )}
    </Modal>
  )
}

/** Prints the document shown in the dialog only (the rest of the app is hidden for the print). */
function printLegal() {
  const body = document.body
  body.classList.add('lg-printing')
  const done = () => { body.classList.remove('lg-printing'); window.removeEventListener('afterprint', done) }
  window.addEventListener('afterprint', done)
  print()
}

/** The open-source notices, loaded when this tab opens (the licence texts stay out of the start-up bundle). */
function Notices() {
  const { t } = useI18n()
  const [data, setData] = useState<{ notices: Notice[]; texts: string[] } | null>(null)
  const [openText, setOpenText] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    void import('./notices').then(m => { if (alive) setData({ notices: m.NOTICES, texts: m.LICENSE_TEXTS }) })
    return () => { alive = false }
  }, [])
  if (!data) return <div className="col gap-3">{[0, 1, 2, 3].map(i => <Skeleton key={i} h={64} r={12} />)}</div>
  const groups: [string, Notice[]][] = [
    ['software', data.notices.filter(n => n.kind !== 'font')],
    ['fonts', data.notices.filter(n => n.kind === 'font')],
  ]
  return (
    <div className="lg-notices" data-qa="legal-notices">
      <p className="lg-p">{t('legal.notices.intro')}</p>
      {groups.map(([key, list]) => (
        <section key={key} className="lg-group">
          <h3 className="lg-h">{t(`legal.notices.${key}`)} <Badge size="sm">{t('legal.notices.count', { n: list.length })}</Badge></h3>
          <ul className="lg-list">
            {list.map(n => {
              const id = `${n.name}@${n.version}`
              const shown = openText === id
              return (
                <li key={id} className="lg-item">
                  <div className="lg-item-head">
                    <span className="lg-name ltr">{n.name}</span>
                    <span className="lg-version ltr">{n.version}</span>
                    <Badge size="sm" tone="outline"><span className="ltr">{n.license}</span></Badge>
                  </div>
                  {n.copyright.map(c => <div key={c} className="lg-copy ltr">{c}</div>)}
                  <div className="lg-item-actions">
                    {n.url && <button type="button" className="lg-link ltr" onClick={() => openExternal(n.url)}>{n.url.replace(/^https?:\/\//, '')}</button>}
                    <button type="button" className="lg-link" onClick={() => setOpenText(shown ? null : id)} aria-expanded={shown}>{t(shown ? 'legal.notices.hideText' : 'legal.notices.showText')}</button>
                  </div>
                  {shown && (
                    <>
                      {n.notice && <><div className="lg-sub">{t('legal.notices.noticeFile')}</div><pre className="lg-pre">{n.notice}</pre></>}
                      <pre className="lg-pre">{data.texts[n.text]}</pre>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
