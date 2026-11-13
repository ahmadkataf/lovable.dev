/**
 * Adversarial fuzz of the store's money path.
 *
 * A pretend Google Play account (the truth about what was paid, what is pending, what was
 * acknowledged, consumed or refunded) is driven by random player actions and random misbehaviour
 * of everything around the store: events duplicated, reordered, stale, malformed or enormous; a
 * bridge that throws, answers inside the call, loses "finish" requests or never answers; a disk
 * that refuses writes loudly or silently; restarts at any moment; listeners that throw and call
 * back into the store. Thousands of StoreEvents per run.
 *
 * An independent ledger (below: `model` — it knows DESIGN §7's numbers by heart and nothing about
 * the implementation) predicts the player's coins and boosters after every single step:
 *
 *   coins == 2,000 + Σ over DISTINCT purchased tokens of what their product grants
 *
 * and these must hold throughout:
 *   - nothing is ever granted without a 'purchased' event (pending / "already owned" grant nothing);
 *   - iapFinish(token) is only ever called for a paid purchase whose grant is ON DISK at that moment;
 *   - an entitlement the account has paid for is never lost within a session, and nobody owns one
 *     that was never paid;
 *   - no exception escapes, whatever happens;
 *   - in the end (disk and bridge healthy again, the store listing its purchases as it does on
 *     every start) every paid purchase is granted exactly once and finished, ownership equals the
 *     account's, and every promise the store ever returned has settled.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ADS_ON, ALL_PRICES, DAY, HOUR, MINUTE, SECOND, newMachine, promiseBook, rng, startSession, veteranSave } from './hardening-kit.ts';
import type { DiskMode, Session } from './hardening-kit.ts';

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ───────────────────────────── DESIGN §7, restated ─────────────────────────────
// Deliberately not imported from src/monetize/catalog.ts: the ledger must not share its mistakes.

interface Pack {
  kind: 'consumable' | 'entitlement';
  coins: number;
  hammer: number;
  freeSwap: number;
  prism: number;
}

const PACKS: Record<string, Pack> = {
  coins_small: { kind: 'consumable', coins: 1000, hammer: 0, freeSwap: 0, prism: 0 },
  coins_medium: { kind: 'consumable', coins: 5500, hammer: 0, freeSwap: 0, prism: 0 },
  coins_large: { kind: 'consumable', coins: 12000, hammer: 0, freeSwap: 0, prism: 0 },
  coins_xl: { kind: 'consumable', coins: 26000, hammer: 0, freeSwap: 0, prism: 0 },
  coins_mega: { kind: 'consumable', coins: 70000, hammer: 0, freeSwap: 0, prism: 0 },
  starter_pack: { kind: 'entitlement', coins: 4000, hammer: 3, freeSwap: 3, prism: 2 },
  remove_ads: { kind: 'entitlement', coins: 0, hammer: 0, freeSwap: 0, prism: 0 },
};
const PRODUCT_IDS = Object.keys(PACKS);
const ENTITLEMENTS = PRODUCT_IDS.filter((id) => PACKS[id]!.kind === 'entitlement');
const START_COINS = 2000;
/** The longest purchase token the game accepts (the wrapper refuses longer ones too). */
const MAX_TOKEN = 4096;
/** Tokens the profile remembers; a run stays below it, so "forgotten" never explains anything. */
const MAX_PURCHASES = 150;

function packOf(id: unknown): Pack | null {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(PACKS, id) ? PACKS[id]! : null;
}

/** Units of a multi-quantity purchase: whole, 1..100; anything else is one. */
function unitsOf(quantity: unknown): number {
  if (typeof quantity !== 'number' || !isFinite(quantity) || quantity < 2) return 1;
  return Math.min(100, Math.floor(quantity));
}

// ───────────────────────────── the pretend store account ─────────────────────────────

interface Bought {
  token: string;
  id: string;
  kind: 'consumable' | 'entitlement';
  /** false = the payment is still pending */
  paid: boolean;
  /** consumed (consumable) / acknowledged (entitlement) */
  done: boolean;
  /** an entitlement another install bought and acknowledged: restored here, never granted here */
  elsewhere: boolean;
  refunded: boolean;
  /** the raw `quantity` every event of this purchase carries (undefined = the field is absent) */
  quantity: unknown;
  finishCalls: number;
}

