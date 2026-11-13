/**
 * The browser-only test store: a MonetizeBridge that pretends to be the Android wrapper. It answers
 * with the same JSON StoreEvents, so everything it "sells" goes through the one grant path of
 * ./store.ts. Purchases and ads are confirmed in small overlays labelled TEST STORE / TEST AD.
 *
 * It keeps a pretend store account (which entitlements are owned, which purchases are paid but not
 * finished yet, which payments are pending) so that restores, re-deliveries and pending payments
 * can be tried across page reloads.
 *
 * Never part of a real build's behaviour: `createStore` (./index.ts) refuses to use it whenever
 * the Android bridge exists.
 */
import type { MonetizeBridge, StoreEvent } from './types.ts';
import { FAKE_PRICES, productDef } from './catalog.ts';

/** How a tester answers the pretend purchase sheet. */
export type FakePurchaseChoice = 'buy' | 'pending' | 'cancel';

/** The overlays, behind an interface so tests can script the answers. */
export interface FakeUi {
  purchase(info: { id: string; price: string }): Promise<FakePurchaseChoice>;
  /** Resolves true when the ad was watched to the end, false when it was closed early. */
  ad(format: 'rewarded' | 'interstitial', placement: string | null): Promise<boolean>;
  privacy(): Promise<void>;
}

export interface FakeStorage {
  read(): string | null;
  write(text: string): void;
}

export interface FakeBridgeDeps {
  /** Receives every StoreEvent as JSON text — the same thing `window.__native.store` receives. */
  emit(json: string): void;
  ui: FakeUi;
  /** Where the pretend account lives between page loads (optional: memory only). */
  storage?: FakeStorage;
  /** Run something a moment later, like a real bridge answers. Default: setTimeout 0. */
  defer?(fn: () => void): void;
  /**
   * Entitlements the player's save already holds when the test store starts: the pretend account
   * owns them too, so starting from a prepared save (`?save=…`) does not "refund" them.
   */
  alreadyOwned?: readonly string[];
}

/** localStorage key of the pretend account. */
export const FAKE_ACCOUNT_KEY = 'match3.fakestore.v1';
/** How long a test ad must stay open to count as watched. */
export const FAKE_AD_MS = 1500;

interface FakeAccount {
  /** Entitlements bought and acknowledged. */
  owned: string[];
  /** Paid, not yet finished by the game. */
  open: { id: string; token: string }[];
  /** "Pay later": completes at the next restore. */
  pending: { id: string; token: string }[];
  seq: number;
}

function readAccount(storage: FakeStorage | undefined): FakeAccount {
  const account: FakeAccount = { owned: [], open: [], pending: [], seq: 0 };
  try {
    const raw = storage ? storage.read() : null;
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (typeof parsed !== 'object' || parsed === null) return account;
    const o = parsed as Record<string, unknown>;
    const purchases = (v: unknown): { id: string; token: string }[] => {
      const out: { id: string; token: string }[] = [];
      if (!Array.isArray(v)) return out;
      for (const item of v as unknown[]) {
        if (typeof item !== 'object' || item === null) continue;
        const p = item as Record<string, unknown>;
        if (typeof p.id === 'string' && typeof p.token === 'string' && productDef(p.id)) out.push({ id: p.id, token: p.token });
      }
      return out;
    };
    if (Array.isArray(o.owned)) for (const id of o.owned as unknown[]) if (typeof id === 'string' && productDef(id) && account.owned.indexOf(id) < 0) account.owned.push(id);
    account.open = purchases(o.open);
    account.pending = purchases(o.pending);
    if (typeof o.seq === 'number' && o.seq >= 0 && isFinite(o.seq)) account.seq = Math.floor(o.seq);
  } catch {
    // unreadable: an empty account
  }
  return account;
}

