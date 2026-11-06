// Counted strings with real plural forms (Arabic has six: zero, one, two, few, many, other). The shared helper lives in
// src/i18n; this re-export keeps the inventory (and expenses) imports working.
export { pluralForm as pluralRule, tn } from '@/i18n'
