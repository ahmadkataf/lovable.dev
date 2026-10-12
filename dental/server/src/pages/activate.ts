// /activate and /en/activate: a clinic turns a licence key into its activation code (docs/LICENCE-KEYS.md).
// Placeholder so the router compiles; the page itself is written separately.
import type { PageAssets } from './legal'
import type { Lang, SiteSettings } from '../types'

export function renderActivate(lang: Lang, _s: SiteSettings, _origin: string, _assets: PageAssets, _device: string): string {
  return `<!doctype html><html lang="${lang}"><meta charset="utf-8"><title>Dentora</title></html>`
}
