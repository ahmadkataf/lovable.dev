import { describe, expect, it } from 'vitest'
import {
  CONTENT_SECTIONS, DEFAULT_CONTENT, SECTION_IDS, SITE_ICONS, SITE_VARS, TEMPLATE_EXAMPLE, TEMPLATE_VARS,
  brandPalette, brandStyle, buildJsonLd, contentMediaSrcs, contrastRatio, fillTemplate, hoursTemplateVars, intlPhone, isSafeImageSrc,
  isSafeLink, mergeContent, parseRich, photoSmall, pickVariant, reminderLabel, roomTemplateVars, safeJson, sectionFields,
  siteTemplateVars, splitAddress, templateKeys, textParts, validateSection, whatsappLink, wordingFlags,
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
    g.gallery.photos[3] = { src: '/img/../secret', w: 10, h: 10, alt: 'صورة' }
    expect(validateSection('home', g)).toMatchObject({ ok: false, error: 'bad_image', path: 'gallery.photos.3.src' })
    const s = clone(DEFAULT_CONTENT.spaces)
    s.groups.open.photo = { src: '/media/abc.webp', w: 0, h: 10, alt: 'المساحة' }
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
    expect(merged.home.faq.items).toEqual([{ q: 'سؤال؟', a: 'جواب.', a_shamcash_only: '', a_cash_only: '', a_no_cancel: '' }])
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
    const c = mergeContent({ home: { hero: { photo: { src: '/media/abc.webp', w: 10, h: 10, alt: 'القاعة' } } } })
    expect(contentMediaSrcs(c)).toEqual(['/media/abc.webp'])
    expect(contentMediaSrcs(DEFAULT_CONTENT)).toEqual([])
  })
})

// The live data of today's site: the API default settings (api/src/settings.ts) and the seed rooms (api/seed.sql).
const API_SETTINGS = {
  centre_name: 'فوكس بوينت', phone: '0985258963', address: 'درعا، شارع المجمع الحكومي – بناء العايش', instagram: 'its_focus_point',
  open: '09:00', close: '23:00', hold_minutes: 30, reminder_minutes: 60,
}
const SEED_ROOMS = [
  { type: 'private', capacity: 2, active: 1 }, { type: 'private', capacity: 3, active: 1 }, { type: 'private', capacity: 4, active: 1 },
  { type: 'private', capacity: 4, active: 1 }, { type: 'meeting', capacity: 10, active: 1 }, { type: 'desk', capacity: 8, active: 1 },
]
const LIVE = siteTemplateVars({ settings: API_SETTINGS, brand: DEFAULT_CONTENT.brand, rooms: SEED_ROOMS })

describe('lists', () => {
  it('a fixed-list item missing a property takes it from its default item', () => {
    const r = validateSection('home', { sections: [{ id: 'faq' }] })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.sections[0]).toEqual({ id: 'faq', visible: true, tint: true })
      expect(r.value.sections.map((x) => x.id)).toEqual(['faq', 'hero', 'facts', 'features', 'spaces', 'how', 'gallery', 'visit', 'cta'])
    }
    expect(mergeContent({ home: { sections: [{ id: 'cta', visible: false }] } }).home.sections[0]).toEqual({ id: 'cta', visible: false, tint: false })
  })

  it('an item missing its icon keeps the list (neutral icon) instead of failing', () => {
    const r = validateSection('home', { features: { items: [{ title: 'هدوء', text: 'نص' }] } })
    expect(r).toMatchObject({ ok: true, value: { features: { items: [{ icon: 'check', title: 'هدوء', text: 'نص' }] } } })
    expect(mergeContent({ home: { hero: { chips: [{ text: 'جديد' }] } } }).home.hero.chips)
      .toEqual([{ icon: 'check', text: 'جديد', text_shamcash_only: '', text_cash_only: '' }])
  })

  it('unique list keys', () => {
    const s = clone(DEFAULT_CONTENT.spaces)
    s.groups.private.amenities = [{ key: 'wifi' }, { key: 'wifi' }]
    expect(validateSection('spaces', s)).toMatchObject({ ok: false, error: 'duplicate', path: 'groups.private.amenities.1.key' })
    s.groups.private.amenities = [{ key: 'wifi' }, { key: 'coffee' }]
    expect(validateSection('spaces', s).ok).toBe(true)
  })
})