interface Ledger {
  coins: number;
  hammer: number;
  freeSwap: number;
  prism: number;
  /** tokens whose grant the profile holds */
  known: Set<string>;
}

function copy(l: Ledger): Ledger {
  return { coins: l.coins, hammer: l.hammer, freeSwap: l.freeSwap, prism: l.prism, known: new Set(l.known) };
}

interface Stats {
  events: number;
  grants: number;
  finishes: number;
  restarts: number;
  purchases: number;
  syncDeliveries: number;
  silentWritesLost: number;
  finishWithheld: number;
  promises: number;
  bridgeThrows: number;
  resets: number;
  refunds: number;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

async function fuzz(seed: number, steps: number, withResets: boolean): Promise<Stats> {
  const rand = rng(seed);
  const chance = (p: number): boolean => rand() < p;
  const int = (min: number, max: number): number => min + Math.floor(rand() * (max - min + 1));
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)]!;

  const stats: Stats = { events: 0, grants: 0, finishes: 0, restarts: 0, purchases: 0, syncDeliveries: 0, silentWritesLost: 0, finishWithheld: 0, promises: 0, bridgeThrows: 0, resets: 0, refunds: 0 };
  /** To follow one run step by step: FUZZ_TRACE=<seed> npx vitest run tests/monetize/hardening-fuzz.test.ts */
  const tracing = typeof process !== 'undefined' && process.env.FUZZ_TRACE === String(seed);
  const problems: string[] = [];
  let stepNo = 0;
  const fail = (what: string): void => {
    if (problems.length < 5) problems.push('seed ' + seed + ' step ' + stepNo + ': ' + what);
  };

  const machine = newMachine({ save: veteranSave(29, 10) });
  const book = promiseBook();

  // the account
  const account: Bought[] = [];
  const byToken = new Map<string, Bought>();
  const everPaid = new Set<string>();
  let serial = 0;

  // the ledger: what the profile must hold in memory, and what the disk must hold
  let model: Ledger = { coins: START_COINS, hammer: 0, freeSwap: 0, prism: 0, known: new Set() };
  let persisted: Ledger = copy(model);
  machine.disk.onWrite = () => {
    persisted = copy(model);
  };
  /** Entitlements granted by a 'purchased' event in the current session. */
  let boughtThisSession = new Set<string>();
  /** Entitlements the profile was seen to own in the current session. */
  let seenOwned = new Set<string>();

  // misbehaviour switches
  let bridgeThrows = false;
  let finishesLost = false;
  let syncBridge = false;
  let reentrantListeners = true;

  /** Events on their way to the page. Thunks: a listing says what is true when it ARRIVES. */
  let outbox: (() => unknown[])[] = [];
  let cur!: Session;
  let delivering = 0;

  // ── the account's side ──

  function newToken(id: string): string {
    serial += 1;
    const r = rand();
    if (r < 0.3) return 'GPA.' + seed + '-' + serial + '-' + id; // short: kept verbatim by the profile
    if (r < 0.35) return '#' + seed + '.' + serial; // looks like the profile's own digest keys
    // long, like real ones — and all sharing a long prefix and suffix
    let middle = '';
    const length = int(60, 400);
    while (middle.length < length) middle += Math.floor(rand() * 1e9).toString(36);
    return 'kfhgnmopalclobdkngbiafcj.AO-J1O' + middle.slice(0, length) + '.' + serial.toString(36) + '_tail-of-every-token';
  }

  function live(id: string): Bought | null {
    for (const b of account) if (b.id === id && !b.refunded && !(b.kind === 'consumable' && b.done)) return b;
    return null;
  }

  function issue(id: string, paid: boolean, elsewhere: boolean = false): Bought | null {
    const pack = packOf(id);
    if (!pack || account.length >= MAX_PURCHASES) return null;
    if (pack.kind === 'entitlement' && live(id)) return null; // owned (or pending) already
    let quantity: unknown = undefined;
    if (pack.kind === 'consumable') {
      const r = rand();
      if (r < 0.12) quantity = int(2, 4);
      else if (r < 0.2) quantity = pick<unknown>([0, 1, -3, 2.9, NaN, '3', null, true, 1e9, Infinity, {}]);
      // a huge quantity only on the smallest pack, so that the sum stays far below the coin cap
      if ((quantity === 1e9 || quantity === Infinity) && id !== 'coins_small') quantity = 3;
    }
    const b: Bought = { token: newToken(id), id, kind: pack.kind, paid, done: elsewhere, elsewhere, refunded: false, quantity, finishCalls: 0 };
    account.push(b);
    byToken.set(b.token, b);
    if (paid && pack.kind === 'entitlement') everPaid.add(id);
    stats.purchases += 1;
    return b;
  }

  function purchasedEvent(b: Bought, stale: boolean): Record<string, unknown> {
    const ev: Record<string, unknown> = { type: 'purchase', id: b.id, state: 'purchased', token: b.token };
    if (b.kind === 'entitlement') {
      // the truth, or — for a stale event — what was true before the game acknowledged it
      const acknowledged = b.elsewhere || (b.done && !stale);
      if (acknowledged || chance(0.6)) ev.acknowledged = acknowledged;
    } else if (chance(0.2)) {
      ev.acknowledged = chance(0.5); // means nothing for a coin pack
    }
    if (b.quantity !== undefined) ev.quantity = b.quantity;
    return ev;
  }

  /** What the store answers when asked what the player owns: the list, then every unfinished purchase. */
  function listing(): unknown[] {
    const ids: string[] = [];
    let limbo = false;
    const follow: unknown[] = [];
    for (const b of account) {
      if (b.refunded) continue;
      if (!b.paid) {
        follow.push({ type: 'purchase', id: b.id, state: 'pending' });
      } else if (b.kind === 'entitlement' && b.done) {
        if (ids.indexOf(b.id) < 0) ids.push(b.id);
      } else if (!b.done) {
        follow.push(purchasedEvent(b, false));
        if (b.kind === 'entitlement') limbo = true;
      }
    }
    const owned: Record<string, unknown> = { type: 'owned', ids };
    if (!limbo) owned.complete = true;
    return [owned as unknown].concat(follow);
  }

  function ownedByAccount(id: string): boolean {
    for (const b of account) if (b.id === id && b.paid && !b.refunded) return true;
    return false;
  }

  // ── the ledger's prediction, made BEFORE the event reaches the store ──

  function predict(ev: unknown): void {
    if (!isRecord(ev) || ev.type !== 'purchase' || ev.state !== 'purchased') return;
    const pack = packOf(ev.id);
    const token = ev.token;
    if (!pack || typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN) return;
    if (pack.kind === 'entitlement' && ev.acknowledged === true) return; // a restore: ownership only
    if (model.known.has(token)) return; // granted before
    const units = pack.kind === 'consumable' ? unitsOf(ev.quantity) : 1;
    model.known.add(token);
    model.coins += pack.coins * units;
    model.hammer += pack.hammer * units;
    model.freeSwap += pack.freeSwap * units;
    model.prism += pack.prism * units;
    if (pack.kind === 'entitlement') boughtThisSession.add(ev.id as string);
    stats.grants += 1;
  }

  /** How many 'purchased' events arrived per product (a stale one re-establishes ownership). */
  const purchasedSeen: Record<string, number> = {};

  function deliver(ev: unknown): void {
    if (tracing) console.log('  deliver', String(JSON.stringify(ev)).slice(0, 160));
    if (isRecord(ev) && ev.type === 'purchase' && ev.state === 'purchased' && typeof ev.id === 'string') purchasedSeen[ev.id] = (purchasedSeen[ev.id] || 0) + 1;
    predict(ev);
    stats.events += 1;
    const r = rand();
    let wire: unknown;
    if (typeof ev === 'string' || !isRecord(ev)) wire = ev; // junk goes as it is
    else if (r < 0.8) wire = JSON.stringify(ev);
    else if (r < 0.9) wire = ev; // the parsed object
    else wire = JSON.stringify(JSON.stringify(ev)); // encoded twice
    delivering += 1;
    try {
      cur.store.receive(wire);
    } catch (err) {
      fail('receive threw: ' + String(err));
    } finally {
      delivering -= 1;
    }
  }

  function deliverListing(): void {
    const events = listing();
    const complete = isRecord(events[0]) && events[0].complete === true;
    const seenBefore: Record<string, number> = {};
    for (const id of ENTITLEMENTS) seenBefore[id] = purchasedSeen[id] || 0;
    for (const ev of events) deliver(ev);
    // right after a whole listing: everything the account has paid for is owned…
    for (const id of ENTITLEMENTS) {
      if (ownedByAccount(id)) {
        if (!cur.store.owns(id as 'remove_ads')) fail(id + ' is paid for, but not owned after a full listing');
      } else if (complete && !boughtThisSession.has(id) && (purchasedSeen[id] || 0) === seenBefore[id] && cur.store.owns(id as 'remove_ads')) {
        // …and a complete listing leaves nothing that the account does not have (unless a stale
        // 'purchased' event of a refunded purchase slipped in behind it, through a listener)
        fail(id + ' still owned after a complete listing that does not have it');
      }
    }
  }

  // ── the wrapper's side of the bridge ──

  function answer(make: () => unknown[]): void {
    if (syncBridge) {
      stats.syncDeliveries += 1;
      for (const ev of make()) deliver(ev); // inside the bridge call
    } else {
      outbox.push(make);
    }
  }

  machine.onBridge = (_session, name, argument) => {
    if (name !== 'iapFinish' && bridgeThrows && chance(0.5)) {
      stats.bridgeThrows += 1;
      throw new Error('bridge is down');
    }
    switch (name) {
      case 'iapFinish': {
        const b = argument === undefined ? undefined : byToken.get(argument);
        if (!b) {
          fail('iapFinish for a token the store never issued');
          return;
        }
        if (!b.paid) fail('iapFinish for a payment that is still pending (' + b.id + ')');
        if (b.elsewhere) fail('iapFinish for an entitlement that was only restored (' + b.id + ')');
        if (!persisted.known.has(b.token)) fail('iapFinish before the grant was on disk (' + b.id + ', disk ' + machine.disk.mode + ')');
        b.finishCalls += 1;
        stats.finishes += 1;
        if (bridgeThrows && chance(0.5)) {
          stats.bridgeThrows += 1;
          throw new Error('bridge is down'); // the request never reached the store
        }
        if (!finishesLost && b.paid && !b.refunded) b.done = true;
        return;
      }
      case 'iapBuy': {
        const id = argument as string;
        if (!packOf(id)) {
          fail('iapBuy for a product that does not exist: ' + String(id));
          return;
        }
        const r = rand();
        if (r < 0.42) {
          const b = issue(id, true);
          answer(() => (b ? [purchasedEvent(b, false)] : [{ type: 'purchase', id, state: 'alreadyOwned' }]));
        } else if (r < 0.54) {
          const b = issue(id, false);
          answer(() => [{ type: 'purchase', id, state: b ? 'pending' : 'alreadyOwned' }]);
        } else if (r < 0.64) answer(() => [{ type: 'purchase', id, state: 'cancelled' }]);
        else if (r < 0.72) answer(() => [{ type: 'purchase', id, state: 'error' }]);
        else if (r < 0.78) answer(() => [{ type: 'purchase', id, state: 'unavailable' }]);
        else if (r < 0.9) answer(() => [{ type: 'purchase', id, state: 'alreadyOwned' }]); // true or not
        // else: silence
        return;
      }
      case 'iapRestore':
        if (chance(0.75)) {
          if (syncBridge) {
            stats.syncDeliveries += 1;
            deliverListing();
          } else outbox.push(() => ['LISTING']);
        }
        return;
      case 'iapQuery':
        if (chance(0.8)) answer(() => [{ type: 'products', products: ALL_PRICES }]);
        return;
      case 'storeSync':
        answer(() => [ADS_ON]);
        return;
      case 'adShowRewarded':
        if (chance(0.8)) answer(() => [{ type: 'adResult', format: chance(0.9) ? 'rewarded' : 'interstitial', result: pick(['earned', 'earned', 'dismissed', 'failed']) }]);
        return;
      case 'adShowInterstitial':
        if (chance(0.8)) answer(() => [{ type: 'adResult', format: chance(0.9) ? 'interstitial' : 'rewarded', result: pick(['dismissed', 'dismissed', 'failed', 'earned']) }]);
        return;
      case 'adPrivacyOptions':
        if (chance(0.7)) answer(() => [ADS_ON]);
        return;
      default:
        fail('unknown bridge call ' + name);
    }
  };

  // ── sessions ──

  function boot(): void {
    // not started yet: a bridge that answers inside the call must find the new session in place
    cur = startSession(machine, { buyResumeGraceMs: chance(0.5) ? undefined : null, deferStart: true });
    boughtThisSession = new Set();
    seenOwned = new Set();
    const session = cur;
    // listeners: one that throws, one that calls back into the store
    session.store.onChange(() => {
      if (chance(0.1)) throw new Error('listener failed');
    });
    session.store.onChange(() => {
      if (session !== cur || !reentrantListeners || delivering > 3 || !chance(0.08)) return;
      const r = rand();
      if (r < 0.3) void book.track('restore@listener', session.store.restore());
      else if (r < 0.5) void book.track('buy@listener', session.store.buy(pick(PRODUCT_IDS) as 'coins_small'));
      else if (r < 0.7) {
        const paid = account.filter((b) => b.paid);
        if (paid.length > 0) deliver(purchasedEvent(pick(paid), true));
      } else {
        session.store.products();
        session.store.owns('remove_ads');
        session.store.rewardedLeft('freeCoins');
      }
    });
    session.profile.subscribe(() => {
      if (chance(0.05)) throw new Error('subscriber failed');
      if (session === cur && chance(0.05)) session.store.owns('starter_pack');
    });
    session.store.start();
    session.send({ type: 'products', products: ALL_PRICES });
    session.send(ADS_ON);
  }

  function restart(): void {
    cur.kill();
    outbox = []; // events on their way to the old page die with it
    model = copy(persisted);
    stats.restarts += 1;
    boot();
  }

  // ── invariants after every step ──

  function check(): void {
    const p = cur.profile;
    if (tracing) console.log('step', stepNo, 'coins', p.coins(), 'ledger', model.coins, 'on disk', persisted.coins, 'disk', machine.disk.mode, 'session', cur.serial);
    const data = p.data();
    if (p.coins() !== model.coins) fail('coins ' + p.coins() + ', the ledger says ' + model.coins);
    if (data.boosters.hammer !== model.hammer || data.boosters.freeSwap !== model.freeSwap || data.boosters.prism !== model.prism) {
      fail('boosters ' + JSON.stringify(data.boosters) + ', the ledger says ' + model.hammer + '/' + model.freeSwap + '/' + model.prism);
    }
    if (data.shop.tokens.length > 200) fail('more than 200 remembered tokens');
    if (data.shop.owned.length > 16) fail('more than 16 owned ids');
    for (const key of data.shop.tokens) if (key.length > 64) fail('a remembered token key of ' + key.length + ' characters');
    for (const id of ENTITLEMENTS) {
      const owns = cur.store.owns(id as 'remove_ads');
      if (owns && !everPaid.has(id)) fail(id + ' is owned but was never paid for');
      if (owns) seenOwned.add(id);
      else if (seenOwned.has(id) && ownedByAccount(id)) fail(id + ' was lost although the account has paid for it');
      if (!ownedByAccount(id)) seenOwned.delete(id);
    }
    if ((model.known.size > 0 || data.shop.owned.length > 0) && !data.shop.purchased) fail('the purchased flag is not set');
  }

  // ── junk ──

  function junk(): unknown {
    const big = 'x'.repeat(int(5_000, 60_000));
    return pick<() => unknown>([
      () => '',
      () => '{',
      () => 'null',
      () => '[]',
      () => '"just a string"',
      () => 42,
      () => null,
      () => undefined,
      () => [],
      () => ({}),
      () => ({ type: 'purchase' }),
      () => ({ type: 'purchase', id: pick(PRODUCT_IDS) }),
      () => ({ type: 'purchase', id: pick(PRODUCT_IDS), state: 'purchased' }), // no token
      () => ({ type: 'purchase', id: pick(PRODUCT_IDS), state: 'purchased', token: '' }),
      () => ({ type: 'purchase', id: pick(PRODUCT_IDS), state: 'purchased', token: pick<unknown>([5, null, {}, ['t'], true]) }),
      () => ({ type: 'purchase', id: pick(PRODUCT_IDS), state: 'purchased', token: 't'.repeat(MAX_TOKEN + int(1, 5000)) }), // too long to be a token
      () => ({ type: 'purchase', id: pick(PRODUCT_IDS), state: pick(['PURCHASED', 'paid', 'refunded', '', 7, null]), token: 'junk-' + int(1, 9) }),
      () => ({ type: 'purchase', id: pick(['coins_tiny', 'COINS_SMALL', '__proto__', 'constructor', 'toString', big, '', 7, null]), state: 'purchased', token: 'junk-' + int(1, 9) }),
      () => ({ type: 'owned' }),
      () => ({ type: 'owned', ids: 'remove_ads' }),
      () => ({ type: 'owned', ids: [null, 5, {}, 'nope', '__proto__', big, 'coins_small'] }),
      () => ({ type: 'owned', ids: new Array(5000).fill('unknown_product'), complete: 'yes' }),
      () => ({ type: 'products' }),
      () => ({ type: 'products', products: [{ id: 'coins_small', price: big }, { id: big, price: '1' }, null, 5, { id: 'coins_medium' }] }),
      () => ({ type: 'ads' }),
      () => ({ type: 'ads', canRequestAds: 'yes', rewardedReady: 1 }),
      () => ({ type: 'adResult' }),
      () => ({ type: 'adResult', format: 'banner', result: 'earned' }),
      () => ({ type: 'adResult', format: 'rewarded', result: 'won' }),
      () => ({ type: 'adResult', format: pick(['rewarded', 'interstitial']), result: pick(['earned', 'dismissed', 'failed']) }), // nobody asked
      () => ({ type: big }),
      () => ({ type: 'somethingNew', data: [1, 2, 3] }),
      () => JSON.stringify({ type: 'purchase', id: 'coins_small', state: 'purchased' }).slice(0, 30),
    ])();
  }

  // ── the run ──

  boot();
  check();

  for (stepNo = 1; stepNo <= steps && problems.length === 0; stepNo++) {
    const r = rand();
    try {
      if (r < 0.28) {
        // events arrive: in order, shuffled, or twice
        let n = int(1, 4);
        while (n-- > 0 && outbox.length > 0) {
          const at = chance(0.15) ? int(0, outbox.length - 1) : 0;
          const make = outbox.splice(at, 1)[0]!;
          const events = make();
          if (events[0] === 'LISTING') {
            if (chance(0.15)) {
              // out of order and partly doubled
              const mixed = listing();
              for (let i = mixed.length - 1; i > 0; i--) {
                const j = int(0, i);
                const tmp = mixed[i];
                mixed[i] = mixed[j];
                mixed[j] = tmp;
              }
              for (const ev of mixed) {
                deliver(ev);
                if (chance(0.3)) deliver(ev);
              }
            } else deliverListing();
          } else {
            for (const ev of events) {
              deliver(ev);
              if (chance(0.15)) deliver(ev);
            }
          }
        }
      } else if (r < 0.38) {
        const id = chance(0.92) ? pick(PRODUCT_IDS) : pick(['coins_tiny', '', '__proto__', 'x'.repeat(10_000)]);
        stats.promises += 1;
        void book.track('buy:' + cur.serial, cur.store.buy(id as 'coins_small'));
      } else if (r < 0.42) {
        stats.promises += 1;
        void book.track('restore:' + cur.serial, cur.store.restore());
      } else if (r < 0.48) {
        stats.promises += 1;
        const which = rand();
        if (which < 0.45) void book.track('rewarded:' + cur.serial, cur.store.showRewarded(pick(['extraMoves', 'freeLife', 'freeCoins', 'doubleReward', 'banner']) as 'freeCoins'));
        else if (which < 0.9) void book.track('interstitial:' + cur.serial, cur.store.maybeShowInterstitial());
        else void book.track('privacy:' + cur.serial, cur.store.showPrivacyOptions());
      } else if (r < 0.54) {
        deliverListing(); // the wrapper lists purchases by itself on every return to the app
      } else if (r < 0.6) {
        // a stale copy of an old 'purchased' event
        const paid = account.filter((b) => b.paid);
        if (paid.length > 0) deliver(purchasedEvent(pick(paid), chance(0.5)));
      } else if (r < 0.66) {
        deliver(junk());
      } else if (r < 0.69) {
        // a pending payment completes
        const pending = account.filter((b) => !b.paid && !b.refunded);
        if (pending.length > 0) {
          const b = pick(pending);
          b.paid = true;
          if (b.kind === 'entitlement') everPaid.add(b.id);
          if (chance(0.5)) outbox.push(() => [purchasedEvent(b, false)]);
        }
      } else if (r < 0.71) {
        // bought outside the app (a promo code), or restored from another install
        const id = pick(PRODUCT_IDS);
        issue(id, true, PACKS[id]!.kind === 'entitlement' && chance(0.6));
      } else if (r < 0.73) {
        // a refund takes an entitlement (or a pending payment) away
        const candidates = account.filter((b) => !b.refunded && (b.kind === 'entitlement' || !b.paid));
        if (candidates.length > 0) {
          pick(candidates).refunded = true;
          stats.refunds += 1;
        }
      } else if (r < 0.75) {
        // a listing from a store that could not answer properly: never marked complete
        const real = listing()[0] as { ids: string[] };
        deliver({ type: 'owned', ids: chance(0.5) ? [] : real.ids.slice(0, int(0, real.ids.length)) });
      } else if (r < 0.81) {
        const ms = pick([1, 50, 399, 400, 5 * SECOND, 15 * SECOND, 31 * SECOND, 2 * MINUTE, 11 * MINUTE, 3 * HOUR, DAY]);
        machine.clock.now += ms;
        vi.advanceTimersByTime(ms);
      } else if (r < 0.85) {
        if (chance(0.5)) cur.pause();
        else cur.resume();
      } else if (r < 0.9) {
        restart();
      } else if (r < 0.95) {
        const before = machine.disk.mode;
        machine.disk.mode = pick<DiskMode>(['ok', 'ok', 'throws', 'silent']);
        if (before !== 'silent' && machine.disk.mode === 'silent') stats.silentWritesLost += 1;
      } else if (r < 0.98) {
        const which = rand();
        if (which < 0.3) bridgeThrows = !bridgeThrows;
        else if (which < 0.6) finishesLost = !finishesLost;
        else if (which < 0.9) syncBridge = !syncBridge;
        else reentrantListeners = !reentrantListeners;
      } else if (r < 0.99 && withResets) {
        // "Reset progress" in settings: coins and boosters start over, purchase records stay
        model.coins = START_COINS;
        model.hammer = 0;
        model.freeSwap = 0;
        model.prism = 0;
        stats.resets += 1;
        cur.profile.reset();
      } else {
        cur.store.iapAvailable();
        cur.store.products();
        cur.store.adsAvailable();
        cur.store.rewardedReady();
        cur.store.freeCoinAdsLeft();
        cur.store.privacyOptionsRequired();
      }
    } catch (err) {
      fail('an exception escaped: ' + (err instanceof Error ? err.stack || err.message : String(err)));
    }
    check();
  }
  expect(problems).toEqual([]);

  // ── the end: everything works again, and the store does what it does on every start ──
  stepNo = steps + 1;
  bridgeThrows = false;
  finishesLost = false;
  syncBridge = false;
  reentrantListeners = false;
  machine.disk.mode = 'ok';
  outbox = [];
  const settle = (): void => {
    for (let round = 0; round < 4; round++) {
      // pending payments stay pending; everything paid is listed until nothing is left to finish
      deliverListing();
      check();
    }
  };

  // (a) in the running session: one ordinary save puts on disk what was only in memory…
  cur.profile.markSeen('fuzz.settle.' + seed);
  settle();
  for (const b of account) {
    if (b.paid && !b.refunded && !b.elsewhere && !b.done) {
      stats.finishWithheld += 1;
      fail('never finished in the running session: ' + b.id);
    }
  }

  // (b) …and after one more restart nothing changes
  restart();
  settle();
  expect(problems).toEqual([]);

  // every paid purchase: granted exactly once (the ledger), finished at least once
  for (const b of account) {
    if (!b.paid || b.refunded) continue;
    if (b.elsewhere) {
      expect(model.known.has(b.token), 'a restored entitlement was granted').toBe(false);
      expect(b.finishCalls).toBe(0);
    } else {
      expect(model.known.has(b.token), b.id + ' was never granted').toBe(true);
      expect(b.finishCalls, b.id + ' was never finished').toBeGreaterThan(0);
      expect(b.done).toBe(true);
    }
  }
  // nothing was granted that was not a paid purchase of this account
  for (const token of model.known) {
    const b = byToken.get(token);
    expect(b !== undefined && b.paid && !b.elsewhere, 'granted without a paid purchase').toBe(true);
  }
  // coins == start + Σ over distinct purchased tokens (a reset wipes coins, so only without resets)
  if (stats.resets === 0) {
    let coins = START_COINS;
    let hammer = 0;
    for (const token of model.known) {
      const b = byToken.get(token)!;
      const units = b.kind === 'consumable' ? unitsOf(b.quantity) : 1;
      coins += PACKS[b.id]!.coins * units;
      hammer += PACKS[b.id]!.hammer * units;
    }
    expect(cur.profile.coins()).toBe(coins);
    expect(cur.profile.boosterCount('hammer')).toBe(hammer);
  }
  // …and that is what the disk holds
  const disk = JSON.parse(machine.disk.json!) as { coins: number; shop: { tokens: string[]; owned: string[] } };
  expect(disk.coins).toBe(cur.profile.coins());
  expect(disk.shop.tokens.length).toBe(model.known.size);
  // ownership is exactly the account's
  for (const id of ENTITLEMENTS) expect(cur.store.owns(id as 'remove_ads'), id).toBe(ownedByAccount(id));
  expect(disk.shop.owned.slice().sort()).toEqual(ENTITLEMENTS.filter(ownedByAccount).sort());

  // every promise the store ever returned — in every session, dead ones included — settles
  for (let i = 0; i < 6; i++) {
    machine.clock.now += HOUR;
    await vi.advanceTimersByTimeAsync(HOUR);
  }
  expect(book.rejected).toEqual([]);
  expect(book.open()).toEqual([]);
  expect(book.count()).toBeGreaterThan(0);
  expect(problems).toEqual([]);
  return stats;
}

