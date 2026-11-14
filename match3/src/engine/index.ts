/**
 * Public surface of the engine. Other modules import from here (or from ./types.ts for types only).
 *
 *   const game = new Game(level, { seed, boosters });   // pure logic, deterministic per seed
 *   const res = game.swap(a, b);                        // or useBooster / addMoves / endBonus
 *   if (res.accepted) play(res.steps);                  // ordered transcript for the renderer
 *   res.snapshot                                        // settled state after the turn
 *
 * - Rules: docs/DESIGN.md §2. Contract and vocabulary: ./types.ts.
 * - What each Step does to the board, exactly: ./replay.ts (`applySteps`).
 * - Shape of a turn's transcript and the wave model: header of ./game.ts.
 * - `validateLevel(def)` returns the problems of a level definition ([] = playable).
 * - Score tuning lives in ./score.ts.
 */
export * from './types.ts';
export { Game } from './game.ts';
export type { DebugPiece, GameDebug } from './game.ts';
export { createRng } from './rng.ts';
export type { Rng } from './rng.ts';
export { validateLevel, parseLevel, pieceSpecFor, MAX_BOARD_SIZE, MIN_COLORS, MAX_COLORS } from './level.ts';
export type { ParsedLevel } from './level.ts';
export { SCORE, EXTRA_MOVES_BOOSTER, cascadeMultiplier, specialBonus, starsFor } from './score.ts';
export { applySteps } from './replay.ts';
export type { ReplayResult } from './replay.ts';