describe('pictures', () => {
  it('alt text is required (except decorative fields)', () => {
    const v = clone(DEFAULT_CONTENT.home)
    v.hero.photo = { ...v.hero.photo, alt: '  ' }
    expect(validateSection('home', v)).toMatchObject({ ok: false, error: 'required', path: 'hero.photo.alt' })
    const b = { ...clone(DEFAULT_CONTENT.brand), logo: { src: '/media/logo1.webp', w: 512, h: 512, alt: '' } }
    expect(validateSection('brand', b)).toMatchObject({ ok: true, value: { logo: { src: '/media/logo1.webp', alt: '' } } })
  })

  it('the gallery has exactly four photos and a quote', () => {
    const v = clone(DEFAULT_CONTENT.home)
    v.gallery.photos = v.gallery.photos.slice(0, 3)
    expect(validateSection('home', v)).toMatchObject({ ok: false, error: 'too_few', path: 'gallery.photos' })
    v.gallery.photos = [...DEFAULT_CONTENT.home.gallery.photos, DEFAULT_CONTENT.home.hero.photo]
    expect(validateSection('home', v)).toMatchObject({ ok: false, error: 'too_many', path: 'gallery.photos' })
    const q = clone(DEFAULT_CONTENT.home)
    q.gallery.quote = ''
    expect(validateSection('home', q)).toMatchObject({ ok: false, error: 'required', path: 'gallery.quote' })
  })

  it('the share image is JPEG or PNG', () => {
    const s = clone(DEFAULT_CONTENT.seo)
    s.og_image = { ...s.og_image, src: '/media/abc.webp' }
    expect(validateSection('seo', s)).toMatchObject({ ok: false, error: 'bad_format', path: 'og_image.src' })
    s.og_image = { ...s.og_image, src: '/media/abc.jpg' }
    expect(validateSection('seo', s).ok).toBe(true)
  })

  it('photoSmall falls back to src', () => {
    expect(photoSmall(DEFAULT_CONTENT.home.hero.photo)).toBe('/img/room-a-720.webp')
    expect(photoSmall({ src: '/media/x.webp' })).toBe('/media/x.webp')
  })
})

describe('section rules', () => {
  it('an announcement link needs its label and its address', () => {
    const a = DEFAULT_CONTENT.announcement
    expect(validateSection('announcement', { ...a, link_label: 'احجز هلأ' })).toMatchObject({ ok: false, error: 'required', path: 'link_url' })
    expect(validateSection('announcement', { ...a, link_url: '/book' })).toMatchObject({ ok: false, error: 'required', path: 'link_label' })
    expect(validateSection('announcement', { ...a, link_label: 'احجز هلأ', link_url: '/book' }).ok).toBe(true)
    expect(mergeContent({ announcement: { enabled: true, text: 'عطلة', link_url: '/book' } }).announcement).toEqual(a)
  })

  it('headings, the eyebrow and the slogan cannot be empty', () => {
    const v = clone(DEFAULT_CONTENT.home)
    v.faq.title = ''
    expect(validateSection('home', v)).toMatchObject({ ok: false, error: 'required', path: 'faq.title' })
    expect(validateSection('brand', { ...DEFAULT_CONTENT.brand, eyebrow: '' })).toMatchObject({ ok: false, error: 'required', path: 'eyebrow' })
  })
})

