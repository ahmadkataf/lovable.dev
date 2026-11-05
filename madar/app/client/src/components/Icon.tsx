/* Inline stroke icons (same drawing style as the pitch site). */

const PATHS: Record<string, string> = {
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 4 3 5-6"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
  wifi: '<path d="M5 12.6a11 11 0 0 1 14 0M8.5 16a6 6 0 0 1 7 0M2 8.8a16 16 0 0 1 20 0"/><circle cx="12" cy="19.5" r="1"/>',
  wifioff: '<path d="M2 8.8a16 16 0 0 1 20 0M5 12.6a11 11 0 0 1 14 0M8.5 16a6 6 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1"/><path d="M3 3l18 18"/>',
  msg: '<path d="M21 12a8 8 0 0 1-8 8H6l-3 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  alert: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  layers: '<path d="M12 2l10 5-10 5L2 7l10-5z"/><path d="M2 12l10 5 10-5M2 17l10 5 10-5"/>',
  star: '<path d="M12 2l3 7 7 .8-5.2 4.8L18.5 22 12 18.3 5.5 22l1.7-7.4L2 9.8 9 9l3-7z"/>',
  building: '<path d="M3 21h18M5 21V7l7-4 7 4v14"/><path d="M9 21v-5h6v5M9 10h.01M15 10h.01M9 14h.01M15 14h.01"/>',
  school: '<path d="M2 10l10-6 10 6-10 6L2 10z"/><path d="M6 12v5c0 1.5 3 3 6 3s6-1.5 6-3v-5M22 10v6"/>',
  teacher: '<rect x="2" y="3" width="20" height="13" rx="2"/><path d="M8 21h8M12 16v5"/><path d="M7 11l3-3 2 2 4-4"/>',
  student: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  parent: '<path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/>',
  send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>',
  home: '<path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V11z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M9 6l6 6-6 6"/>',
  forward: '<path d="M15 6l-6 6 6 6"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1z"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  flag: '<path d="M4 22V4a1 1 0 0 1 1-1h11l-1.5 4L16 11H5"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15 9a3 3 0 0 1 0 6M18 6a7 7 0 0 1 0 12"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  swap: '<path d="M7 16V4m0 0L3 8m4-4l4 4"/><path d="M17 8v12m0 0l4-4m-4 4l-4-4"/>',
  pin: '<path d="M12 22s7-7 7-12a7 7 0 1 0-14 0c0 5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, className, title }: { name: string; className?: string; title?: string }) {
  const d = PATHS[name] ?? PATHS.info;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === 'check' ? 3 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      className={className}
      dangerouslySetInnerHTML={{ __html: (title ? `<title>${title}</title>` : '') + d }}
    />
  );
}

/** The app mark (madar/site/icon.svg). */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#f3f7fd" />
      <circle cx="32" cy="32" r="22" fill="none" stroke="#2a5bea" strokeWidth="2.6" strokeDasharray="4 5" />
      <circle cx="32" cy="32" r="12" fill="#2a5bea" opacity=".15" />
      <circle cx="32" cy="32" r="7" fill="#2a5bea" />
      <circle cx="32" cy="10" r="4.5" fill="#f0a020" />
      <circle cx="54" cy="32" r="3.8" fill="#14a3b4" />
      <circle cx="32" cy="54" r="3.8" fill="#e85d8d" />
      <circle cx="10" cy="32" r="3.8" fill="#7a5cff" />
    </svg>
  );
}
