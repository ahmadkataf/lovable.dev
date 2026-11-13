/**
 * Pure helpers of the meta screens (no DOM): goal wording, reward wording, node states, booster
 * merging, ad allowances. Unit-tested in tests/ui.
 */
import type { IconKey, SpriteKey } from '../art/types.ts';
import type { Goal, LevelDef, StartBoosters } from '../engine/types.ts';
import type { AdPlacement, ProductDef, StoreApi } from '../monetize/types.ts';
import type { BoosterId, Reward, StartBoosterId } from '../state/types.ts';

export type IconName = IconKey | SpriteKey;
export type Translate = (key: string, vars?: Record<string, string | number>) => string;

export const START_BOOSTER_IDS: readonly StartBoosterId[] = ['beamNova', 'prism', 'extraMoves'];

/** Shop order of the six boosters: the three used inside a level, then the three start boosters. */
export const SHOP_BOOSTER_IDS: readonly BoosterId[] = ['hammer', 'freeSwap', 'shuffle', 'beamNova', 'prism', 'extraMoves'];

/** The art icon of a booster (the prism booster has its own icon key). */
export function boosterIcon(id: BoosterId): IconName {
  return id === 'prism' ? 'prismBooster' : id;
}

// ───────────────────────────── goals ─────────────────────────────

export function goalIcon(goal: Goal): IconName {
  switch (goal.kind) {
    case 'score':
      return 'goalScore';
    case 'color':
      return ('gem' + goal.color) as SpriteKey;
    case 'sand':
      return 'goalSand';
    case 'lamp':
      return 'lamp';
    case 'stone':
      return 'goalStone';
    case 'vine':
      return 'goalVine';
    case 'chain':
      return 'goalChain';
  }
}

/** The goal as a sentence ("Collect 15 Ruby gems", "Clear all the sand"). */
export function goalText(t: Translate, goal: Goal): string {
  switch (goal.kind) {
    case 'score':
      return t('goal.score', { n: goal.target });
    case 'color':
      return t('goal.colorNamed', { n: goal.target, gem: t('gem.' + goal.color) });
    case 'lamp':
      return t('goal.lamp', { n: goal.target });
    case 'sand':
      return t('goal.sand');
    case 'stone':
      return t('goal.stone');
    case 'vine':
      return t('goal.vine');
    case 'chain':
      return t('goal.chain');
  }
}

// ───────────────────────────── map nodes ─────────────────────────────

export type NodeState = 'done' | 'current' | 'open' | 'locked';

/**
 * State of a level's node. `stars` = best stars (0 when never won). 'current' is the one level
 * the journey has reached; 'open' is a playable level below it that was never won — which a
 * normal save cannot hold, but a damaged or hand-edited one can (then it must not look like
 * dozens of "current" levels).
 */
export function nodeState(levelId: number, highestUnlocked: number, stars: number): NodeState {
  if (stars > 0) return 'done';
  if (levelId === highestUnlocked) return 'current';
  return levelId < highestUnlocked ? 'open' : 'locked';
}

/** The level the map should focus on: the highest unlocked one, within the level list. */
export function focusLevel(highestUnlocked: number, levelCount: number): number {
  if (!(levelCount >= 1)) return 1;
  const n = Math.floor(highestUnlocked) || 1;
  return n < 1 ? 1 : n > levelCount ? levelCount : n;
}

// ───────────────────────────── boosters ─────────────────────────────

/** Union of two start-booster selections (the player's choice + the Caravan's gift). */
export function mergeBoosters(a: StartBoosters | null | undefined, b: StartBoosters | null | undefined): StartBoosters {
  const out: StartBoosters = {};
  for (const id of START_BOOSTER_IDS) {
    if ((a && a[id] === true) || (b && b[id] === true)) out[id] = true;
  }
  return out;
}

/** The start boosters switched on in a selection, in display order. */
export function boosterList(sel: StartBoosters | null | undefined): StartBoosterId[] {
  const out: StartBoosterId[] = [];
  if (!sel) return out;
  for (const id of START_BOOSTER_IDS) if (sel[id] === true) out.push(id);
  return out;
}

// ───────────────────────────── rewards ─────────────────────────────

export interface RewardView {
  icon: IconName;
  /** Short amount for a badge: "100", "×2", "" for a full refill of lives. */
  amount: string;
  /** Full wording: "100 coins", "2 × Hammer". */
  text: string;
}

export function rewardView(t: Translate, num: (n: number) => string, reward: Reward): RewardView {
  if (reward.kind === 'coins') {
    return { icon: 'coin', amount: num(reward.amount), text: t('meta.shop.coins', { n: reward.amount }) };
  }
  if (reward.kind === 'booster') {
    const name = t('booster.' + reward.id + '.name');
    return {
      icon: boosterIcon(reward.id),
      amount: '×' + num(reward.amount),
      text: reward.amount === 1 ? name : t('meta.shop.times', { n: reward.amount, name }),
    };
  }
  const n = typeof reward.amount === 'number' ? reward.amount : 0;
  return { icon: 'heart', amount: n > 0 ? '+' + num(n) : '', text: t('common.lives') };
}

/** Total coins among a list of rewards. */
export function coinsIn(rewards: readonly Reward[]): number {
  let sum = 0;
  for (const r of rewards) if (r.kind === 'coins') sum += r.amount;
  return sum;
}

/** Which art icon a coin pack gets, by how many coins it holds relative to the other packs (0..1). */
export function coinPackArt(rank: number): IconName {
  if (rank < 0.2) return 'coin';
  if (rank < 0.7) return 'coinPile';
  return 'coinChest';
}

/** Coin packs (consumables that grant coins) ordered by size, and the two entitlements. */
export function splitProducts<T extends { def: ProductDef }>(products: readonly T[]): { packs: T[]; starter: T | null; removeAds: T | null } {
  const packs: T[] = [];
  let starter: T | null = null;
  let removeAds: T | null = null;
  for (const p of products) {
    if (p.def.id === 'starter_pack') starter = p;
    else if (p.def.id === 'remove_ads') removeAds = p;
    else if (p.def.kind === 'consumable' && coinsIn(p.def.grants) > 0) packs.push(p);
  }
  packs.sort((a, b) => coinsIn(a.def.grants) - coinsIn(b.def.grants));
  return { packs, starter, removeAds };
}

// ───────────────────────────── ads ─────────────────────────────

/**
 * How many more rewarded ads of a placement may be watched today, or null when the store does not
 * say (a test double without `rewardedLeft`: then the button simply follows rewardedReady()).
 */
export function rewardedLeft(store: StoreApi, placement: AdPlacement): number | null {
  try {
    if (typeof store.rewardedLeft === 'function') {
      const n = store.rewardedLeft(placement);
      return typeof n === 'number' && n === n ? Math.max(0, Math.floor(n)) : null;
    }
    if (placement === 'freeCoins') {
      const n = store.freeCoinAdsLeft();
      return typeof n === 'number' && n === n ? Math.max(0, Math.floor(n)) : null;
    }
  } catch {
    return null;
  }
  return null;
}

/** "×3" that keeps its order inside right-to-left text (U+200E in front, see src/i18n/strings/common.ts). */
export function timesText(amount: string): string {
  return '\u200E×' + amount;
}

// ───────────────────────────── levels ─────────────────────────────

/** A level by id from a list where index 0 = level 1 (ids are checked, not assumed). */
export function levelById(levels: readonly LevelDef[], id: number): LevelDef | null {
  const direct = levels[id - 1];
  if (direct && direct.id === id) return direct;
  for (const level of levels) if (level.id === id) return level;
  return null;
}
