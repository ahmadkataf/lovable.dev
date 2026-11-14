/**
 * Reference replayer: applies a turn's Steps to a snapshot's cells and returns the resulting
 * cells. It exists for two reasons:
 *
 *  1. Proof — the tests assert, for every turn of thousands of random games, that
 *     `applySteps(before, result.steps).cells` deep-equals `result.snapshot.cells`. So the Step
 *     transcript is complete: a renderer that plays the steps never has to guess or resync.
 *  2. Documentation — this file is the precise meaning of each Step type for the board renderer.
 *
 * It is deliberately strict: a step that does not fit the board it is applied to (a hit naming
 * the wrong piece, a piece landing on an occupied cell, …) throws.
 */
import type { CellView, GameStatus, Piece, Pos, Snapshot, Step } from './types.ts';

export interface ReplayResult {
  cols: number;
  rows: number;
  /** Row-major cells after the steps (fresh objects; the input snapshot is not modified). */
  cells: CellView[];
  /** `before.score` plus the `score` of every clear / collect / transform step. */
  score: number;
  /** Status from the last 'status' step, else `before.status`. */
  status: GameStatus;
}

export function applySteps(before: Snapshot, steps: readonly Step[]): ReplayResult {
  const { cols, rows } = before;
  const cells: CellView[] = before.cells.map((cell) => ({
    exists: cell.exists,
    piece: cell.piece === null ? null : { ...cell.piece },
    sand: cell.sand,
    exit: cell.exit,
    spawner: cell.spawner,
  }));
  let score = before.score;
  let status = before.status;

  const fail = (index: number, step: Step, message: string): never => {
    throw new Error(`replay: step ${index} (${step.type}): ${message}`);
  };
  const cellAt = (index: number, step: Step, pos: Pos): CellView => {
    if (!Number.isInteger(pos.c) || !Number.isInteger(pos.r) || pos.c < 0 || pos.c >= cols || pos.r < 0 || pos.r >= rows) {
      return fail(index, step, `cell ${pos.c},${pos.r} is outside the board`);
    }
    const cell = cells[pos.r * cols + pos.c] as CellView;
    if (!cell.exists) return fail(index, step, `cell ${pos.c},${pos.r} is a hole`);
    return cell;
  };
  /** Pieces listed in `moves` all leave their cells first, then all land: the moves are simultaneous. */
  const relocate = (index: number, step: Step, moves: readonly { id: number; from: Pos; to: Pos }[]): void => {
    const lifted: Piece[] = [];
    for (const move of moves) {
      const from = cellAt(index, step, move.from);
      if (from.piece === null || from.piece.id !== move.id) {
        return fail(index, step, `piece ${move.id} is not on ${move.from.c},${move.from.r}`);
      }
      lifted.push(from.piece);
      from.piece = null;
    }
    for (let k = 0; k < moves.length; k++) {
      const move = moves[k] as { id: number; from: Pos; to: Pos };
      const to = cellAt(index, step, move.to);
      if (to.piece !== null) return fail(index, step, `cell ${move.to.c},${move.to.r} is occupied (piece ${move.id} lands there)`);
      to.piece = lifted[k] as Piece;
    }
  };

  steps.forEach((step, index) => {
    switch (step.type) {
      case 'swap': {
        // A rejected swap changes nothing. A valid one exchanges the two pieces.
        if (!step.valid) break;
        const a = cellAt(index, step, step.a);
        const b = cellAt(index, step, step.b);
        if (a.piece === null || b.piece === null) return fail(index, step, 'swap needs a piece on both cells');
        const tmp = a.piece;
        a.piece = b.piece;
        b.piece = tmp;
        break;
      }

      case 'activate':
      case 'booster':
        // Purely visual: the cells they affect are listed in the 'clear' step that follows.
        break;

      case 'clear': {
        score += step.score;
        // Hits apply in order. A cell can appear more than once when several effects of the same
        // wave reach it (stone damaged twice; piece removed, then the sand under it hit again).
        for (const hit of step.hits) {
          const cell = cellAt(index, step, hit.at);
          const piece = cell.piece;
          if ((piece === null ? null : piece.id) !== hit.pieceId) {
            return fail(index, step, `hit on ${hit.at.c},${hit.at.r} names piece ${String(hit.pieceId)} but the cell holds ${piece === null ? 'nothing' : String(piece.id)}`);
          }
          switch (hit.result) {
            case 'removed':
            case 'activated':
              // The piece leaves the board ('activated': its effect is the next 'activate' step).
              if (piece === null) return fail(index, step, 'nothing to remove');
              cell.piece = null;
              break;
            case 'damaged':
              // A stone loses a layer but still stands.
              if (piece === null || piece.kind !== 'stone' || hit.hpLeft === undefined || hit.hpLeft < 1) {
                return fail(index, step, "'damaged' needs a stone and hpLeft >= 1");
              }
              piece.hp = hit.hpLeft;
              break;
            case 'unchained':
              // The chain breaks; the piece stays where it is.
              if (piece === null || !piece.chained) return fail(index, step, "'unchained' needs a chained piece");
              piece.chained = false;
              break;
            case 'none':
              // The piece (a lamp, or a special made in this cascade) is unaffected, or the cell was empty.
              break;
          }
          // Independently of the piece, the hit may have removed one sand layer.
          if (hit.sandLeft !== undefined) {
            if (cell.sand !== hit.sandLeft + 1) return fail(index, step, `sandLeft ${hit.sandLeft} does not follow sand ${cell.sand}`);
            cell.sand = hit.sandLeft;
          }
        }
        // Specials made by matches appear once all hits of the wave are done.
        for (const made of step.created) {
          const cell = cellAt(index, step, made.at);
          if (cell.piece !== null) return fail(index, step, `created special lands on occupied cell ${made.at.c},${made.at.r}`);
          cell.piece = { ...made.piece };
        }
        break;
      }

      case 'fall': {
        // Existing pieces move to their final cells, then the new pieces occupy theirs.
        relocate(index, step, step.moves);
        for (const spawn of step.spawns) {
          if (spawn.from.r >= 0) return fail(index, step, 'spawn origin must be above the board (negative row)');
          const cell = cellAt(index, step, spawn.to);
          if (cell.piece !== null) return fail(index, step, `spawn lands on occupied cell ${spawn.to.c},${spawn.to.r}`);
          cell.piece = { ...spawn.piece };
        }
        break;
      }

      case 'collect': {
        score += step.score;
        for (const lamp of step.lamps) {
          const cell = cellAt(index, step, lamp.at);
          if (cell.piece === null || cell.piece.id !== lamp.id || cell.piece.kind !== 'lamp') {
            return fail(index, step, `no lamp ${lamp.id} on ${lamp.at.c},${lamp.at.r}`);
          }
          if (!cell.exit) return fail(index, step, 'lamps are only collected on exit cells');
          cell.piece = null;
        }
        break;
      }

      case 'transform': {
        // The piece keeps its id and cell; kind and/or colour change.
        score += step.score;
        for (const change of step.changes) {
          const cell = cellAt(index, step, change.at);
          if (cell.piece === null || cell.piece.id !== change.piece.id) {
            return fail(index, step, `piece ${change.piece.id} is not on ${change.at.c},${change.at.r}`);
          }
          cell.piece = { ...change.piece };
        }
        break;
      }

      case 'grow': {
        // The new vine replaces the plain gem `replacedId` on `at`.
        const source = cellAt(index, step, step.from);
        if (source.piece === null || source.piece.kind !== 'vine') return fail(index, step, 'a vine must grow from a vine');
        const cell = cellAt(index, step, step.at);
        if ((cell.piece === null ? null : cell.piece.id) !== step.replacedId) {
          return fail(index, step, `replacedId ${String(step.replacedId)} is not on ${step.at.c},${step.at.r}`);
        }
        cell.piece = { ...step.piece };
        break;
      }

      case 'shuffle':
        // Pieces trade places (ids are kept). May be followed by a 'transform' with reason 'recolor'.
        relocate(index, step, step.moves);
        break;

      case 'status':
        status = step.status;
        break;
    }
  });

  return { cols, rows, cells, score, status };
}
