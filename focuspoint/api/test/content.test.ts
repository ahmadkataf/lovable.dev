import { describe, expect, it } from 'vitest'
import {
  CONTENT_SECTIONS, DEFAULT_CONTENT, SECTION_IDS, SITE_ICONS, TEMPLATE_VARS,
  contentMediaSrcs, fillTemplate, isSafeImageSrc, isSafeLink, mergeContent, parseRich, sectionFields, templateKeys, validateSection,
  type FieldSpec, type SectionId,
} from '../../shared/content'

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

/** Every schema field as "section.key" (list items are part of their list field). */
function schemaPaths(): string[] {
  return CONTENT_SECTIONS.flatMap((s) => sectionFields(s).map((f) => `${s.id}.${f.key}`))
}

/** Every leaf of a value: a schema field path stops the walk; otherwise plain objects are entered. */
function leafPaths(v: unknown, path: string, stop: Set<string>, out: string[]): string[] {
  if (stop.has(path) || !isObj(v)) { out.push(path); return out }
  for (const [k, x] of Object.entries(v)) leafPaths(x, path ? `${path}.${k}` : k, stop, out)
  return out
}

/** Every string inside a value, with the field spec that owns it. */
function stringsWithSpec(): { path: string; text: string; spec: FieldSpec }[] {
  const out: { path: string; text: string; spec: FieldSpec }[] = []
  for (const s of CONTENT_SECTIONS) {
    for (const f of sectionFields(s)) {
      const v = f.key.split('.').reduce<unknown>((o, k) => (isObj(o) ? o[k] : undefined), DEFAULT_CONTENT[s.id])
      if (typeof v === 'string') out.push({ path: `${s.id}.${f.key}`, text: v, spec: f })
      if (f.kind === 'list' && Array.isArray(v)) {
        v.forEach((item, i) => {
          for (const sf of f.item ?? []) {
            const t = isObj(item) ? item[sf.key] : undefined
            if (typeof t === 'string') out.push({ path: `${s.id}.${f.key}.${i}.${sf.key}`, text: t, spec: sf })
          }
        })
      }
    }
  }
  return out
}

describe('content contract', () => {
  it('lists every section once, in the schema and in SECTION_IDS', () => {
    expect([...SECTION_IDS].sort()).toEqual(Object.keys(DEFAULT_CONTENT).sort())
    expect(CONTENT_SECTIONS.map((s) => s.id)).toEqual([...SECTION_IDS])
  })

  it('mergeContent(undefined) deep-equals DEFAULT_CONTENT and is a fresh copy', () => {
    const merged = mergeContent(undefined)
    expect(merged).toEqual(DEFAULT_CONTENT)
    expect(merged).not.toBe(DEFAULT_CONTENT)
    merged.home.hero.chips.pop()
    expect(DEFAULT_CONTENT.home.hero.chips).toHaveLength(3)
    expect(mergeContent(null)).toEqual(DEFAULT_CONTENT)
    expect(mergeContent('junk')).toEqual(DEFAULT_CONTENT)
    expect(mergeContent({})).toEqual(DEFAULT_CONTENT)
  })

  it('has every SiteContent leaf path in CONTENT_SECTIONS exactly once', () => {
    const paths = schemaPaths()
    const dupes = paths.filter((p, i) => paths.indexOf(p) !== i)
    expect(dupes).toEqual([])
    const leaves = leafPaths(DEFAULT_CONTENT, '', new Set(paths), [])
    expect(leaves.sort()).toEqual([...paths].sort())
  })

  it('validateSection accepts every default section unchanged', () => {
    for (const id of SECTION_IDS) {
      const r = validateSection(id, clone(DEFAULT_CONTENT[id]))
      expect(r, id).toEqual({ ok: true, value: DEFAULT_CONTENT[id] })
    }
  })

  it('uses only known placeholders, each listed on its field', () => {
    for (const { path, text, spec } of stringsWithSpec()) {
      for (const k of templateKeys(text)) {
        expect(TEMPLATE_VARS[k], `${path}: {${k}}`).toBeTypeOf('string')
        expect(spec.placeholders ?? [], `${path}: {${k}} not offered by the field`).toContain(k)
      }
    }
  })

  it('gives every field a label and every select its options', () => {
    const all = CONTENT_SECTIONS.flatMap((s) => sectionFields(s).flatMap((f) => [f, ...(f.item ?? [])]))
    for (const f of all) {
      expect(f.label.length, f.key).toBeGreaterThan(0)
      if (f.kind === 'select') expect(f.options?.length, f.key).toBeGreaterThan(0)
      for (const p of f.placeholders ?? []) expect(TEMPLATE_VARS[p], `${f.key}: ${p}`).toBeTypeOf('string')
    }
  })
})