describe('live values', () => {
  it('room placeholders: counts, min/max, biggest meeting room, open seats added up', () => {
    expect(roomTemplateVars(SEED_ROOMS)).toEqual({ privateCount: '4', privateMin: '2', privateMax: '4', meetingCapacity: '10', openCapacity: '8' })
    expect(roomTemplateVars([
      { type: 'meeting', capacity: 10, active: 1 }, { type: 'hall', capacity: 30, active: 1 }, { type: 'private', capacity: 6, active: 0 },
      ...Array.from({ length: 6 }, () => ({ type: 'desk', capacity: 1, active: 1 })),
    ])).toEqual({ privateCount: '4', privateMin: '2', privateMax: '4', meetingCapacity: '30', openCapacity: '6' })
    const ex = { privateCount: '4', privateMin: '2', privateMax: '4', meetingCapacity: '10', openCapacity: '8' }
    expect(roomTemplateVars(undefined)).toEqual(ex)
    expect(roomTemplateVars([])).toEqual(ex)
  })

  it('hours and reminder wording', () => {
    expect(hoursTemplateVars('09:00', '23:00')).toEqual({ hours: '9 ص – 11 م', open: '9 ص', close: '11 م', hoursPerDay: '14' })
    expect(hoursTemplateVars('21:30', '02:00')).toEqual({ hours: '9:30 م – 2 ص', open: '9:30 م', close: '2 ص', hoursPerDay: '5' })
    expect(hoursTemplateVars(undefined, 'x')).toEqual({ hours: '9 ص – 11 م', open: '9 ص', close: '11 م', hoursPerDay: '14' })
    expect([60, 15, 30, 45, 90, 120, 180, 720, 1440, 0].map(reminderLabel))
      .toEqual(['ساعة', 'ربع ساعة', 'نص ساعة', '45 دقيقة', 'ساعة ونص', 'ساعتين', '3 ساعات', '12 ساعة', 'يوم', ''])
  })

  it('siteTemplateVars falls back to TEMPLATE_EXAMPLE and covers every site placeholder', () => {
    const v = siteTemplateVars()
    for (const k of [...SITE_VARS, 'holdMinutes', 'reminder'] as const) expect(v[k], k).toBe(TEMPLATE_EXAMPLE[k])
    expect(LIVE.address).toBe(API_SETTINGS.address)
    expect(LIVE.reminder).toBe('ساعة')
  })

  it('the defaults read exactly like today\'s site with the live settings and the seed rooms', () => {
    const f = (t: string, vars: Record<string, string> = LIVE) => fillTemplate(t, vars)
    const d = DEFAULT_CONTENT
    expect(f(d.home.features.items[5]!.text)).toBe('شاشة وسبورة لـ10 أشخاص، للاجتماعات والعروض والدورات.')
    expect(f(d.home.faq.items[4]!.a)).toBe('أكيد. قاعة الاجتماعات بتساع لـ10 أشخاص وفيها شاشة وسبورة، وفي كمان غرف خاصة من 2 لـ4 أشخاص. [شوف المساحات](/spaces).')
    expect(f(d.spaces.lead)).toBe('غرف خاصة من 2 لـ4 أشخاص، قاعة اجتماعات لـ10 مع شاشة وسبورة، ومساحة مفتوحة مشتركة لـ8. الأسعار هون هي نفسها اللي بتشوفها وقت الحجز.')
    expect(f(d.spaces.groups.meeting.blurb)).toBe('قاعة لـ10 أشخاص فيها شاشة وسبورة، للاجتماعات والدورات والعروض.')
    expect(f(d.spaces.groups.open.blurb)).toBe('مكان مشترك لـ8 أشخاص، ضوء طبيعي وجو بيشجّع عالشغل.')
    expect(f(d.spaces.groups.private.badge)).toBe('4 غرف')
    expect(f(d.about.audience.items[2]!.text)).toBe('غرف خاصة من 2 لـ4 أشخاص، وقاعة اجتماعات لعشرة لما يكبر الاجتماع.')
    expect(f(d.home.facts.label)).toBe('فوكس بوينت بالأرقام')
    expect(f(d.brand.status_closed)).toBe('مسكّر هلأ، منفتح الساعة 9 ص')
    expect(f(d.booking.notify_prompt)).toBe('خبّرك أول ما يتأكد حجزك، ونذكّرك قبله بساعة.')
    expect(f(d.booking.notify_prompt_mine)).toBe('نخبرك بتأكيد الحجز ونذكّرك قبله بساعة.')
    expect(f(d.messages.booking_reminder.title)).toBe('حجزك بعد ساعة')
    expect(f(d.booking.note_shamcash)).toBe('بعد التأكيد يُحفَظ المكان لك 30 دقيقة لإتمام الدفع عبر شام كاش.')
    // first paint / offline: the site's own fallback address (site.tsx CENTRE.address)
    expect(f(d.home.faq.items[5]!.a, siteTemplateVars())).toBe('درعا – شارع المجمع الحكومي – بناء العايش. إذا ضعت، اتصل فينا أو ابعتلنا عالواتساب ومنوصفلك الطريق.')
  })
})

