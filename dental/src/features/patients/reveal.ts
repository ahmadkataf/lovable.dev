// After a failed save, a tall form (a bottom sheet on a phone) must show what is wrong: the first invalid field is
// scrolled to the middle of its scroll box and focused, once React has rendered the error messages.

const INVALID = '.invalid, [aria-invalid="true"], .field-error, .ch-field-error'
const FOCUSABLE = 'input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Scrolls the first invalid field inside `root` into view and focuses it. Returns false when there is none. */
export function revealNow(root: ParentNode | null | undefined): boolean {
  const bad = root?.querySelector<HTMLElement>(INVALID)
  if (!bad) return false
  const field = bad.closest<HTMLElement>('.field') ?? bad
  field.scrollIntoView({ block: 'center', behavior: 'smooth' })
  const target = bad.matches(FOCUSABLE) ? bad : field.querySelector<HTMLElement>(FOCUSABLE)
  target?.focus({ preventScroll: true })
  return true
}

/** The same, two frames later (after the render that shows the errors). */
export function revealFirstError(root: () => ParentNode | null | undefined): void {
  requestAnimationFrame(() => requestAnimationFrame(() => { revealNow(root()) }))
}
