// The lock screen and PIN lengths. A PIN is 4 to 6 digits (Settings → Users). Up to 1.0.1 the lock screen checked
// after the 4th digit and showed 4 dots, so a 5- or 6-digit PIN could never be entered and the shop was locked out.
// Since 1.0.2 the length is kept with the PIN (`pinLen`); a PIN set before that has none, and the lock screen then
// tries after the 4th, 5th and 6th digit and remembers the length once the PIN is right.

export const PIN_MIN = 4
export const PIN_MAX = 6
/** After a wrong try of a PIN of unknown length, how long to wait for more digits before saying "wrong". */
export const PIN_WAIT_MS = 1500

/** The user's PIN length when it is known. */
export function knownPinLength(u: { pinLen?: unknown } | null | undefined): number | undefined {
  const n = u?.pinLen
  return typeof n === 'number' && Number.isInteger(n) && n >= PIN_MIN && n <= PIN_MAX ? n : undefined
}

/** What the lock screen does with the digits typed so far:
 *  'type'  — not enough digits yet;
 *  'check' — compare now, and a wrong PIN is final (say so, start over);
 *  'try'   — compare now, but a wrong PIN may still be the start of a longer one (length unknown): wait for more. */
export function pinStep(typed: number, len?: number): 'type' | 'check' | 'try' {
  if (len) return typed >= len ? 'check' : 'type'
  if (typed < PIN_MIN) return 'type'
  return typed >= PIN_MAX ? 'check' : 'try'
}

/** How many dots to show: the PIN's length when known, otherwise 4, growing as a longer PIN is typed. */
export function pinDots(typed: number, len?: number): number {
  return len ?? Math.min(PIN_MAX, Math.max(PIN_MIN, typed))
}
