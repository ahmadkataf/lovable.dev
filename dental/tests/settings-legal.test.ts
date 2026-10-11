// Legal documents: the privacy policy and terms exist in both languages with the seller's contacts, the setup
// wizard can record the acceptance, and the open-source notices cover every runtime dependency (run
// `node src/features/legal/gen-notices.mjs` after adding or upgrading one).
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { db, resetDatabase } from '../src/db'
import { translate } from '../src/i18n'
import { TERMS_VERSION, acceptTerms, legalText, loadLegalDocs, termsAcceptance } from '../src/features/legal/lib'
import { parseLegal } from '../src/features/legal/LegalText'
import { LICENSE_TEXTS, NOTICES } from '../src/features/legal/notices'
import { SELLER } from '../src/features/settings/seller'

const root = resolve(__dirname, '..')

describe('privacy policy and terms of use', () => {
  beforeAll(async () => { await loadLegalDocs() })
  it('are written in Arabic and English, with the seller contacts and the required sections', () => {
    for (const lang of ['ar', 'en'] as const) {
      const privacy = legalText('privacy', lang), terms = legalText('terms', lang)
      for (const s of [privacy, terms]) {
        expect(s).toContain(SELLER.email)
        expect(s).toContain(SELLER.whatsapp)
        expect(s).not.toMatch(/\{(seller|email|whatsapp)\}/)
        expect(parseLegal(s).filter(b => b.kind === 'h').length).toBeGreaterThanOrEqual(8)
      }
    }
    const en = legalText('privacy', 'en')
    for (const must of ['only on the device', 'no tracking', 'WhatsApp', 'Backups', 'Device number', 'Patients’ rights', 'Delete all data']) expect(en).toContain(must)
    const terms = legalText('terms', 'en')
    for (const must of ['Medical disclaimer', 'Limitation of liability', 'No warranty', '7-day trial', 'one device per activation code', 'export a backup regularly']) expect(terms).toContain(must)
    expect(legalText('terms', 'ar')).toContain('إخلاء المسؤولية الطبية')
  })
  it('the markup parses into headings, paragraphs and lists', () => {
    const blocks = parseLegal('Intro line\nsame paragraph\n\n## Head\n- one\n- two\nAfter')
    expect(blocks).toEqual([
      { kind: 'p', text: 'Intro line same paragraph' }, { kind: 'h', text: 'Head' }, { kind: 'ul', items: ['one', 'two'] }, { kind: 'p', text: 'After' },
    ])
  })
  it('records the acceptance of the current terms', async () => {
    await resetDatabase()
    expect(await termsAcceptance()).toBeNull()
    const row = await acceptTerms('u1')
    expect(row.version).toBe(TERMS_VERSION)
    expect(await termsAcceptance()).toMatchObject({ version: TERMS_VERSION, by: 'u1' })
    await db.settings.put({ key: 'termsAccepted', value: { version: TERMS_VERSION - 1, at: new Date().toISOString() } })
    expect(await termsAcceptance()).toBeNull()
  })
  it('the store-listing copies say the same as the app', () => {
    const privacyMd = readFileSync(resolve(root, 'docs/PRIVACY.md'), 'utf8')
    const termsMd = readFileSync(resolve(root, 'docs/TERMS.md'), 'utf8')
    for (const lang of ['ar', 'en'] as const) {
      for (const h of parseLegal(legalText('privacy', lang)).filter(b => b.kind === 'h')) expect(privacyMd).toContain(`## ${(h as { text: string }).text}`)
      for (const h of parseLegal(legalText('terms', lang)).filter(b => b.kind === 'h')) expect(termsMd).toContain(`## ${(h as { text: string }).text}`)
    }
    expect(translate('ar', 'legal.privacy')).toBe('سياسة الخصوصية')
  })
})

describe('open-source notices', () => {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { dependencies: Record<string, string> }
  it('list every runtime dependency at its installed version and licence', () => {
    for (const name of Object.keys(pkg.dependencies)) {
      const meta = JSON.parse(readFileSync(resolve(root, 'node_modules', name, 'package.json'), 'utf8')) as { version: string; license: string }
      const n = NOTICES.find(x => x.name === name)
      expect(n, `${name} is missing: run node src/features/legal/gen-notices.mjs`).toBeTruthy()
      expect(n!.version, `${name} was upgraded: run node src/features/legal/gen-notices.mjs`).toBe(meta.version)
      expect(n!.license).toBe(meta.license)
    }
    for (const bundled of ['scheduler', 'react-router']) expect(NOTICES.some(n => n.name === bundled)).toBe(true)
  })
  it('carry the full licence texts, the copyrights and Dexie’s NOTICE', () => {
    for (const n of NOTICES) {
      expect(LICENSE_TEXTS[n.text]?.length).toBeGreaterThan(300)
      expect(n.copyright.length).toBeGreaterThan(0)
    }
    expect(NOTICES.find(n => n.name === 'dexie')!.notice).toContain('Apache License')
    expect(LICENSE_TEXTS[NOTICES.find(n => n.name === 'dexie')!.text]).toContain('TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION')
    const fonts = NOTICES.filter(n => n.kind === 'font')
    expect(fonts.length).toBe(8)
    for (const f of fonts) expect(LICENSE_TEXTS[f.text]).toContain('SIL OPEN FONT LICENSE Version 1.1')
  })
})