describe('rendering parts', () => {
  const join = (parts: { text: string }[]) => parts.map((p) => p.text).join('')

  it('isolates Latin runs and LTR placeholders, bolds the code and the reference', () => {
    expect(textParts(DEFAULT_CONTENT.home.features.lead, LIVE)).toEqual([
      { kind: 'text', text: 'جو ' }, { kind: 'latin', text: 'THINK OUTSIDE THE BOX' }, { kind: 'text', text: ': مكان مرتب وهادئ، بيعطيك مساحة تفكّر وتبدع.' },
    ])
    const tail = parseRich(DEFAULT_CONTENT.home.faq.items[2]!.a).at(-1)!
    expect(textParts(tail.text, { ...LIVE, phone: '+963 985 258 963' })).toEqual([
      { kind: 'text', text: '). بعد التأكيد، تواصل معنا على ' }, { kind: 'ltr', text: '+963 985 258 963' }, { kind: 'text', text: ' أو عالواتساب ومنساعدك.' },
    ])
    expect(textParts(DEFAULT_CONTENT.booking.verifying_text, { ref: '123456789' })[1]).toEqual({ kind: 'strong', text: '123456789' })
    expect(textParts(DEFAULT_CONTENT.about.story.paragraphs[1]!.text, LIVE).slice(-2)).toEqual([
      { kind: 'latin', text: 'THINK OUTSIDE THE BOX' }, { kind: 'text', text: '.' },
    ])
    expect(textParts('{unknown} و {name}', { name: 'فوكس بوينت' })).toEqual([{ kind: 'text', text: '{unknown} و فوكس بوينت' }])
  })

  it('the parts always add up to fillTemplate', () => {
    const vars = { ...TEMPLATE_EXAMPLE, ...LIVE }
    for (const { path, text } of stringsWithSpec()) expect(join(textParts(text, vars)), path).toBe(fillTemplate(text, vars))
  })
})

describe('wording variants', () => {
  const chip = DEFAULT_CONTENT.home.hero.chips[2]!
  const cancel = DEFAULT_CONTENT.home.faq.items[2]!

  it('wordingFlags: everything on while loading, the settings after', () => {
    expect(wordingFlags(null)).toEqual({ payOnArrival: true, shamcash: true, canCancel: true, reminders: true })
    expect(wordingFlags({ allow_pay_on_arrival: false })).toEqual({ payOnArrival: false, shamcash: true, canCancel: true, reminders: true })
    expect(wordingFlags({ allow_pay_on_arrival: true, shamcash_enabled: false, customer_can_cancel: false, reminder_minutes: 0 }))
      .toEqual({ payOnArrival: true, shamcash: false, canCancel: false, reminders: false })
  })

  it('pickVariant follows the settings and falls back to the plain field', () => {
    const on = wordingFlags(null)
    expect(pickVariant(chip, 'text', on)).toBe('الدفع بشام كاش أو عند الوصول')
    expect(pickVariant(chip, 'text', wordingFlags({ allow_pay_on_arrival: false }))).toBe('الدفع بشام كاش')
    expect(pickVariant(chip, 'text', wordingFlags({ allow_pay_on_arrival: true, shamcash_enabled: false }))).toBe('الدفع عند الوصول')
    expect(pickVariant(DEFAULT_CONTENT.home.hero.chips[1]!, 'text', wordingFlags({ allow_pay_on_arrival: true, shamcash_enabled: false }))).toBe('إنترنت سريع')
    expect(pickVariant(cancel, 'a', on)).toBe(cancel.a)
    expect(pickVariant(cancel, 'a', { ...on, canCancel: false })).toBe(cancel.a_no_cancel)
    expect(pickVariant(DEFAULT_CONTENT.booking, 'notify_prompt', { ...on, reminders: false })).toBe('خبّرك أول ما يتأكد حجزك.')
    expect(pickVariant(DEFAULT_CONTENT.home.cta, 'text', { ...on, shamcash: false })).toBe(DEFAULT_CONTENT.home.cta.text_cash_only)
  })

  it('every Sham Cash promise has a cash-only wording', () => {
    const cash = { ...wordingFlags(null), shamcash: false }
    const h = DEFAULT_CONTENT.home
    const shown = [
      ...h.hero.chips.map((c) => pickVariant(c, 'text', cash)),
      ...h.how.steps.flatMap((s) => [pickVariant(s, 'title', cash), pickVariant(s, 'text', cash)]),
      ...h.faq.items.map((q) => pickVariant(q, 'a', cash)),
      pickVariant(h.cta, 'text', cash),
    ]
    expect(shown.filter((t) => t.includes('شام كاش'))).toEqual([])
  })
})

