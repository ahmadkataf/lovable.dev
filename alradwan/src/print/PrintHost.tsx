import { useEffect, useState } from 'react'
import { create } from 'zustand'
import type { Sale } from '../db/types'
import { printPage } from '../lib/platform'
import { InvoicePrint } from './InvoicePrint'
import { StatementPrint, type StatementDoc } from './StatementPrint'

// One hidden area at the end of the page holds whatever is being printed; the print stylesheet
// hides the app and shows only it.
export type PrintDoc = { type: 'invoice'; sale: Sale } | ({ type: 'statement' } & StatementDoc)

const usePrint = create<{ doc: PrintDoc | null; preview: boolean }>(() => ({ doc: null, preview: false }))

export function printDocument(doc: PrintDoc) {
  usePrint.setState({ doc, preview: false })
  // give React a moment to render the document before the print dialog opens
  setTimeout(printPage, 150)
}

export function previewDocument(doc: PrintDoc | null) { usePrint.setState({ doc, preview: !!doc }) }

export function PrintHost() {
  const { doc, preview } = usePrint()
  const [, force] = useState(0)
  useEffect(() => {
    const after = () => { if (!usePrint.getState().preview) usePrint.setState({ doc: null }); force(x => x + 1) }
    window.addEventListener('afterprint', after)
    // a preview opened from the settings goes away when the user moves to another screen
    const onNav = () => { if (usePrint.getState().preview) usePrint.setState({ doc: null, preview: false }) }
    window.addEventListener('hashchange', onNav)
    return () => { window.removeEventListener('afterprint', after); window.removeEventListener('hashchange', onNav) }
  }, [])
  if (!doc) return null
  return (
    <div className={`print-area ${preview ? 'preview' : ''}`} id="print-area">
      {doc.type === 'invoice' && <InvoicePrint sale={doc.sale} />}
      {doc.type === 'statement' && <StatementPrint {...doc} />}
    </div>
  )
}
