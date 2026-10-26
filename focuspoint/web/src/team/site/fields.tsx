// Field widgets of the site editor, one per FieldKind of shared/content.ts (image/images in ./ImageField, list in
// ./FieldEditor). Every widget sits in a FieldShell: label, «معدّل» dot, help, the Arabic error, and data-path so a
// validation error can scroll to it. Values stay exactly what the admin typed; validateSection normalises on save.
import { createContext, useContext, useEffect, useId, useRef, useState, type ChangeEvent, type CSSProperties, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import { fillTemplate, isSafeLink, parseRich, SITE_ICONS, TEMPLATE_VARS, type FieldSpec, type SiteIconName } from '@shared/content'
import { SiteIcon } from '../../pages/site/SiteIcon'
import { Icon, Input, Select, Sheet, Textarea, Toggle } from '../../ui'
import { cx } from '../util'
import { COLOR_PRESETS, contrastWithWhite } from './vars'

// ---------- context ----------
export interface EditorCtx {
  error: { owner: string; message: string } | null
  vars: Record<string, string>        // live values for the {placeholder} preview
  isChanged: (path: string, value: unknown) => boolean
}
export const EditorContext = createContext<EditorCtx>({ error: null, vars: {}, isChanged: () => false })
export const useEditor = () => useContext(EditorContext)

export interface WidgetProps<T = unknown> { spec: FieldSpec; path: string; value: T; onChange: (v: T) => void }

// ---------- shell ----------
export function FieldShell({ spec, path, value, htmlFor, aside, children, inline = false, error: localError }: {
  spec: FieldSpec; path: string; value: unknown; htmlFor?: string; aside?: ReactNode; children: ReactNode; inline?: boolean; error?: string | null
}) {
  const { error, isChanged } = useEditor()
  const message = error?.owner === path ? error.message : localError ?? null
  const changed = isChanged(path, value)
  const required = (spec.kind === 'text' || spec.kind === 'longtext' || spec.kind === 'link') && (spec.min ?? 0) > 0
  return (
    <div className={cx('se-field', inline && 'is-inline', message && 'has-error')} data-path={path}>
      {!inline && (
        <div className="se-field-head">
          <label className="field-label" htmlFor={htmlFor}>
            {spec.label}
            {required && <span className="se-req" aria-label="مطلوب"> *</span>}
            {changed && <span className="se-dot" title="تغيير ما انحفظ"><span className="sr-only">تغيير ما انحفظ</span></span>}
          </label>
          {aside}
        </div>
      )}
      {children}
      {message ? <span className="field-error" role="alert">{message}</span> : spec.help ? <span className="field-hint">{spec.help}</span> : null}
    </div>
  )
}

// ---------- text / longtext (counter, placeholder chips, emphasis/link helpers, live preview) ----------
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

function Preview({ text, rich }: { text: string; rich: boolean }) {
  const { vars } = useEditor()
  if (!(rich ? /[{*[]/ : /\{/).test(text)) return null
  const parts = rich ? parseRich(text) : [{ kind: 'text' as const, text }]
  return (
    <div className="se-preview" aria-live="polite">
      <span className="se-preview-label">بيطلع هيك:</span>{' '}
      {parts.map((p, i) => p.kind === 'em' ? <b key={i}>{fillTemplate(p.text, vars)}</b>
        : p.kind === 'link' ? <span key={i} className="se-preview-link">{fillTemplate(p.text, vars)}</span>
          : <span key={i} className="se-pre">{fillTemplate(p.text, vars)}</span>)}
    </div>
  )
}

export function TextField({ spec, path, value, onChange }: WidgetProps) {
  const id = useId()
  const multiline = spec.kind === 'longtext'
  const max = spec.max ?? (multiline ? 2000 : 200)
  const text = str(value)
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const sel = useRef<[number, number] | null>(null)
  const [legend, setLegend] = useState(false)
  const remember = () => { const el = ref.current; if (el) sel.current = [el.selectionStart ?? text.length, el.selectionEnd ?? text.length] }
  const vars = (spec.placeholders ?? []).filter((k) => TEMPLATE_VARS[k])

  /** Wrap the remembered selection in before…after (an empty selection gets `placeholder`, left selected). */
  function wrap(before: string, after: string, placeholder: string) {
    const [a, b] = sel.current ?? [text.length, text.length]
    const chosen = text.slice(a, b)
    const inner = chosen || placeholder
    put(text.slice(0, a) + before + inner + after + text.slice(b),
      chosen ? [a + before.length + inner.length + after.length, a + before.length + inner.length + after.length] : [a + before.length, a + before.length + inner.length])
  }
  /** Replace the remembered selection with a {placeholder}; the caret goes right after it. */
  function token(t: string) {
    const [a, b] = sel.current ?? [text.length, text.length]
    put(text.slice(0, a) + t + text.slice(b), [a + t.length, a + t.length])
  }
  function put(next: string, caret: [number, number]) {
    if (next.length > max) return
    onChange(next)
    sel.current = caret
    requestAnimationFrame(() => {
      const el = ref.current
      if (!el) return
      el.focus()
      try { el.setSelectionRange(caret[0], caret[1]) } catch { /* some input types do not support selection */ }
    })
  }
  const keep = (e: RPointerEvent | RMouseEvent) => e.preventDefault()   // keep the keyboard and the caret

  const common = {
    id, ref, value: text, maxLength: max,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { onChange(e.target.value); sel.current = [e.target.selectionStart ?? 0, e.target.selectionEnd ?? 0] },
    onSelect: remember, onKeyUp: remember, onClick: remember, onBlur: remember,
  }
  const ltr = spec.format === 'phone' || spec.format === 'email'
  const counter = <span className={cx('se-count', text.length >= max * 0.9 && 'is-near')} aria-label={`${text.length} من ${max} حرف`}>{text.length}/{max}</span>
  return (
    <FieldShell spec={spec} path={path} value={value} htmlFor={id} aside={counter}>
      {multiline
        ? <Textarea {...common} rows={Math.min(8, Math.max(3, Math.ceil(text.length / 60)))} />
        : <Input {...common} dir={ltr ? 'ltr' : undefined} type={spec.format === 'phone' ? 'tel' : spec.format === 'email' ? 'email' : 'text'} inputMode={spec.format === 'phone' ? 'tel' : spec.format === 'email' ? 'email' : undefined} />}
      {(vars.length > 0 || spec.rich) && (
        <div className="se-chips" role="group" aria-label="إدراج">
          {spec.rich && <button type="button" className="se-chip is-tool" onPointerDown={keep} onMouseDown={keep} onClick={() => wrap('**', '**', 'كلام مميّز')}><b>**</b> تمييز</button>}
          {spec.rich && multiline && <button type="button" className="se-chip is-tool" onPointerDown={keep} onMouseDown={keep} onClick={() => wrap('[', '](/book)', 'النص')}>رابط</button>}
          {vars.map((k) => (
            <button key={k} type="button" className="se-chip" dir="ltr" title={TEMPLATE_VARS[k]} onPointerDown={keep} onMouseDown={keep} onClick={() => token(`{${k}}`)}>{`{${k}}`}</button>
          ))}
          {vars.length > 0 && <button type="button" className="se-chip is-help" aria-expanded={legend} onClick={() => setLegend((x) => !x)}>{legend ? 'إخفاء الشرح' : 'شو معناها؟'}</button>}
        </div>
      )}
      {legend && (
        <dl className="se-legend">
          {vars.map((k) => <div key={k}><dt dir="ltr">{`{${k}}`}</dt><dd>{TEMPLATE_VARS[k]}</dd></div>)}
        </dl>
      )}
      <Preview text={text} rich={!!spec.rich} />
    </FieldShell>
  )
}

// ---------- link ----------
export function LinkField({ spec, path, value, onChange }: WidgetProps) {
  const id = useId()
  const text = str(value)
  const [touched, setTouched] = useState(false)
  const v = text.trim()
  const bad = touched && v !== '' && !isSafeLink(v)
  return (
    <FieldShell spec={spec} path={path} value={value} htmlFor={id} error={bad ? 'الرابط لازم يبدأ بـ https:// أو / أو tel: أو mailto:' : null}>
      <div className="se-inline">
        <Input id={id} dir="ltr" inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} maxLength={spec.max ?? 500}
          placeholder="https://… أو /book" value={text} onChange={(e) => onChange(e.target.value)} onBlur={() => setTouched(true)} />
        {v && isSafeLink(v) && (
          <a className="btn btn-soft se-square" href={v} target="_blank" rel="noopener noreferrer" aria-label="جرّب الرابط" title="جرّب الرابط"><Icon name="external" size={18} /></a>
        )}
      </div>
    </FieldShell>
  )
}

// ---------- toggle ----------
export function ToggleField({ spec, path, value, onChange }: WidgetProps) {
  const { isChanged } = useEditor()
  return (
    <FieldShell spec={spec} path={path} value={value} inline>
      <div className="se-toggle-row">
        <Toggle checked={value === true} onChange={(v) => onChange(v)} label={spec.label} />
        {isChanged(path, value) && <span className="se-dot" title="تغيير ما انحفظ"><span className="sr-only">تغيير ما انحفظ</span></span>}
      </div>
    </FieldShell>
  )
}

// ---------- number ----------
const toNum = (s: string): number | null => {
  const t = s.replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).trim()
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null
}
export function NumberField({ spec, path, value, onChange }: WidgetProps) {
  const id = useId()
  const n = typeof value === 'number' ? value : null
  const [text, setText] = useState(n === null ? '' : String(n))
  useEffect(() => { setText((t) => (toNum(t) === n ? t : n === null ? '' : String(n))) }, [n])
  const parsed = toNum(text)
  const out = parsed !== null && ((spec.min !== undefined && parsed < spec.min) || (spec.max !== undefined && parsed > spec.max))
  const range = spec.min !== undefined && spec.max !== undefined ? `بين ${spec.min} و${spec.max}` : spec.min !== undefined ? `${spec.min} أو أكتر` : spec.max !== undefined ? `${spec.max} أو أقل` : ''
  return (
    <FieldShell spec={spec} path={path} value={value} htmlFor={id} error={text && parsed === null ? 'اكتب رقم' : out ? `الرقم لازم يكون ${range}` : null}>
      <Input id={id} dir="ltr" inputMode="numeric" value={text} style={{ maxWidth: 200 }}
        onChange={(e) => { setText(e.target.value); const p = toNum(e.target.value); if (p !== null) onChange(p) }} />
    </FieldShell>
  )
}

// ---------- select ----------
export function SelectField({ spec, path, value, onChange }: WidgetProps) {
  const id = useId()
  const options = spec.options ?? []
  if (spec.readonly) {
    return (
      <FieldShell spec={spec} path={path} value={value}>
        <div className="se-readonly">{options.find((o) => o.value === value)?.label ?? str(value)}</div>
      </FieldShell>
    )
  }
  return (
    <FieldShell spec={spec} path={path} value={value} htmlFor={id}>
      <Select id={id} value={str(value)} onChange={(e) => onChange(e.target.value)}>
        {!options.some((o) => o.value === value) && <option value={str(value)} disabled>اختار…</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>
    </FieldShell>
  )
}

// ---------- icon ----------
const isIcon = (v: unknown): v is SiteIconName => typeof v === 'string' && (SITE_ICONS as readonly string[]).includes(v)
export function IconField({ spec, path, value, onChange }: WidgetProps) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <FieldShell spec={spec} path={path} value={value} htmlFor={id}>
      <button id={id} type="button" className="se-iconbtn" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span className="se-icontile">{isIcon(value) ? <SiteIcon name={value} size={24} /> : <Icon name="x" size={20} />}</span>
        <span>{isIcon(value) ? 'تغيير الأيقونة' : 'اختار أيقونة'}</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="اختار أيقونة">
        <div className="se-icongrid" role="listbox" aria-label="الأيقونات">
          {SITE_ICONS.map((name) => (
            <button key={name} type="button" role="option" aria-selected={value === name} aria-label={name}
              className={cx('se-iconopt', value === name && 'is-active')} onClick={() => { onChange(name); setOpen(false) }}>
              <SiteIcon name={name} size={24} />
            </button>
          ))}
        </div>
      </Sheet>
    </FieldShell>
  )
}

// ---------- colour ----------
export function ColorField({ spec, path, value, onChange }: WidgetProps) {
  const id = useId()
  const hex = str(value)
  const valid = /^#[0-9a-fA-F]{6}$/.test(hex.trim())
  const ratio = valid ? contrastWithWhite(hex) : null
  const low = ratio !== null && ratio < 4.5
  return (
    <FieldShell spec={spec} path={path} value={value} htmlFor={id} error={hex && !valid ? 'اكتب اللون بالشكل ‎#7b1e2e' : null}>
      <div className="se-color">
        <input type="color" className="se-color-pick" value={valid ? hex.trim().toLowerCase() : '#7b1e2e'} onChange={(e) => onChange(e.target.value)} aria-label="اختار لون" />
        <Input id={id} dir="ltr" maxLength={7} value={hex} spellCheck={false} autoCapitalize="off" style={{ maxWidth: 150 }}
          onChange={(e) => { const t = e.target.value.trim(); onChange(t && !t.startsWith('#') ? `#${t}` : t) }} />
      </div>
      <div className="se-presets" role="group" aria-label="ألوان جاهزة">
        {COLOR_PRESETS.map((p) => (
          <button key={p.value} type="button" className={cx('swatch', 'se-swatch', valid && hex.trim().toLowerCase() === p.value && 'is-active')}
            style={{ background: p.value }} title={p.label} aria-label={p.label} onClick={() => onChange(p.value)} />
        ))}
      </div>
      {valid && (
        <div className="se-color-sample" style={{ '--sample': hex.trim() } as CSSProperties}>
          <span className="se-color-btn">احجز مكانك</span>
          <span className="se-color-text">عنوان <b>بلون المركز</b></span>
        </div>
      )}
      {low && <div className="alert alert-error mt-sm" role="status">اللون فاتح: الكتابة البيضاء فوقه صعبة القراءة (التباين {ratio.toFixed(1)} من 4.5 المطلوب). اختار لون أغمق.</div>}
    </FieldShell>
  )
}