describe('seo and theme helpers', () => {
  it('phone, WhatsApp and address helpers', () => {
    expect(intlPhone('0985258963')).toBe('+963985258963')
    expect(intlPhone('+963 985 258 963')).toBe('+963985258963')
    expect(intlPhone('00963985258963')).toBe('+963985258963')
    expect(intlPhone('')).toBe('')
    expect(whatsappLink('0985258963')).toBe('https://wa.me/963985258963')
    expect(splitAddress('درعا، شارع المجمع الحكومي – بناء العايش')).toEqual({ locality: 'درعا', street: 'شارع المجمع الحكومي – بناء العايش' })
    expect(splitAddress('درعا – شارع المجمع الحكومي – بناء العايش')).toEqual({ locality: 'درعا', street: 'شارع المجمع الحكومي – بناء العايش' })
    expect(splitAddress('بناء العايش')).toEqual({ locality: '', street: 'بناء العايش' })
  })

  it('buildJsonLd reproduces today\'s JSON-LD (web/index.html) from the defaults', () => {
    expect(buildJsonLd(DEFAULT_CONTENT, API_SETTINGS, 'https://focuspoint.raqeem.dev')).toEqual({
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      additionalType: 'https://schema.org/CoworkingSpace',
      name: 'Focus Point — فوكس بوينت',
      alternateName: 'فوكس بوينت',
      description: 'مساحة عمل مشتركة بدرعا: غرف خاصة، غرفة اجتماعات ومساحة مشتركة. المشروع الأول من نوعه بدرعا.',
      slogan: 'مساحتك وركنك الهادئ للإبداع',
      url: 'https://focuspoint.raqeem.dev',
      logo: 'https://focuspoint.raqeem.dev/icons/icon-512.png',
      image: 'https://focuspoint.raqeem.dev/img/og.png',
      telephone: '+963985258963',
      address: { '@type': 'PostalAddress', streetAddress: 'شارع المجمع الحكومي – بناء العايش', addressLocality: 'درعا', addressCountry: 'SY' },
      openingHoursSpecification: [{
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        opens: '09:00',
        closes: '23:00',
      }],
      sameAs: ['https://instagram.com/its_focus_point'],
      currenciesAccepted: 'SYP',
    })
    expect(safeJson({ a: '</script>' })).toBe('{"a":"\\u003c/script>"}')
  })

  it('brand colour variables', () => {
    expect(brandPalette('#7B1E2E')).toEqual({
      '--brand': '#7b1e2e', '--brand-hover': '#6a1927', '--brand-50': '#fdf2f4', '--brand-100': '#fbe4e8', '--wine': '#7b1e2e', '--wine-line': 'rgba(123, 30, 46, 0.32)',
    })
    expect(brandStyle(DEFAULT_CONTENT.theme.brand)).toBe('')
    const css = brandStyle('#1d4ed8')
    expect(css.startsWith(':root{--brand:#1d4ed8;')).toBe(true)
    for (const k of ['--brand-hover:', '--brand-50:', '--brand-100:', '--wine:#1d4ed8', '--wine-line:rgba(29, 78, 216, 0.32)']) expect(css).toContain(k)
    expect(Object.values(brandPalette('#1d4ed8')).slice(0, 4).every((c) => /^#[0-9a-f]{6}$/.test(c))).toBe(true)
    expect(contrastRatio('#7b1e2e', '#ffffff')).toBeGreaterThan(4.5)
    expect(contrastRatio('#ffffff', '#ffffff')).toBe(1)
  })
})
