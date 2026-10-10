// Building blocks shared by the settings tabs: the draft hook, the save bar, option cards, the type-to-confirm dialog.
import { useCallback, useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Check, CheckCircle2, Lock, Save } from 'lucide-react'
import { Alert, Button, Card, CardBody, Input, Modal, Skeleton } from '@/ui'
import { useI18n } from '@/i18n'
import { useSession } from '@/app/session'
import { useLicense } from '@/license/useLicense'
import { typedConfirm, type FieldError } from './lib'

/** Who may change what: admins edit clinic-wide settings, and nobody saves while the licence is read-only. */
export function useAccess() {
  const session = useSession()
  const { readOnly } = useLicense()
  const isAdmin = session.can('settings')
  const reason: 'admin' | 'readonly' | null = !isAdmin ? 'admin' : readOnly ? 'readonly' : null
  return { isAdmin, readOnly, canEdit: isAdmin && !readOnly, reason, userId: session.user?.id }
}

/**
 * A form draft seeded from a live record. `dirty` compares the draft with what the record would give now,
 * so saving (which updates the record) clears it by itself; `reset` throws the edits away.
 */
export function useDraft<S, D>(source: S | undefined, from: (s: S) => D) {
  const [draft, setDraft] = useState<D | null>(null)
  useEffect(() => { if (source !== undefined) setDraft(d => d ?? from(source)) }, [source]) // eslint-disable-line react-hooks/exhaustive-deps
  const base = source !== undefined ? from(source) : null
  const dirty = draft !== null && base !== null && JSON.stringify(draft) !== JSON.stringify(base)
  const reset = useCallback((next?: S) => { const s = next ?? source; if (s !== undefined) setDraft(from(s)) }, [source]) // eslint-disable-line react-hooks/exhaustive-deps
  const patch = useCallback((p: Partial<D>) => setDraft(d => (d ? { ...d, ...p } : d)), [])
  return { draft, setDraft, patch, dirty, reset }
}

/** t() for a validation message, undefined when there is none. */
export function useErrText() {
  const { t } = useI18n()
  return (e?: FieldError) => (e ? t(e.key, e.params) : undefined)
}

/** Sticky bar at the end of a form: unsaved state, discard and save. The save button submits the surrounding form. */
export function SaveBar({ dirty, saving, disabled, onDiscard }: { dirty: boolean; saving?: boolean; disabled?: boolean; onDiscard: () => void }) {
  const { t } = useI18n()
  return (
    <div className={`st-savebar${dirty ? ' dirty' : ''}`} data-qa="savebar">
      <div className="st-savebar-msg">
        {dirty ? <><span className="st-pulse" aria-hidden />{t('settings.unsaved')}</> : <><CheckCircle2 />{t('settings.allSaved')}</>}
      </div>
      <div className="st-savebar-actions">
        {dirty && <Button variant="ghost" onClick={onDiscard} disabled={saving}>{t('settings.discard')}</Button>}
        <Button type="submit" variant="primary" icon={<Save />} loading={saving} disabled={!dirty || disabled} data-qa="save">{t('saveChanges')}</Button>
      </div>
    </div>
  )
}

/** Why the controls of a tab are disabled (not an admin, or the licence is read-only). */
export function LockedNotice({ reason }: { reason: 'admin' | 'readonly' | null }) {
  const { t } = useI18n()
  if (!reason) return null
  return <Alert tone={reason === 'readonly' ? 'warning' : 'info'} icon={<Lock />}>{reason === 'readonly' ? t('settings.readOnlyNote') : t('settings.adminOnly')}</Alert>
}

/** A big selectable card (language, font, theme). */
export function OptionCard({ active, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <button type="button" role="radio" aria-checked={active} className={['st-option', active && 'active', className].filter(Boolean).join(' ')} {...rest}>
      {active && <span className="st-option-check" aria-hidden><Check /></span>}
      {children}
    </button>
  )
}

/** Card title row with an icon tile, used at the top of every section. */
export function SectionTitle({ icon, title, sub, tone, end }: { icon: ReactNode; title: ReactNode; sub?: ReactNode; tone?: 'danger' | 'warning' | 'success' | 'info'; end?: ReactNode }) {
  return (
    <div className="st-section-head">
      <span className={`st-section-icon${tone ? ` tone-${tone}` : ''}`}>{icon}</span>
      <div className="grow"><h2 className="st-section-title">{title}</h2>{sub && <div className="st-section-sub">{sub}</div>}</div>
      {end && <div className="st-section-end">{end}</div>}
    </div>
  )
}

export function TabSkeleton({ cards = 2 }: { cards?: number }) {
  return (
    <>
      {Array.from({ length: cards }, (_, i) => (
        <Card key={i}><CardBody className="col gap-4">
          <div className="row gap-3"><Skeleton w={40} h={40} r={12} /><div className="grow col gap-2"><Skeleton w="40%" h={16} /><Skeleton w="65%" h={12} /></div></div>
          <div className="form-grid"><Skeleton h={40} r={12} /><Skeleton h={40} r={12} /><Skeleton h={40} r={12} /><Skeleton h={40} r={12} /></div>
        </CardBody></Card>
      ))}
    </>
  )
}

/** A dangerous action confirmed by typing a word ("استبدال", "حذف"). */
export function TypeToConfirm({ open, onClose, title, subtitle, icon, word, confirmLabel, busy, onConfirm, footerStart, children }: {
  open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; icon?: ReactNode; word: string; confirmLabel: ReactNode
  busy?: boolean; onConfirm: () => void; footerStart?: ReactNode; children?: ReactNode
}) {
  const { t } = useI18n()
  const [text, setText] = useState('')
  useEffect(() => { if (open) setText('') }, [open])
  const ok = typedConfirm(text, word)
  const close = () => { if (!busy) onClose() }
  return (
    <Modal open={open} onClose={close} title={title} subtitle={subtitle} icon={icon} closeOnOverlay={!busy} className="st-danger-modal"
      footer={<>
        {footerStart && <div className="start">{footerStart}</div>}
        <Button variant="ghost" onClick={close} disabled={busy}>{t('cancel')}</Button>
        <Button variant="danger" onClick={onConfirm} disabled={!ok} loading={busy} data-qa="confirm-danger">{confirmLabel}</Button>
      </>}>
      <div className="col gap-4">
        {children}
        <form onSubmit={e => { e.preventDefault(); if (ok && !busy) onConfirm() }}>
          <Input label={<span>{t('settings.bk.typeToConfirm', { word })}</span>} value={text} onChange={e => setText(e.target.value)} autoComplete="off" spellCheck={false}
            placeholder={word} className="st-confirm-input" data-qa="confirm-word" />
        </form>
      </div>
    </Modal>
  )
}

/** Clipboard with a fallback for WebViews that block the async clipboard API. */
export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true } catch { /* fall back */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'
    document.body.appendChild(ta); ta.select()
    const ok = document.execCommand('copy'); ta.remove()
    return ok
  } catch { return false }
}
