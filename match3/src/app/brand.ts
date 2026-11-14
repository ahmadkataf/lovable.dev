/**
 * Brand constants — the one place the game's public name lives.
 * (The Android app label lives in the strings.xml files of the android project.)
 */
export const BRAND = {
  /** Short wordmark shown in the logo. */
  name: { en: 'Zumurud', ar: 'زمرد' },
  /** Descriptive tail shown under the wordmark. */
  tagline: { en: 'Gem Match Puzzle', ar: 'لعبة تطابق الجواهر' },
  /** Android applicationId (must match android/gradle.properties APP_ID). */
  appId: 'com.zumurud.game',
} as const;