describe('validateSection rejects bad input', () => {
  const home = () => clone(DEFAULT_CONTENT.home)

  it('an over-long text', () => {
    const v = home()
    v.hero.title = 'ا'.repeat(121)
    expect(validateSection('home', v)).toMatchObject({ ok: false, error: 'too_long', path: 'hero.title' })
    const b = clone(DEFAULT_CONTENT.booking)
    b.intro_title = 'x'.repeat(500)
    expect(validateSection('booking', b)).toMatchObject({ ok: false, error: 'too_long', path: 'intro_title' })
  })

  it('a bad link', () => {
    for (const bad of ['javascript:alert(1)', 'http://example.com', '//evil.com/x', 'https://exa mple.com', 'data:text/html,hi']) {
      const v = clone(DEFAULT_CONTENT.brand)
      v.facebook_url = bad
      expect(validateSection('brand', v), bad).toMatchObject({ ok: false, error: 'bad_link', path: 'facebook_url' })
    }
    const f = home()
    const first = f.faq.items[0]!
    first.a = 'شوف [هون](javascript:alert(1))'
    expect(validateSection('home', f)).toMatchObject({ ok: false, error: 'bad_link', path: 'faq.items.0.a' })
  })

  it('accepts good links and an empty optional link', () => {
    for (const good of ['https://wa.me/963985258963', 'https://www.facebook.com/focuspoint', '/book', '/spaces#sp-open', 'tel:+963985258963', 'mailto:hi@example.com', '']) {
      const v = clone(DEFAULT_CONTENT.brand)
      v.maps_url = good
      expect(validateSection('brand', v).ok, good).toBe(true)
    }
  })

  it('an external image src', () => {
    const v = home()
    v.hero.photo = { ...v.hero.photo, src: 'https://evil.com/x.png' }
    expect(validateSection('home', v)).toMatchObject({ ok: false, error: 'bad_image', path: 'hero.photo.src' })
    const g = home()
    g.gallery.photos = [...g.gallery.photos, { src: '/img/../secret', w: 10, h: 10, alt: '' }]
    expect(validateSection('home', g)).toMatchObject({ ok: false, error: 'bad_image', path: 'gallery.photos.4.src' })
    const s = clone(DEFAULT_CONTENT.spaces)
    s.groups.open.photo = { src: '/media/abc.webp', w: 0, h: 10, alt: '' }
    expect(validateSection('spaces', s)).toMatchObject({ ok: false, error: 'bad_size', path: 'groups.open.photo' })
  })

  it('a bad colour (and lower-cases a good one)', () => {
    for (const bad of ['red', '#7b1e2', '#7b1e2eff', 'rgb(1,2,3)', '']) {
      expect(validateSection('theme', { brand: bad }), bad).toMatchObject({ ok: false, error: 'bad_color', path: 'brand' })
    }
    expect(validateSection('theme', { brand: ' #7B1E2E ' })).toEqual({ ok: true, value: { brand: '#7b1e2e' } })
  })

  it('wrong types, unknown icons and too many items', () => {
    expect(validateSection('home', 'nope')).toMatchObject({ ok: false, error: 'not_object' })
    expect(validateSection('nope' as SectionId, {})).toMatchObject({ ok: false, error: 'unknown_section' })
    const a = home()
    ;(a.features.items[0] as { icon: string }).icon = 'rocket'
    expect(validateSection('home', a)).toMatchObject({ ok: false, error: 'bad_icon', path: 'features.items.0.icon' })
    const b = home()
    b.hero.chips = [...b.hero.chips, ...b.hero.chips]
    expect(validateSection('home', b)).toMatchObject({ ok: false, error: 'too_many', path: 'hero.chips' })
    expect(validateSection('announcement', { ...DEFAULT_CONTENT.announcement, enabled: 'yes' })).toMatchObject({ ok: false, error: 'bad_type', path: 'enabled' })
    expect(validateSection('announcement', { ...DEFAULT_CONTENT.announcement, tone: 'loud' })).toMatchObject({ ok: false, error: 'bad_option', path: 'tone' })
  })

  it('an enabled announcement needs a text', () => {
    expect(validateSection('announcement', { ...DEFAULT_CONTENT.announcement, enabled: true })).toMatchObject({ ok: false, error: 'required', path: 'text' })
    const r = validateSection('announcement', { ...DEFAULT_CONTENT.announcement, enabled: true, text: '  عطلة العيد  ' })
    expect(r).toMatchObject({ ok: true, value: { enabled: true, text: 'عطلة العيد' } })
  })

  it('trims, drops unknown keys and fills missing keys with defaults', () => {
    const r = validateSection('footer', { copyright: '  © 2027 Focus Point  ', evil: 'x' })
    expect(r).toEqual({ ok: true, value: { ...DEFAULT_CONTENT.footer, copyright: '© 2027 Focus Point' } })
  })

  it('keeps home.sections a permutation of the known sections', () => {
    const v = home()
    v.sections = [{ id: 'faq', visible: false, tint: false }, { id: 'hero', visible: true, tint: false }]
    const r = validateSection('home', v)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.sections.map((s) => s.id)).toEqual(['faq', 'hero', 'facts', 'features', 'spaces', 'how', 'gallery', 'visit', 'cta'])
      expect(r.value.sections[0]).toEqual({ id: 'faq', visible: false, tint: false })
    }
    const d = home()
    d.sections = [{ id: 'faq', visible: true, tint: false }, { id: 'faq', visible: true, tint: false }]
    expect(validateSection('home', d)).toMatchObject({ ok: false, error: 'duplicate', path: 'sections.1.id' })
  })
})

