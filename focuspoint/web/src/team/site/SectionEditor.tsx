// One section of the site, edited as a form generated from its SectionSpec (CONTENT_SECTIONS): field groups that
// fold, «حفظ» in a sticky bar (validated first with the same validateSection as the server; an error scrolls to its
// field), «تراجع عن آخر حفظ», «استعادة الأصل», «عرض في الموقع», an unsaved-changes guard, and a draft kept on the
// device so nothing typed is lost offline. Sections with identity settings also edit them here (one «حفظ» for both).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { DEFAULT_CONTENT, validateSection, type SectionSpec } from '@shared/content'
import { fmtDate, fmtTime, todayLocal, toLocalParts } from '../../format'
import { dropMemo } from '../../lib/data'
import { useOnline } from '../../offline'
import { SiteIcon } from '../../pages/site/SiteIcon'
import { Badge, Button, Icon, useToast } from '../../ui'
import { Confirm } from '../common'
import { store, useStore } from '../store'
import { cx } from '../util'
import { FieldEditor } from './FieldEditor'
import { EditorContext, type EditorCtx } from './fields'
import { useLeaveGuard } from './guard'
import { siteApi, type SectionResult } from './http'
import { SiteApiError, siteErrorText } from './media'
import { checkIdentity, cleanIdentity, IdentityCard, identityFrom, identityKeys, identityPatch, LinkedSettings, type IdentityDraft, type IdentityKey } from './SettingsFields'
import { siteState, useSiteState } from './state'
import { clone, deepEqual, getAt, locateError, repairDraft, setAt } from './value'
import { useEditorVars } from './vars'

/** "اليوم 10:32 م" / "الأحد 24 تشرين الأول 10:32 م" in the centre's time zone. */
export function whenLabel(iso: string): string {
  return toLocalParts(iso).date === todayLocal() ? `اليوم ${fmtTime(iso)}` : `${fmtDate(iso)} ${fmtTime(iso)}`
}

function scrollToPath(path: string) {
  window.setTimeout(() => {
    const el = document.querySelector(`[data-path="${CSS.escape(path)}"]`)
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    el.querySelector<HTMLElement>('input:not([type=file]):not([disabled]), textarea, select, button:not([disabled])')?.focus({ preventScroll: true })
  }, 120)
}

type Busy = null | 'save' | 'undo' | 'reset'
interface FieldError { owner: string; message: string; snapshot: string }

