/* Tiny history-API router (no dependency). */

import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';

export interface Route { path: string; query: URLSearchParams; key: number }

let version = 0;
const subs = new Set<() => void>();
let current: Route = read();

function read(): Route {
  return { path: window.location.pathname.replace(/\/+$/, '') || '/', query: new URLSearchParams(window.location.search), key: version };
}
function update() {
  version++;
  current = read();
  subs.forEach((fn) => fn());
}
window.addEventListener('popstate', update);

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  const target = new URL(to, window.location.origin);
  const same = target.pathname === window.location.pathname && target.search === window.location.search;
  if (opts.replace || same) window.history.replaceState(null, '', target.pathname + target.search);
  else window.history.pushState(null, '', target.pathname + target.search);
  update();
  if (!same) window.scrollTo({ top: 0 });
}

export function back(fallback: string) {
  if (window.history.length > 1) window.history.back();
  else navigate(fallback);
}

export function useRoute(): Route {
  return useSyncExternalStore((fn) => { subs.add(fn); return () => subs.delete(fn); }, () => current, () => current);
}

/** Match «/teacher/homework/:id» against a path; returns the params or null. */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const s = path.split('/').filter(Boolean);
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return params;
}

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> { to: string; replace?: boolean }

export function Link({ to, replace, onClick, children, ...rest }: LinkProps) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to, { replace });
  };
  return <a href={to} onClick={handle} {...rest}>{children}</a>;
}
