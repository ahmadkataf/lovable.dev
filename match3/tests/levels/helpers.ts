/** Shared helpers for the level-set tests: which mechanics a level features. */
import { Game } from '../../src/engine/index.ts';
import type { LevelDef, PieceKind } from '../../src/engine/index.ts';

export function countChars(rows: readonly string[] | undefined, chars: string): number {
  let total = 0;
  for (const row of rows ?? []) for (const ch of row) if (chars.indexOf(ch) >= 0) total++;
  return total;
}

const FIXED = 'abdefABCDEF';
const SPECIALS = 'HVNP';

/** Does the level place two specials on orthogonally adjacent cells (a ready-made combo)? */
export function hasAdjacentSpecials(level: LevelDef): boolean {
  const { pieces } = level;
  for (let r = 0; r < pieces.length; r++) {
    const row = pieces[r]!;
    for (let c = 0; c < row.length; c++) {
      if (SPECIALS.indexOf(row.charAt(c)) < 0) continue;
      if (c + 1 < row.length && SPECIALS.indexOf(row.charAt(c + 1)) >= 0) return true;
      const below = pieces[r + 1];
      if (below !== undefined && SPECIALS.indexOf(below.charAt(c)) >= 0) return true;
    }
  }
  return false;
}

/**
 * For boards pre-arranged with fixed colours: the special that the engine's hinted first move
 * creates, when it is the same on every seed tried — otherwise null.
 */
export function arrangedSpecial(level: LevelDef, seeds = 6): 'beam' | 'nova' | 'prism' | null {
  if (countChars(level.pieces, FIXED) === 0) return null;
  let found: string | null = null;
  for (let seed = 1; seed <= seeds; seed++) {
    const game = new Game(level, { seed });
    const hint = game.hint();
    if (hint === null) return null;
    const res = game.swap(hint.a, hint.b);
    let kind: PieceKind | null = null;
    for (const step of res.steps) {
      if (step.type !== 'clear') continue;
      if (step.created.length > 0) kind = step.created[0]!.piece.kind;
      break;
    }
    const name = kind === 'beamH' || kind === 'beamV' ? 'beam' : kind === 'nova' || kind === 'prism' ? kind : null;
    if (name === null || (found !== null && found !== name)) return null;
    found = name;
  }
  return found as 'beam' | 'nova' | 'prism' | null;
}

/** The mechanics a level features, by tutorial id. */
export function mechanicsOf(level: LevelDef): Set<string> {
  const out = new Set<string>(['match']);
  if (level.goals.some((g) => g.kind === 'color')) out.add('collect');
  const arranged = arrangedSpecial(level);
  if (arranged !== null) out.add(arranged);
  if (countChars(level.floor, '12') > 0) out.add('sand');
  if (countChars(level.floor, '2') > 0) out.add('sand2');
  if (countChars(level.pieces, '123') > 0) out.add('stone');
  if (hasAdjacentSpecials(level)) out.add('combo');
  if (countChars(level.pieces, 'L') > 0 || level.lamps !== undefined || level.goals.some((g) => g.kind === 'lamp')) out.add('lamp');
  if (countChars(level.pieces, 'c') > 0) out.add('chain');
  if (countChars(level.pieces, 'v') > 0) out.add('vine');
  return out;
}

/** Tutorial ids in the order the mechanics are introduced, with the level that introduces each. */
export const TUTORIALS: readonly (readonly [string, number])[] = [
  ['match', 1],
  ['collect', 2],
  ['beam', 3],
  ['nova', 4],
  ['prism', 5],
  ['sand', 6],
  ['sand2', 9],
  ['stone', 12],
  ['combo', 16],
  ['lamp', 21],
  ['chain', 31],
  ['vine', 41],
];
