/**
 * Brand constants — the one place the game's public name lives.
 * (The Android app label lives in the strings.xml files of the android project.)
 */
export const BRAND = {
  /** Short wordmark shown in the logo. */
  name: { en: 'Jawhara', ar: 'جوهرة' },
  /** Descriptive tail shown under the wordmark. */
  tagline: { en: 'Gem Match Puzzle', ar: 'لعبة تطابق الجواهر' },
} as const;