export function SectionEditor({ spec }: { spec: SectionSpec }) {
  const id = spec.id
  const toast = useToast()
  const st = useSiteState()
  const { view } = useStore()
  const browserOnline = useOnline()
  const [lost, setLost] = useState(false)          // a request failed for lack of network (navigator.onLine can lie)
  useEffect(() => { if (browserOnline) setLost(false) }, [browserOnline])
  const online = browserOnline && !lost

  const saved = (st.content ? st.content[id] : DEFAULT_CONTENT[id]) as unknown

  // ---- the draft (restored from the device when there is one) ----
  const stored = useRef(siteState.get().drafts[id])
  const [draft, setDraft] = useState<unknown>(() => (stored.current ? repairDraft(spec, stored.current.value, saved) : clone(saved)))
  const [restored, setRestored] = useState<string | null>(() => {
    const d = stored.current
    if (!d) return null
    return !deepEqual(repairDraft(spec, d.value, saved), saved) || Object.keys(d.settings ?? {}).length > 0 ? d.at : null
  })
  const prevSaved = useRef(saved)
  useEffect(() => {
    const prev = prevSaved.current
    prevSaved.current = saved
    if (prev !== saved) setDraft((cur: unknown) => (deepEqual(cur, prev) ? clone(saved) : cur))   // untouched → follow the server
  }, [saved])

  // ---- identity settings edited next to the content (brand section) ----
  const idKeys = useMemo<IdentityKey[]>(() => (view.settings ? identityKeys(spec.settings) : []), [spec.settings, view.settings])
  const otherSettings = (spec.settings ?? []).filter((k) => !(idKeys as string[]).includes(k) && !['centre_name', 'phone', 'address', 'instagram', 'open', 'close'].includes(k))
  const settingsSaved = useMemo(() => identityFrom(view.settings, idKeys), [view.settings, idKeys])
  const [sd, setSd] = useState<IdentityDraft>(() => ({ ...settingsSaved, ...(stored.current?.settings ?? {}) }))
  const [sErrors, setSErrors] = useState<Partial<Record<IdentityKey, string>>>({})
  const prevSettings = useRef(settingsSaved)
  useEffect(() => {
    const prev = prevSettings.current
    prevSettings.current = settingsSaved
    if (prev === settingsSaved) return
    // A sync brought new settings: keep only what the admin changed here, take the rest from the server.
    setSd((cur) => {
      const next: IdentityDraft = { ...settingsSaved }
      for (const k of Object.keys(cur) as IdentityKey[]) if (cur[k] !== undefined && cur[k] !== prev[k]) next[k] = cur[k]
      return next
    })
  }, [settingsSaved])

  const contentDirty = !deepEqual(draft, saved)
  const settingsDirty = idKeys.some((k) => (sd[k] ?? '') !== (settingsSaved[k] ?? ''))
  const dirty = contentDirty || settingsDirty

  // ---- keep the draft on the device (debounced; flushed when leaving / hiding the page) ----
  const latest = useRef({ draft, sd, dirty, settingsDirty })
  latest.current = { draft, sd, dirty, settingsDirty }
  const flush = useCallback(() => {
    const l = latest.current
    const has = !!siteState.get().drafts[id]
    if (l.dirty) void siteState.saveDraft(id, { value: l.draft, settings: l.settingsDirty ? l.sd : undefined, at: new Date().toISOString() })
    else if (has) void siteState.saveDraft(id, null)
  }, [id])
  useEffect(() => {
    const t = window.setTimeout(flush, 400)
    return () => window.clearTimeout(t)
  }, [draft, sd, dirty, flush])
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush() }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flush)
    return () => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', flush); flush() }
  }, [flush])

  // ---- groups, errors ----
  const [openGroups, setOpenGroups] = useState<Set<number>>(() => new Set(spec.groups.length <= 2 ? spec.groups.map((_, i) => i) : [0]))
  const toggleGroup = (i: number) => setOpenGroups((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n })
  const [error, setError] = useState<FieldError | null>(null)
  useEffect(() => {
    if (error && JSON.stringify(getAt(draft, error.owner) ?? null) !== error.snapshot) setError(null)   // edited → the message goes
  }, [draft, error])
  function showError(path: string, message: string) {
    const spot = locateError(spec, path)
    if (!spot) { toast.show(message, 'error'); return }
    setError({ owner: spot.owner, message, snapshot: JSON.stringify(getAt(draft, spot.owner) ?? null) })
    setOpenGroups((s) => new Set(s).add(spot.group))
    scrollToPath(spot.owner)
    toast.show(`راجع «${spot.label}»: ${message}`, 'error')
  }

  // ---- actions ----
  const [busy, setBusy] = useState<Busy>(null)
  const [confirm, setConfirm] = useState<null | 'undo' | 'reset' | 'discard'>(null)
  const [justSaved, setJustSaved] = useState<string | null>(null)
  // the last save changed the content (so it made an undo entry); a save of only the centre settings did not, and
  // «تراجع» there would revert an OLDER content change instead of the one just made
  const [undoable, setUndoable] = useState(false)
  const failed = (err: unknown) => {
    if (err instanceof SiteApiError && err.offline) setLost(true)
    toast.show(siteErrorText(err), 'error')
  }

  async function save() {
    if (busy) return
    const r = validateSection(id, draft)
    if (!r.ok) { showError(r.path, r.message); return }
    const se = idKeys.length ? checkIdentity(sd) : {}
    setSErrors(se)
    const firstBad = Object.keys(se)[0] as IdentityKey | undefined
    if (firstBad) { scrollToPath(`settings.${firstBad}`); toast.show(`راجع «بيانات المركز»: ${se[firstBad]}`, 'error'); return }
    if (!online) { toast.show('الحفظ بيحتاج إنترنت. تعديلاتك محفوظة على هالجهاز', 'error'); return }
    const patch = settingsDirty && view.settings ? identityPatch(sd, view.settings) : {}
    const contentChanged = !deepEqual(r.value, saved)
    if (!contentChanged && Object.keys(patch).length === 0) {
      setDraft(clone(saved)); setSd(settingsSaved)       // only spaces changed: nothing to send
      toast.show('ما في تغييرات', 'info')
      return
    }
    setBusy('save')
    setError(null)
    const sent = draft
    try {
      if (contentChanged) {
        const res = await siteApi.save(id, r.value)
        siteState.applyResult(id, res, 'save')
        setDraft((cur: unknown) => (cur === sent ? clone(res.value) : cur))
      } else {
        setDraft((cur: unknown) => (cur === sent ? clone(saved) : cur))
      }
      if (Object.keys(patch).length) {
        await store.patchSettings(patch, 'تعديل بيانات المركز (من الموقع)')
        dropMemo('/v1/settings')
        setSd((cur) => cleanIdentity(cur))
      }
      setRestored(null)
      setJustSaved(new Date().toISOString())
      setUndoable(contentChanged)
      toast.show('انحفظ — الموقع صار محدّث', 'ok')
    } catch (err) {
      if (err instanceof SiteApiError && err.message === 'invalid_content' && err.path !== null) showError(err.path, err.detail ?? 'قيمة غير صحيحة')
      else failed(err)
    } finally { setBusy(null) }
  }

  async function run(kind: 'undo' | 'reset') {
    setBusy(kind)
    try {
      const res: SectionResult = kind === 'undo' ? await siteApi.undo(id) : await siteApi.reset(id)
      siteState.applyResult(id, res, kind)
      setDraft(clone(res.value))
      setError(null)
      setRestored(null)
      setJustSaved(null)
      setUndoable(false)
      toast.show(kind === 'undo' ? 'رجع القسم متل ما كان قبل آخر حفظ' : 'رجع القسم متل الأصل', 'ok')
    } catch (err) { failed(err) } finally { setBusy(null); setConfirm(null) }
  }

  function discard() {
    setDraft(clone(saved))
    setSd(settingsSaved)
    setError(null)
    setSErrors({})
    setRestored(null)
    setConfirm(null)
    void siteState.saveDraft(id, null)
  }

  const guard = useLeaveGuard(dirty)

  // ---- editor context for the widgets ----
  const brand = useMemo(() => {
    const b = (id === 'brand' ? draft : st.content?.brand) as { slogan?: string; eyebrow?: string } | undefined
    return b ? { slogan: b.slogan, eyebrow: b.eyebrow } : null
  }, [id, draft, st.content])
  const vars = useEditorVars(brand)
  const ctx = useMemo<EditorCtx>(() => ({
    error: error ? { owner: error.owner, message: error.message } : null,
    vars,
    isChanged: (path, value) => !deepEqual(value, getAt(saved, path)),
  }), [error, vars, saved])

  const overridden = st.overridden.includes(id)
  const history = st.history[id]
  const lastSaved = justSaved ?? history?.[0]?.saved_at ?? null
  const canUndo = history ? history.length > 0 : overridden || undoable

  let status: string
  if (busy === 'save') status = 'عم نحفظ…'
  else if (!online) status = dirty ? 'دون اتصال — محفوظ عالجهاز' : 'دون اتصال'
  else if (dirty) status = 'في تعديلات ما انحفظت'
  else if (justSaved) status = `انحفظ ${fmtTime(justSaved)}`
  else status = 'كل شي محفوظ'

  return (
    <EditorContext.Provider value={ctx}>
      <div className="se-page">
        <Link to="/team/site" className="se-back"><Icon name="back" size={18} /> كل الأقسام</Link>
        <div className="se-head">
          <span className="se-head-icon"><SiteIcon name={spec.icon} size={24} /></span>
          <div className="grow">
            <div className="row gap-sm wrap">
              <h1 className="h1 se-title">{spec.title}</h1>
              {overridden ? <Badge tone="wine">معدّل</Badge> : <Badge tone="grey">الأصل</Badge>}
            </div>
            <p className="se-help">{spec.help}</p>
            {lastSaved && <p className="muted tiny">آخر تعديل: {whenLabel(lastSaved)}</p>}
          </div>
        </div>

        <div className="se-toolbar">
          {spec.preview && (
            <a className="btn btn-soft btn-sm" href={spec.preview} target="_blank" rel="noopener noreferrer"><Icon name="eye" size={16} /> عرض في الموقع</a>
          )}
          {canUndo && <Button variant="ghost" size="sm" disabled={!online || !!busy} onClick={() => setConfirm('undo')}><Icon name="undo" size={16} /> تراجع عن آخر حفظ</Button>}
          {overridden && <Button variant="ghost" size="sm" disabled={!online || !!busy} onClick={() => setConfirm('reset')}><Icon name="sync" size={16} /> استعادة الأصل</Button>}
        </div>
        {spec.preview && dirty && <p className="se-note">«عرض في الموقع» بيورجيك آخر نسخة محفوظة.</p>}

        {!online && (
          <div className="se-offline" role="status">
            <Icon name="cloudOff" size={18} />
            <div>
              <b>دون اتصال بالإنترنت.</b> تعديل الموقع بيحتاج إنترنت للحفظ. فيك تكمّل كتابة: كل شي بينحفظ على هالجهاز، واضغط «حفظ» لما يرجع الاتصال.
              {st.fromCache && <> هاي آخر نسخة من الموقع وصلت لهالجهاز.</>}
            </div>
            <Button size="sm" variant="soft" onClick={() => { setLost(false); void siteState.load() }}>جرّب كمان مرة</Button>
          </div>
        )}
        {restored && (
          <div className="alert alert-info se-restored" role="status">
            رجّعنا تعديلات ما انحفظت من {whenLabel(restored)}.
            <button type="button" className="linkish" onClick={() => setConfirm('discard')}>تجاهلها</button>
          </div>
        )}

        {idKeys.length > 0 && (
          <section className="card se-group is-open">
            <div className="se-group-head is-static"><span className="se-group-title">بيانات المركز</span>{settingsDirty && <span className="se-dot" />}</div>
            <div className="se-group-body">
              <p className="se-group-help">نفس بيانات الإعدادات › المركز. بتنحفظ مع «حفظ» تحت، وبتطلع بكل الموقع وصفحات الحجز.</p>
              <IdentityCard keys={idKeys} value={sd} saved={settingsSaved} onChange={setSd} errors={sErrors} />
            </div>
          </section>
        )}
        {spec.settings && spec.settings.length > 0 && !view.settings && (
          <div className="alert alert-info">بيانات المركز ما وصلت لهالجهاز بعد — بتطلع هون بعد أول مزامنة.</div>
        )}
        {otherSettings.length > 0 && (
          <section className="card se-group is-open">
            <div className="se-group-head is-static"><span className="se-group-title">خيارات الحجز والدفع</span></div>
            <div className="se-group-body">
              <p className="se-group-help">تشغيل وإيقاف الحجز، طرق الدفع، المهل والتذكير: من الإعدادات.</p>
              <LinkedSettings settings={view.settings} />
            </div>
          </section>
        )}

        {spec.groups.map((g, gi) => {
          const open = openGroups.has(gi)
          const changed = g.fields.some((f) => !deepEqual(getAt(draft, f.key), getAt(saved, f.key)))
          return (
            <section key={gi} className={cx('card se-group', open && 'is-open')}>
              <button type="button" className="se-group-head" aria-expanded={open} onClick={() => toggleGroup(gi)}>
                <span className="se-group-title">{g.title}</span>
                {changed && <span className="se-dot" title="تغيير ما انحفظ" />}
                <Icon name="back" size={18} className="se-chev" />
              </button>
              {open && (
                <div className="se-group-body">
                  {(g.help || (g.preview && g.preview !== spec.preview)) && (
                    <p className="se-group-help">
                      {g.help}
                      {g.preview && g.preview !== spec.preview && <> <a href={g.preview} target="_blank" rel="noopener noreferrer">عرض هالجزء</a></>}
                    </p>
                  )}
                  {g.fields.map((f) => (
                    <FieldEditor key={f.key} spec={f} path={f.key} value={getAt(draft, f.key)} def={getAt(DEFAULT_CONTENT[id], f.key)}
                      onChange={(v) => setDraft((d: unknown) => setAt(d, f.key, v))} />
                  ))}
                </div>
              )}
            </section>
          )
        })}

        <div className={cx('se-savebar', dirty && 'is-dirty')} role="region" aria-label="الحفظ">
          <span className="se-savebar-status" aria-live="polite">{dirty && <span className="se-dot" />}{status}</span>
          {dirty ? (
            <>
              <Button variant="ghost" disabled={!!busy} onClick={() => setConfirm('discard')}>تجاهل</Button>
              <Button size="lg" className="se-save" loading={busy === 'save'} disabled={!online || !!busy} onClick={save} data-testid="se-save">حفظ</Button>
            </>
          ) : justSaved && undoable && canUndo ? (
            <Button variant="soft" disabled={!online || !!busy} onClick={() => setConfirm('undo')}><Icon name="undo" size={16} /> تراجع عن آخر حفظ</Button>
          ) : (
            <Button size="lg" className="se-save" disabled data-testid="se-save">حفظ</Button>
          )}
        </div>
      </div>

      <Confirm open={confirm === 'undo'} title="تراجع عن آخر حفظ؟" confirmLabel="تراجع" loading={busy === 'undo'}
        body={<>«{spec.title}» بيرجع متل ما كان قبل آخر «حفظ»، وبيتغيّر عالموقع فوراً.{dirty && ' التعديلات اللي ما انحفظت رح تروح.'}{idKeys.length > 0 && ' بيانات المركز ما بتتأثر.'}</>}
        onClose={() => setConfirm(null)} onConfirm={() => void run('undo')} />
      <Confirm open={confirm === 'reset'} title="استعادة الأصل؟" danger confirmLabel="استعادة الأصل" loading={busy === 'reset'}
        body={<>كل نصوص وصور «{spec.title}» بترجع متل ما كانت بالأصل، وبيتغيّر عالموقع فوراً. إذا غيّرت رأيك، «تراجع عن آخر حفظ» بيرجّع تعديلاتك.{idKeys.length > 0 && ' بيانات المركز ما بتتأثر.'}</>}
        onClose={() => setConfirm(null)} onConfirm={() => void run('reset')} />
      <Confirm open={confirm === 'discard'} title="تجاهل التعديلات؟" danger confirmLabel="تجاهل"
        body="التعديلات اللي ما انحفظت رح تنمسح من هالجهاز، والقسم بيرجع متل ما هو عالموقع."
        onClose={() => setConfirm(null)} onConfirm={discard} />
      {guard.dialog}
    </EditorContext.Provider>
  )
}