function total(all: Stats[]): Stats {
  const sum: Stats = { events: 0, grants: 0, finishes: 0, restarts: 0, purchases: 0, syncDeliveries: 0, silentWritesLost: 0, finishWithheld: 0, promises: 0, bridgeThrows: 0, resets: 0, refunds: 0 };
  for (const s of all) for (const key of Object.keys(sum) as (keyof Stats)[]) sum[key] += s[key];
  return sum;
}

describe('fuzz: a hostile world around the store, an honest ledger beside it', () => {
  it('30 runs × 700 steps without resets: coins == 2,000 + Σ distinct purchased tokens, finished only after the save', async () => {
    const all: Stats[] = [];
    for (let seed = 1; seed <= 30; seed++) all.push(await fuzz(seed, 700, false));
    const sum = total(all);
    // the fuzz really went everywhere
    expect(sum.events).toBeGreaterThan(10_000);
    expect(sum.grants).toBeGreaterThan(500);
    expect(sum.finishes).toBeGreaterThan(500);
    expect(sum.restarts).toBeGreaterThan(500);
    expect(sum.syncDeliveries).toBeGreaterThan(100);
    expect(sum.silentWritesLost).toBeGreaterThan(50);
    expect(sum.bridgeThrows).toBeGreaterThan(100);
    expect(sum.refunds).toBeGreaterThan(50);
    expect(sum.promises).toBeGreaterThan(2_000);
    expect(sum.resets).toBe(0);
  }, 120_000);

  it('20 runs × 700 steps with "reset progress" thrown in: purchase records survive every reset', async () => {
    const all: Stats[] = [];
    for (let seed = 1001; seed <= 1020; seed++) all.push(await fuzz(seed, 700, true));
    const sum = total(all);
    expect(sum.resets).toBeGreaterThan(20);
    expect(sum.grants).toBeGreaterThan(300);
  }, 120_000);

  it('3 long runs × 4,000 steps', async () => {
    const all: Stats[] = [];
    for (let seed = 5001; seed <= 5003; seed++) all.push(await fuzz(seed, 4000, seed === 5003));
    expect(total(all).events).toBeGreaterThan(5_000);
  }, 120_000);

  // A soak for whoever changes the money path: FUZZ_SOAK=400 npx vitest run tests/monetize/hardening-fuzz.test.ts
  const soak = typeof process !== 'undefined' ? Math.floor(Number(process.env.FUZZ_SOAK)) || 0 : 0;
  it.skipIf(soak <= 0)('soak: FUZZ_SOAK more runs × 700 steps on fresh seeds', async () => {
    for (let i = 0; i < soak; i++) await fuzz(20_000 + i, 700, i % 3 === 0);
  }, 3_600_000);
});
