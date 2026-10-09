// PLACEHOLDER — the scanner module replaces this file with the camera scanner (BarcodeDetector + ZXing fallback).
import { Modal, Input, Button } from './ui'
import { useState } from 'react'
import { useT } from '../i18n'

export interface ScannerModalProps {
  open: boolean
  onClose: () => void
  /** Called for every code read. Return false to keep scanning after a code, true (or nothing) to close. */
  onScan: (code: string) => boolean | void | Promise<boolean | void>
  /** Keep the camera open and read many codes in a row (the sales screen). */
  continuous?: boolean
  title?: string
}

export function ScannerModal({ open, onClose, onScan, title }: ScannerModalProps) {
  const t = useT()
  const [v, setV] = useState('')
  return (
    <Modal open={open} onClose={onClose} title={title ?? t('common.scan')} footer={<Button variant="primary" onClick={async () => { if (v) { const keep = await onScan(v); setV(''); if (keep !== false) onClose() } }}>{t('common.ok')}</Button>}>
      <Input ltr value={v} onChange={e => setV(e.target.value)} placeholder={t('common.barcode')} autoFocus />
    </Modal>
  )
}