export function createFakeBridge(deps: FakeBridgeDeps): MonetizeBridge {
  const account = readAccount(deps.storage);
  for (const id of deps.alreadyOwned || []) {
    const def = productDef(id);
    if (def && def.kind === 'entitlement' && account.owned.indexOf(def.id) < 0) account.owned.push(def.id);
  }
  const later = deps.defer || ((fn: () => void): void => void setTimeout(fn, 0));
  let sheetOpen = false;
  let adOpen = false;

  function save(): void {
    try {
      if (deps.storage) deps.storage.write(JSON.stringify(account));
    } catch {
      // the account then lives in memory only
    }
  }

  function emit(event: StoreEvent): void {
    later(() => deps.emit(JSON.stringify(event)));
  }

  function emitAds(): void {
    emit({ type: 'ads', canRequestAds: true, rewardedReady: true, interstitialReady: true, privacyOptionsRequired: true });
  }

  function has(list: { id: string }[], id: string): boolean {
    for (const p of list) if (p.id === id) return true;
    return false;
  }

  function newToken(id: string): string {
    account.seq += 1;
    return 'fake.' + id + '.' + account.seq + '.' + Date.now().toString(36);
  }

  return {
    storeCaps(): string {
      return '{"billing":true,"ads":true}';
    },

    storeSync(): void {
      emitAds();
    },

    iapQuery(idsJson: string): void {
      const products: { id: string; price: string }[] = [];
      try {
        const ids: unknown = JSON.parse(idsJson);
        if (Array.isArray(ids)) {
          for (const item of ids as unknown[]) {
            const id = typeof item === 'object' && item !== null ? (item as Record<string, unknown>).id : null;
            const def = productDef(id);
            if (def) products.push({ id: def.id, price: FAKE_PRICES[def.id] });
          }
        }
      } catch {
        // a broken request gets an empty answer
      }
      emit({ type: 'products', products });
    },

    iapBuy(id: string): void {
      const def = productDef(id);
      if (!def) {
        emit({ type: 'purchase', id: String(id), state: 'unavailable' });
        return;
      }
      if (def.kind === 'entitlement' && (account.owned.indexOf(def.id) >= 0 || has(account.open, def.id) || has(account.pending, def.id))) {
        emit({ type: 'purchase', id: def.id, state: 'alreadyOwned' });
        return;
      }
      if (sheetOpen) {
        emit({ type: 'purchase', id: def.id, state: 'error' });
        return;
      }
      sheetOpen = true;
      const done = (choice: FakePurchaseChoice): void => {
        sheetOpen = false;
        if (choice === 'buy') {
          const token = newToken(def.id);
          account.open.push({ id: def.id, token });
          save();
          emit({ type: 'purchase', id: def.id, state: 'purchased', token, acknowledged: false });
        } else if (choice === 'pending') {
          account.pending.push({ id: def.id, token: newToken(def.id) });
          save();
          emit({ type: 'purchase', id: def.id, state: 'pending' });
        } else {
          emit({ type: 'purchase', id: def.id, state: 'cancelled' });
        }
      };
      deps.ui.purchase({ id: def.id, price: FAKE_PRICES[def.id] }).then(done, () => done('cancel'));
    },

    iapFinish(token: string): void {
      for (let i = 0; i < account.open.length; i++) {
        const p = account.open[i]!;
        if (p.token !== token) continue;
        account.open.splice(i, 1);
        const def = productDef(p.id);
        if (def && def.kind === 'entitlement' && account.owned.indexOf(def.id) < 0) account.owned.push(def.id);
        save();
        return;
      }
    },

    iapRestore(): void {
      // A pending payment "completes" when the store is asked again.
      if (account.pending.length > 0) {
        account.open = account.open.concat(account.pending);
        account.pending = [];
        save();
      }
      emit({ type: 'owned', ids: account.owned.slice(), complete: true });
      for (const p of account.open) emit({ type: 'purchase', id: p.id, state: 'purchased', token: p.token, acknowledged: false });
    },

    adShowRewarded(placement: string): void {
      if (adOpen) {
        emit({ type: 'adResult', format: 'rewarded', result: 'failed' });
        return;
      }
      adOpen = true;
      const done = (watched: boolean): void => {
        adOpen = false;
        emit({ type: 'adResult', format: 'rewarded', result: watched ? 'earned' : 'dismissed' });
        emitAds();
      };
      deps.ui.ad('rewarded', placement).then(done, () => done(false));
    },

    adShowInterstitial(): void {
      if (adOpen) {
        emit({ type: 'adResult', format: 'interstitial', result: 'failed' });
        return;
      }
      adOpen = true;
      const done = (): void => {
        adOpen = false;
        emit({ type: 'adResult', format: 'interstitial', result: 'dismissed' });
        emitAds();
      };
      deps.ui.ad('interstitial', null).then(done, done);
    },

    adPrivacyOptions(): void {
      deps.ui.privacy().then(emitAds, emitAds);
    },
  };
}