describe('mergeContent', () => {
  it('merges per key, replaces lists, falls back per field and drops unknown keys', () => {
    const merged = mergeContent({
      brand: { slogan: 'شعار جديد', email: 42, junk: true },
      home: { faq: { items: [{ q: 'سؤال؟', a: 'جواب.' }] }, hero: { photo: { src: 'https://x.y/z.png', w: 1, h: 1, alt: '' } } },
      theme: { brand: 'not a colour' },
      nope: { a: 1 },
    })
    expect(merged.brand.slogan).toBe('شعار جديد')
    expect(merged.brand.email).toBe(DEFAULT_CONTENT.brand.email)
    expect(merged.brand).not.toHaveProperty('junk')
    expect(merged.home.faq.items).toEqual([{ q: 'سؤال؟', a: 'جواب.', a_shamcash_only: '' }])
    expect(merged.home.faq.title).toBe(DEFAULT_CONTENT.home.faq.title)
    expect(merged.home.hero.photo).toEqual(DEFAULT_CONTENT.home.hero.photo)
    expect(merged.theme.brand).toBe('#7b1e2e')
    expect(merged).not.toHaveProperty('nope')
  })

  it('drops an enabled announcement without text', () => {
    expect(mergeContent({ announcement: { enabled: true, text: '' } }).announcement).toEqual(DEFAULT_CONTENT.announcement)
  })
})

describe('templates and rich text', () => {
  it('fillTemplate fills known placeholders and keeps unknown ones', () => {
    expect(fillTemplate('{name} — {unknown} {x', { name: 'فوكس بوينت' })).toBe('فوكس بوينت — {unknown} {x')
    expect(fillTemplate('يومياً {hours}', { hours: '9 ص – 11 م' })).toBe('يومياً 9 ص – 11 م')
    expect(fillTemplate('{n} {n}', { n: 4 })).toBe('4 4')
    expect(fillTemplate('{toString}', {})).toBe('{toString}')
  })

  it('renders today\'s texts from the defaults', () => {
    expect(fillTemplate(DEFAULT_CONTENT.home.faq.items[3]!.a, { open: '9 ص', close: '11 م' })).toBe('مفتوحين كل يوم، من 9 ص لـ11 م.')
    expect(fillTemplate(DEFAULT_CONTENT.footer.tagline, { slogan: DEFAULT_CONTENT.brand.slogan, eyebrow: DEFAULT_CONTENT.brand.eyebrow }))
      .toBe('مساحتك وركنك الهادئ للإبداع. المشروع الأول من نوعه بدرعا — غرف خاصة، قاعة اجتماعات ومساحة مفتوحة، بتحجزها من موبايلك بخطوات بسيطة.')
    expect(fillTemplate(DEFAULT_CONTENT.messages.booking_created.body, { customer_name: 'أحمد', room: 'غرفة 1', when: 'الجمعة 24/10 · 10:00–12:00', price: '30,000 ل.س', code: 'A7K2QZ' }))
      .toBe('أحمد · غرفة 1 · الجمعة 24/10 · 10:00–12:00 · 30,000 ل.س · الرمز A7K2QZ')
  })

  it('parseRich splits emphasis and links', () => {
    expect(parseRich(DEFAULT_CONTENT.home.hero.title)).toEqual([
      { kind: 'text', text: 'مساحتك الهادئة ' }, { kind: 'em', text: 'للشغل والدراسة' }, { kind: 'text', text: ' والإبداع' },
    ])
    expect(parseRich(DEFAULT_CONTENT.home.faq.lead)).toEqual([
      { kind: 'text', text: 'إذا ما لقيت جوابك هون، ' }, { kind: 'link', text: 'تواصل معنا', href: '/contact' }, { kind: 'text', text: '.' },
    ])
  })

  it('link, image and icon rules', () => {
    expect(isSafeLink('https://wa.me/963985258963')).toBe(true)
    expect(isSafeLink('javascript:alert(1)')).toBe(false)
    expect(isSafeImageSrc('/media/abc123.webp')).toBe(true)
    expect(isSafeImageSrc('/img/../x')).toBe(false)
    expect(isSafeImageSrc('https://evil.com/x.png')).toBe(false)
    expect(new Set(SITE_ICONS).size).toBe(SITE_ICONS.length)
    expect(SITE_ICONS).toHaveLength(64)
  })

  it('finds the uploaded pictures the content uses', () => {
    const c = mergeContent({ home: { hero: { photo: { src: '/media/abc.webp', w: 10, h: 10, alt: '' } } } })
    expect(contentMediaSrcs(c)).toEqual(['/media/abc.webp'])
    expect(contentMediaSrcs(DEFAULT_CONTENT)).toEqual([])
  })
})
