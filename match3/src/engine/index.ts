/**
 * Public surface of the engine. Other modules import from here (or from ./types.ts for types only).
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
