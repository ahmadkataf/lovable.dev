// Appearance preferences that must apply before React renders (so there is no flash): font family.
export type FontKey = 'kufi' | 'sans' | 'cairo' | 'readex' | 'almarai' | 'tajawal' | 'plex'
export const FONT_OPTIONS: { key: FontKey; label: string; sample: string }[] = [
  { key: 'kufi', label: 'Noto Kufi Arabic', sample: 'عيادة الابتسامة لطب الأسنان' },
  { key: 'sans', label: 'Noto Sans Arabic', sample: 'عيادة الابتسامة لطب الأسنان' },
  { key: 'cairo', label: 'Cairo', sample: 'عيادة الابتسامة لطب الأسنان' },
  { key: 'readex', label: 'Readex Pro', sample: 'عيادة الابتسامة لطب الأسنان' },
  { key: 'almarai', label: 'Almarai', sample: 'عيادة الابتسامة لطب الأسنان' },
  { key: 'tajawal', label: 'Tajawal', sample: 'عيادة الابتسامة لطب الأسنان' },
  { key: 'plex', label: 'IBM Plex Sans Arabic', sample: 'عيادة الابتسامة لطب الأسنان' },
]
const KEY = 'dentora.font'
export function currentFont(): FontKey {
  try { const v = localStorage.getItem(KEY) as FontKey | null; if (v && FONT_OPTIONS.some(o => o.key === v)) return v } catch { /* ignore */ }
  return 'kufi'
}
export function applyFont(key: FontKey): void {
  document.documentElement.dataset.font = key
  try { localStorage.setItem(KEY, key) } catch { /* ignore */ }
}
export function initTheme(): void { document.documentElement.dataset.font = currentFont() }
