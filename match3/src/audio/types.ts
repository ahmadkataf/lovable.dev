/**
 * Audio contract. ALL sound is synthesised with the Web Audio API at runtime — no audio files,
 * no third-party samples — so the game owns every sound it plays. See docs/DESIGN.md §4.
 */
export type SfxName =
  | 'button'      // UI tap
  | 'select'      // picking up a gem
  | 'swap'        // valid swap whoosh
  | 'invalid'     // rejected swap
  | 'match'       // gems clearing; opts.step = cascade number (1..n) raises the pitch along the scale
  | 'land'        // pieces landing after a fall (soft tick)
  | 'createBeam' | 'createNova' | 'createPrism'
  | 'beam'        // line blast
  | 'nova'        // area blast
  | 'prism'       // wildcard rays
  | 'bigCombo'    // special + special
  | 'sand' | 'stone' | 'stoneBreak' | 'chain' | 'vine' | 'vineGrow'
  | 'lamp'        // lamp delivered
  | 'shuffle'
  | 'booster'     // booster used
  | 'praise'      // short sparkle under the praise word; opts.step = intensity 1..4
  | 'goalDone'
  | 'star'        // one star awarded; opts.step = 1..3
  | 'win' | 'lose'
  | 'coin' | 'reward' | 'purchase' | 'lifeLost' | 'levelStart' | 'popupOpen' | 'popupClose'
  | 'movesLow';   // warning when 5 moves remain

export type MusicTrack = 'menu' | 'level';

export interface SfxOptions {
  /** Musical step / intensity, meaning depends on the sound. */
  step?: number;
  /** 0..1 volume multiplier. */
  volume?: number;
}

export interface AudioApi {
  /**
   * Create/resume the AudioContext. Must be called from a user gesture at least once in a browser;
   * safe to call repeatedly. Before it is unlocked, sfx()/music() are silently ignored/deferred.
   */
  unlock(): void;
  setSfxEnabled(on: boolean): void;
  setMusicEnabled(on: boolean): void;
  sfx(name: SfxName, opts?: SfxOptions): void;
  /** Cross-fade to a generative music track; null stops music. Calling with the current track is a no-op. */
  music(track: MusicTrack | null): void;
  /** App went to background / came back: stop all output immediately, then restore. */
  suspend(): void;
  resume(): void;
}
