// Bits every settings section uses: the draft/save pattern, the unsaved bar, the section frame and notes.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Check, Info, AlertTriangle, Save, Undo2 } from 'lucide-react'
import { Button, useIsMobile } from '../../components/ui'
import { useT } from '../../i18n'
import { toast } from '../../state/store'

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/**
 * A local copy of a slice of the settings. `dirty` when it differs from what was last saved; `save` runs the
 * caller's writer, then marks the draft as the new base. When the source changes elsewhere and we have no edits, follow it.
 */
export function useDraft<T>(source: T, write: (draft: T) => Promise<void>, validate?: (d: T) => string | null) {
  const [draft, setDraft] = useState<T>(source)
  const [base, setBase] = useState<T>(source)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dirty = !same(draft, base)
  const dirtyRef = useRef(dirty); dirtyRef.current = dirty
  const t = useT()

  useEffect(() => {
    if (!same(source, base) && !dirtyRef.current) { setDraft(source); setBase(source) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source])

  const patch = useCallback((p: Partial<T>) => { setDraft(d => ({ ...d, ...p })); setError(null) }, [])
  const reset = useCallback(() => { setDraft(base); setError(null) }, [base])
  const save = useCallback(async () => {
    const err = validate?.(draft) ?? null
    if (err) { setError(err); toast(err, 'error'); return false }
    setSaving(true)
    try {
      await write(draft)
      setBase(draft); setError(null)
      toast(t('settings.saved'), 'success')
      return true
    } catch {
      toast(t('settings.saveFailed'), 'error')
      return false
    } finally { setSaving(false) }
  }, [draft, write, validate, t])

  // Ctrl/Cmd+S saves on a keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (dirtyRef.current) void save() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save])

  return { draft, setDraft, patch, dirty, saving, error, save, reset }
}

export function SaveBar({ dirty, saving, onSave, onReset }: { dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void }) {
  const t = useT()
  if (!dirty) return null
  return (
    <div className="save-bar" role="status">
      <span className="msg truncate">{t('settings.unsaved')}</span>
      <Button variant="ghost" size="sm" icon={<Undo2 size={16} />} onClick={onReset} disabled={saving}>{t('settings.discard')}</Button>
      <Button variant="primary" size="sm" icon={<Save size={16} />} onClick={onSave} loading={saving}>{t('common.save')}</Button>
    </div>
  )
}

export function AutosaveHint() {
  const t = useT()
  return <span className="settings-autosave"><Check size={14} />{t('settings.autosave')}</span>
}

export function Note({ kind, children }: { kind?: 'info' | 'warn'; children: ReactNode }) {
  return <div className={`settings-note ${kind ?? ''}`}>{kind === 'warn' ? <AlertTriangle size={16} /> : <Info size={16} />}<span>{children}</span></div>
}

export function SectionCard({ title, icon, children, className = '' }: { title?: ReactNode; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card pad ${className}`}>
      {title && <h3 className="card-title">{icon}{title}</h3>}
      {children}
    </section>
  )
}

/** The page chrome of one section: title (+ a back button on phones) and the body. */
export function SectionFrame({ title, desc, actions, children }: { title: string; desc?: string; actions?: ReactNode; children: ReactNode }) {
  const mobile = useIsMobile()
  const nav = useNavigate()
  const t = useT()
  return (
    <>
      <div className="page-head">
        {mobile && <Button variant="ghost" iconOnly icon={<ArrowRight size={20} className="back-ico" />} aria-label={t('common.back')} onClick={() => nav('/settings')} />}
        <h1>{title}</h1>
        {actions && <div className="actions">{actions}</div>}
        {desc && <div className="settings-head-desc">{desc}</div>}
      </div>
      <div className="page-body settings-section">{children}</div>
    </>
  )
}
