/**
 * i18n contract. Two languages, English and Arabic (RTL). Strings live in namespace files under
 * ./strings/ — each exports `{ en: Record<string,string>, ar: Record<string,string> }` with identical
 * key sets (a test enforces this). Keys are dotted, e.g. "play.movesLeft".
 * Placeholders use {name}: t('play.needMore', { n: 3 }).
 * Digits are always Western (0-9) in both languages.
 */
export type Lang = 'en' | 'ar';

export type StringTable = { en: Record<string, string>; ar: Record<string, string> };

export interface I18nApi {
  lang(): Lang;
  /** Switch language: updates <html lang dir> and notifies subscribers. */
  setLang(lang: Lang): void;
  isRtl(): boolean;
  /** Translate; unknown keys return the key itself (and warn in dev). */
  t(key: string, vars?: Record<string, string | number>): string;
  /** 12345 → "12,345" (Western digits). */
  num(n: number): string;
  /** Milliseconds → "mm:ss". */
  clock(ms: number): string;
  onChange(listener: (lang: Lang) => void): () => void;
}
