// New / edit customer sheet. Reusable: the sales screen can open it to add a customer mid-sale.
// A non-zero opening balance becomes the first ledger entry (type 'adjust'), so the statement adds up from day one.
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db'
import type { Customer, CustomerTier } from '../../db/types'
import { useT } from '../../i18n'
import { Button, Field, Input, Modal, NumberInput, Seg, Textarea } from '../../components/ui'
import { applyLedger } from '../../lib/ledger'
import { uid } from '../../lib/ids'
import { round } from '../../lib/money'
import { phoneDigits } from '../../lib/customers'
import { toast, useSettings, useUser } from '../../state/store'
import './i18n'

export interface CustomerFormProps {
  open: boolean
  onClose: () => void
  onSaved?: (customer: Customer) => void
  /** Edit this customer; omit to create one. */
  customer?: Customer
  /** Pre-fills the name (or the phone when it looks like a number) of a new customer. */
  initial?: string
}

export function CustomerForm({ open, onClose, onSaved, customer, initial }: CustomerFormProps) {
  const t = useT()
  const user = useUser()
  const settings = useSettings()
  const d = settings.currency.decimals
  const editing = !!customer
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [tier, setTier] = useState<CustomerTier>('retail')
  const [openingKind, setOpeningKind] = useState<'owes' | 'has'>('owes')
  const [opening, setOpening] = useState<number | ''>('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    const looksLikePhone = !!initial && /^\+?[\d\s\-()٠-٩]{5,}$/.test(initial.trim())
    setName(customer?.name ?? (initial && !looksLikePhone ? initial.trim() : ''))
    setPhone(customer?.phone ?? (looksLikePhone ? initial!.trim() : ''))
    setAddress(customer?.address ?? '')
    setNotes(customer?.notes ?? '')
    setTier(customer?.tier === 'wholesale' ? 'wholesale' : 'retail')
    setOpeningKind('owes'); setOpening(''); setErr(null); setBusy(false)
    // keyed on the id: the live customer object changes identity on every balance change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer?.id, initial])

  const digits = phoneDigits(phone)
  const dup = useLiveQuery(async () => {
    if (digits.length < 5) return undefined
    return db.customers.filter(c => c.id !== customer?.id && phoneDigits(c.phone) === digits).first()
  }, [digits, customer?.id])

  const save = async () => {
    if (busy || !user) return
    const nm = name.trim()
    if (!nm) { setErr(t('customers.form.errName')); return }
    setBusy(true)
    try {
      const now = Date.now()
      const fields = { name: nm, phone: phone.trim() || undefined, address: address.trim() || undefined, notes: notes.trim() || undefined, tier: tier === 'wholesale' ? ('wholesale' as const) : undefined }
      let saved: Customer
      if (customer) {
        await db.customers.update(customer.id, { ...fields, updatedAt: now })
        saved = { ...customer, ...fields, updatedAt: now }
      } else {
        const c: Customer = { id: uid(), ...fields, balance: 0, createdAt: now, updatedAt: now }
        const amount = round(opening === '' ? 0 : Math.abs(opening) * (openingKind === 'has' ? -1 : 1), d)
        await db.transaction('rw', db.customers, db.ledger, async () => {
          await db.customers.add(c)
          if (amount !== 0) c.balance = await applyLedger({ customerId: c.id, type: 'adjust', amount, note: t('customers.openingBalance'), userId: user.id }, d, now)
        })
        saved = c
      }
      toast(editing ? t('common.saved') : t('customers.form.saved'), 'success')
      onSaved?.(saved)
      onClose()
    } catch { toast(t('common.error'), 'error'); setBusy(false) }
  }
  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') { e.preventDefault(); void save() } }

  return (
    <Modal open={open} onClose={onClose} title={editing ? t('customers.edit') : t('customers.add')} footer={
      <>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" loading={busy} disabled={!name.trim()} onClick={() => void save()}>{t('common.save')}</Button>
      </>
    }>
      <div className="cu-form" onKeyDown={onKey}>
        <Field label={t('customers.form.name')} error={err ?? undefined}>
          <Input value={name} onChange={e => { setName(e.target.value); setErr(null) }} autoFocus maxLength={80} autoComplete="off" />
        </Field>
        <Field label={`${t('customers.form.phone')} (${t('common.optional')})`} hint={dup ? <span className="cu-dup">{t('customers.form.dupPhone', { name: dup.name })}</span> : t('customers.form.phoneHint')}>
          <Input ltr value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" maxLength={30} autoComplete="off" />
        </Field>
        <Field label={`${t('customers.form.address')} (${t('common.optional')})`}>
          <Input value={address} onChange={e => setAddress(e.target.value)} maxLength={120} autoComplete="off" />
        </Field>
        <Field label={t('customers.form.tier')} hint={t('customers.form.tierHint')}>
          <Seg value={tier} onChange={setTier} options={[{ value: 'retail', label: t('customers.tier.retail') }, { value: 'wholesale', label: t('customers.tier.wholesale') }]} />
        </Field>
        <Field label={`${t('customers.form.notes')} (${t('common.optional')})`}>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={500} rows={2} style={{ minHeight: 64 }} />
        </Field>
        {!editing && (
          <Field label={t('customers.form.opening')} hint={t('customers.form.openingHint')}>
            <div className="cu-opening">
              <Seg value={openingKind} onChange={setOpeningKind} options={[{ value: 'owes', label: t('customers.form.owes') }, { value: 'has', label: t('customers.form.has') }]} />
              <NumberInput value={opening} onChange={n => setOpening(n)} decimals={d} placeholder="0" />
            </div>
          </Field>
        )}
      </div>
    </Modal>
  )
}
