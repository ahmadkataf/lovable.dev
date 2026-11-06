/* Public app configuration — GET /api/config (no auth): the support contact shown on the login screen and in the
   shell footer, the demo flag and the hour the demo data is reseeded. Fetched once per page load (memoised), kept
   in localStorage for the next start, with safe defaults when the server lacks the route or does not answer within
   3 s. Mock builds (VITE_MOCK=1) never fetch. Also holds the presenter's reset call (POST /api/admin/reseed). */

import { useEffect, useState } from 'react';
import { resetMockData } from './api';
import { arDigits, count, NOUNS } from './format';

export interface AppConfig {
  support_phone: string;
  support_hours: string;
  demo: boolean;
  /** «HH:MM» Damascus time at which the demo data is reseeded. */
  reseed_hour: string;
  app_url: string;
}

export const DEFAULT_CONFIG: AppConfig = { support_phone: '', support_hours: '', demo: true, reseed_hour: '06:00', app_url: '' };

const MOCK = import.meta.env.VITE_MOCK === '1';
const KEY = 'config';
const TIMEOUT_MS = 3000;

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Keep only the known fields, each with a safe type (the server may send empty strings). */
function sanitise(raw: unknown): AppConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const hour = str(r.reseed_hour);
  return {
    support_phone: str(r.support_phone),
    support_hours: str(r.support_hours),
    demo: typeof r.demo === 'boolean' ? r.demo : DEFAULT_CONFIG.demo,
    reseed_hour: /^\d{1,2}:\d{2}$/.test(hour) ? hour : DEFAULT_CONFIG.reseed_hour,
    app_url: str(r.app_url),
  };
}

function readStored(): AppConfig | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sanitise(JSON.parse(raw)) : null;
  } catch { return null; }
}

let current: AppConfig = MOCK ? DEFAULT_CONFIG : (readStored() ?? DEFAULT_CONFIG);
let settled = false;                       // the server answered (or said it has no such route) in this page load
let pending: Promise<AppConfig> | null = null;
const listeners = new Set<(c: AppConfig) => void>();

/** What is known right now (the stored copy or the defaults) — synchronous, for the first render. */
export function peekConfig(): AppConfig {
  return current;
}

/** Fetch /api/config once; later calls return the same result. Falls back to the stored copy, then to the defaults. */
export function getConfig(): Promise<AppConfig> {
  if (MOCK || settled) return Promise.resolve(current);
  if (pending) return pending;
  pending = (async () => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch('/api/config', { signal: ctl.signal, headers: { accept: 'application/json' }, credentials: 'omit' });
      if (res.ok && (res.headers.get('content-type') ?? '').includes('json')) {
        current = sanitise(await res.json());
        settled = true;
        try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* quota / private mode */ }
        listeners.forEach((fn) => fn(current));
      } else if (res.status === 404 || res.ok) {
        settled = true;                    // no such route yet (404, or the SPA shell came back): the defaults stand for this page load
      }
    } catch {
      /* offline or slow: the stored copy / defaults stand; a later call may retry */
    } finally {
      clearTimeout(timer);
      pending = null;
    }
    return current;
  })();
  return pending;
}

/** React hook: the known configuration at once, refreshed when /api/config answers. */
export function useConfig(): AppConfig {
  const [cfg, setCfg] = useState<AppConfig>(current);
  useEffect(() => {
    let alive = true;
    const onChange = (c: AppConfig) => { if (alive) setCfg(c); };
    listeners.add(onChange);
    void getConfig().then(onChange);
    return () => { alive = false; listeners.delete(onChange); };
  }, []);
  return cfg;
}

/** «٦:٠٠» from «06:00» (empty when the hour is unknown). */
export function reseedHourLabel(hour: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hour.trim());
  if (!m) return '';
  return `${arDigits(Number(m[1]))}:${arDigits(m[2])}`;
}

/* ───────── presenter reset ───────── */

export class ReseedError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Reset the shared demo data: POST /api/admin/reseed with the presenter's key in `x-admin-key` (sent once, never
    stored). Resolves with the row counts the server reports. In a mock build the in-memory demo is reset instead. */
export async function reseedDemo(key: string): Promise<Record<string, number>> {
  if (MOCK) {
    await resetMockData();
    return {};
  }
  let res: Response;
  try {
    res = await fetch('/api/admin/reseed', { method: 'POST', headers: { 'x-admin-key': key, accept: 'application/json' }, credentials: 'omit' });
  } catch {
    throw new ReseedError(0, 'لا اتصال بالخادم');
  }
  if (res.status === 401 || res.status === 403) throw new ReseedError(res.status, 'المفتاح غير صحيح');
  if (res.status === 429) throw new ReseedError(429, 'محاولات كثيرة، حاول بعد دقيقة');
  if (!res.ok) throw new ReseedError(res.status, 'تعذّر إعادة ضبط بيانات العرض، حاول مجدّداً');
  try {
    const data = (await res.json()) as unknown;
    const counts: Record<string, number> = {};
    if (data && typeof data === 'object') {
      for (const [k, v] of Object.entries(data as Record<string, unknown>)) if (typeof v === 'number' && v >= 0) counts[k] = v;
    }
    return counts;
  } catch { return {}; }
}

/** «أُعيد ضبط بيانات العرض (٣ مدارس · ٥٢ طالباً · ١٢ واجباً…)» from the counts the server returns. */
export function reseedToast(counts: Record<string, number>): string {
  const parts: string[] = [];
  if (counts.schools) parts.push(count(counts.schools, NOUNS.school));
  if (counts.students) parts.push(count(counts.students, NOUNS.student));
  if (counts.homework) parts.push(count(counts.homework, NOUNS.homework));
  const more = Object.keys(counts).length > parts.length;
  return parts.length ? `أُعيد ضبط بيانات العرض (${parts.join(' · ')}${more ? '…' : ''})` : 'أُعيد ضبط بيانات العرض';
}
