/**
 * Score tuning (docs/DESIGN.md §2.10). Everything the engine awards comes from this table, so the
 * level simulator and the balance pass can retune the game in one place.
 */

export const SCORE = {
  /** A gem-like piece (gem, beam, nova, prism) leaving the board; multiplied by the cascade multiplier. */
  gem: 20,
  /** The cascade multiplier stops growing here. */
  cascadeCap: 8,
  /** Bonus for creating a special with a match. */
  beam: 60,
  nova: 120,
  prism: 200,
  /** Blockers: one sand layer, one stone layer, one broken chain, one vine. Not multiplied. */
  sandLayer: 40,
  stoneLayer: 40,
  chain: 40,
  vine: 40,
  /** A lamp delivered to an exit cell. */
  lamp: 500,
  /** End bonus: each move left over when the level is won. */
  endBonusPerMove: 250,
} as const;

/** Extra moves granted by the `extraMoves` start booster (§2.11). */
export const EXTRA_MOVES_BOOSTER = 3;

/** Multiplier applied to `SCORE.gem` in cascade number `cascade` (1 = the wave caused by the move itself). */
export function cascadeMultiplier(cascade: number): number {
  if (cascade < 1) return 1;
  return cascade > SCORE.cascadeCap ? SCORE.cascadeCap : cascade;
}

/** Bonus for a special created by a match. */
export function specialBonus(kind: 'beamH' | 'beamV' | 'nova' | 'prism'): number {
  if (kind === 'prism') return SCORE.prism;
  if (kind === 'nova') return SCORE.nova;
  return SCORE.beam;
}

/** Stars (0..3) earned by `score` against a level's three ascending thresholds. */
export function starsFor(score: number, thresholds: readonly [number, number, number]): 0 | 1 | 2 | 3 {
  if (score >= thresholds[2]) return 3;
  if (score >= thresholds[1]) return 2;
  if (score >= thresholds[0]) return 1;
  return 0;
}