// ───────────────────────────── the overlays (DOM) ─────────────────────────────
// Self-contained on purpose: inline styles only, no dependency on the UI kit or on i18n — this is a
// tester's tool, always in English, always left-to-right, and visibly not part of the game.

const FONT = 'font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;';
const BACKDROP =
  'position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;' +
  'padding:16px;box-sizing:border-box;direction:ltr;text-align:center;' +
  FONT;
const BUTTON =
  'display:block;width:100%;min-height:48px;margin:10px 0 0;padding:10px 16px;box-sizing:border-box;border-radius:10px;' +
  'font-size:16px;font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent;' +
  FONT;

/** The white card of the purchase / privacy sheets; scrolls inside very low (landscape) screens. */
const PANEL =
  'width:100%;max-width:340px;max-height:100%;overflow-y:auto;padding:18px;box-sizing:border-box;border-radius:14px;' +
  'background:#ffffff;color:#1b1b1f;border:3px dashed #d2372c;';

function make(doc: Document, tag: string, style: string, text?: string, testId?: string): HTMLElement {
  const el = doc.createElement(tag);
  el.setAttribute('style', style);
  if (text !== undefined) el.textContent = text;
  if (testId) el.setAttribute('data-testid', testId);
  return el;
}

function button(doc: Document, label: string, testId: string, style: string): HTMLButtonElement {
  const el = make(doc, 'button', BUTTON + style, label, testId) as HTMLButtonElement;
  el.type = 'button';
  return el;
}

function mount(doc: Document, root: HTMLElement): () => void {
  (doc.body || doc.documentElement).appendChild(root);
  return () => {
    if (root.parentNode) root.parentNode.removeChild(root);
  };
}

