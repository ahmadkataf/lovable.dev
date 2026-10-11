/** The brand mark: a tooth with a sparkle. Inherits currentColor. */
export function ToothIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5.5c-1.4-1.4-3.5-1.7-5-.6-1.8 1.3-2.1 3.7-1.3 5.8.9 2.4 1.3 5.3 2.1 7 .3.7 1.2.7 1.5 0 .5-1.2.8-2.9 1.3-4 .3-.8 1.3-.8 1.6 0 .5 1.1.8 2.8 1.3 4 .3.7 1.2.7 1.5 0 .8-1.7 1.2-4.6 2.1-7 .8-2.1.5-4.5-1.3-5.8-1.5-1.1-3.6-.8-5 .6z" />
      <path d="M18.5 3.5v2M17.5 4.5h2" strokeWidth="1.6" />
    </svg>
  )
}
