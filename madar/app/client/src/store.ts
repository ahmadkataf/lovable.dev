/* Small app store (useSyncExternalStore): session, connectivity, outbox, toast. */

import { useSyncExternalStore } from 'react';
import * as api from './api';
import { DEMO_ACCOUNTS } from './demo';
import { count, NOUNS } from './format';
import { roleHomePath } from './links';
import type { Context, Me, Notification, Role, User } from './types';

export interface Toast { id: number; text: string; kind: 'ok' | 'error' | 'info' }

export interface State {
  booted: boolean;
  token: string | null;
  user: User | null;
  context: Context | null;
  code: string | null;
  mock: boolean;
  demo: boolean;
  online: boolean;
  fromCache: boolean;
  outbox: number;              // writes waiting to be sent
  rejected: api.OutboxItem[];  // writes the server refused, waiting for a retry or a discard
  unread: number;
  toast: Toast | null;
}

const DEMO_CODES = new Set(DEMO_ACCOUNTS.map((a) => a.code));

const initialOutbox = api.outboxState();
let state: State = {
  booted: false,
  token: api.getToken(),
  user: api.getStoredUser(),
  context: null,
  code: api.getStoredCode(),
  mock: api.isMock(),
  demo: false,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  fromCache: false,
  outbox: initialOutbox.pending,
  rejected: initialOutbox.rejected,
  unread: 0,
  toast: null,
};
state.demo = computeDemo();

const subs = new Set<() => void>();
function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  subs.forEach((fn) => fn());
}
function computeDemo(): boolean {
  return state.mock || (!!state.code && DEMO_CODES.has(state.code));
}

export function useStore(): State {
  return useSyncExternalStore((fn) => { subs.add(fn); return () => subs.delete(fn); }, () => state, () => state);
}
export function getState(): State {
  return state;
}

let toastSeq = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(text: string, kind: Toast['kind'] = 'ok', ms = 3600) {
  clearTimeout(toastTimer);
  const id = ++toastSeq;
  set({ toast: { id, text, kind } });
  toastTimer = setTimeout(() => { if (state.toast?.id === id) set({ toast: null }); }, ms);
}
export function hideToast() {
  set({ toast: null });
}

export async function refreshMe(): Promise<void> {
  if (!state.token) return;
  try {
    const me = await api.get<Me>('/api/me');
    set({ user: me.user, context: me.context });
    try { localStorage.setItem('user', JSON.stringify(me.user)); } catch { /* ignore */ }
  } catch (e) {
    if (e instanceof api.ApiError && e.status === 401) return; // handled by the unauthorized event
    if (e instanceof api.ApiError && e.offline && state.user) return; // keep the stored user offline
    throw e;
  }
}

export async function refreshUnread(): Promise<void> {
  if (!state.token) return;
  try {
    const list = await api.get<Notification[]>('/api/notifications');
    set({ unread: list.filter((n) => !n.read_at).length });
  } catch { /* offline without cache: keep the last count */ }
}

export async function boot(): Promise<void> {
  if (state.token) {
    try { await refreshMe(); } catch { /* shown on the screens */ }
    void refreshUnread();
  }
  set({ booted: true, mock: api.isMock() });
  set({ demo: computeDemo() });
}

export async function signIn(code: string): Promise<User> {
  const res = await api.login(code);
  api.setSession(res.token, res.user, code, res.viaMock);
  state = { ...state, token: res.token, user: res.user, context: null, code: code.trim().toUpperCase(), mock: api.isMock(), fromCache: false, unread: 0 };
  set({ demo: computeDemo() });
  try { await refreshMe(); } catch { /* ignore */ }
  void refreshUnread();
  if (res.viaMock && !api.MOCK_ENV) toast('الخادم غير متاح — تُستخدم بيانات تجريبية محلية', 'info', 5000);
  return res.user;
}

export function signOut() {
  api.clearSession();
  set({ token: null, user: null, context: null, code: null, mock: api.isMock(), demo: api.isMock(), unread: 0, fromCache: false });
}

export function roleHome(role: Role | undefined | null): string {
  return roleHomePath(role);
}

/** «أُرسلت عملية واحدة معلّقة» / «أُرسلت عمليتان معلّقتان» / «أُرسلت ٣ عمليات معلّقة». */
export function replayedText(n: number): string {
  if (n === 2) return 'أُرسلت عمليتان معلّقتان';
  return `أُرسلت ${count(n, NOUNS.operation)} معلّقة`;
}

/* connectivity + api events */
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => set({ online: true }));
  window.addEventListener('offline', () => set({ online: false }));
  api.onApi('from-cache', () => set({ fromCache: true }));
  api.onApi('fresh', () => { if (state.fromCache) set({ fromCache: false }); });
  api.onApi('outbox', (d) => { const s = d as api.OutboxState; set({ outbox: s.pending, rejected: s.rejected }); });
  api.onApi('unauthorized', () => {
    if (state.token) {
      signOut();
      toast(api.SESSION_EXPIRED, 'error');
    }
  });
  api.onApi('outbox-error', (msg) => toast(String(msg), 'error', 6000));
  api.onApi('replayed', (n) => toast(replayedText(Number(n)), 'ok'));
}