/** The overlays built with plain DOM calls on the given document. */
export function createFakeDomUi(doc: Document): FakeUi {
  return {
    purchase(info: { id: string; price: string }): Promise<FakePurchaseChoice> {
      return new Promise<FakePurchaseChoice>((resolve) => {
        const root = make(doc, 'div', BACKDROP + 'background:rgba(8,8,24,0.72);', undefined, 'fake-store');
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-label', 'Test store');
        const panel = make(doc, 'div', PANEL + 'box-shadow:0 12px 40px rgba(0,0,0,0.5);');
        panel.appendChild(make(doc, 'div', 'font-size:13px;font-weight:800;letter-spacing:2px;color:#d2372c;', 'TEST STORE'));
        panel.appendChild(make(doc, 'div', 'margin-top:4px;font-size:13px;color:#5a5a66;', 'A simulated purchase. No money is charged.'));
        panel.appendChild(make(doc, 'div', 'margin-top:14px;font-size:18px;font-weight:700;word-break:break-all;', info.id, 'fake-product'));
        panel.appendChild(make(doc, 'div', 'margin-top:2px;font-size:22px;font-weight:800;', info.price, 'fake-price'));
        const buy = button(doc, 'Buy', 'fake-buy', 'border:0;background:#1a8f4c;color:#ffffff;');
        const pending = button(doc, 'Pay later (pending)', 'fake-pending', 'border:2px solid #8a8a99;background:#ffffff;color:#1b1b1f;');
        const cancel = button(doc, 'Cancel', 'fake-cancel', 'border:2px solid #8a8a99;background:#ffffff;color:#1b1b1f;');
        panel.appendChild(buy);
        panel.appendChild(pending);
        panel.appendChild(cancel);
        root.appendChild(panel);
        const unmount = mount(doc, root);
        const answer = (choice: FakePurchaseChoice) => (): void => {
          unmount();
          resolve(choice);
        };
        buy.addEventListener('click', answer('buy'));
        pending.addEventListener('click', answer('pending'));
        cancel.addEventListener('click', answer('cancel'));
      });
    },

    ad(format: 'rewarded' | 'interstitial', placement: string | null): Promise<boolean> {
      return new Promise<boolean>((resolve) => {
        const root = make(doc, 'div', BACKDROP + 'background:#0b0b10;color:#ffffff;', undefined, 'fake-ad');
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-label', 'Test ad');
        root.setAttribute('data-format', format);
        const box = make(doc, 'div', 'width:100%;max-width:340px;max-height:100%;overflow-y:auto;');
        box.appendChild(make(doc, 'div', 'font-size:34px;font-weight:800;letter-spacing:4px;', 'TEST AD'));
        box.appendChild(
          make(doc, 'div', 'margin-top:6px;font-size:14px;color:#b9b9c6;', format === 'rewarded' ? 'Rewarded ad' + (placement ? ' · ' + placement : '') : 'Interstitial ad'),
        );
        const count = make(doc, 'div', 'margin-top:18px;font-size:44px;font-weight:800;', '', 'fake-ad-count');
        box.appendChild(count);
        const skip = button(doc, format === 'rewarded' ? 'Close early (no reward)' : 'Close early', 'fake-ad-skip', 'border:2px solid #8a8a99;background:transparent;color:#ffffff;');
        const close = button(doc, 'Close', 'fake-ad-close', 'border:0;background:#f5c95a;color:#1b1b1f;display:none;');
        box.appendChild(skip);
        box.appendChild(close);
        root.appendChild(box);
        const unmount = mount(doc, root);
        const started = Date.now();
        let ticker: ReturnType<typeof setInterval> | null = null;
        const tick = (): void => {
          const left = FAKE_AD_MS - (Date.now() - started);
          if (left > 0) {
            count.textContent = (Math.ceil(left / 100) / 10).toFixed(1);
            return;
          }
          if (ticker !== null) clearInterval(ticker);
          ticker = null;
          count.textContent = '';
          skip.style.display = 'none';
          close.style.display = 'block';
        };
        const end = (watched: boolean) => (): void => {
          if (ticker !== null) clearInterval(ticker);
          ticker = null;
          unmount();
          resolve(watched);
        };
        skip.addEventListener('click', end(false));
        close.addEventListener('click', end(true));
        tick();
        ticker = setInterval(tick, 100);
      });
    },

    privacy(): Promise<void> {
      return new Promise<void>((resolve) => {
        const root = make(doc, 'div', BACKDROP + 'background:rgba(8,8,24,0.72);', undefined, 'fake-privacy');
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-label', 'Test privacy options');
        const panel = make(doc, 'div', PANEL);
        panel.appendChild(make(doc, 'div', 'font-size:13px;font-weight:800;letter-spacing:2px;color:#d2372c;', 'TEST PRIVACY OPTIONS'));
        panel.appendChild(make(doc, 'div', 'margin-top:8px;font-size:14px;color:#5a5a66;', 'The real consent form of the ad SDK would open here.'));
        const close = button(doc, 'Close', 'fake-privacy-close', 'border:0;background:#1a8f4c;color:#ffffff;');
        panel.appendChild(close);
        root.appendChild(panel);
        const unmount = mount(doc, root);
        close.addEventListener('click', () => {
          unmount();
          resolve();
        });
      });
    },
  };
}

/** The pretend account in localStorage (guarded: storage can be missing or refuse). */
export function fakeLocalStorage(win: Window): FakeStorage {
  return {
    read(): string | null {
      try {
        return win.localStorage.getItem(FAKE_ACCOUNT_KEY);
      } catch {
        return null;
      }
    },
    write(text: string): void {
      try {
        win.localStorage.setItem(FAKE_ACCOUNT_KEY, text);
      } catch {
        // memory only
      }
    },
  };
}
