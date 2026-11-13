#!/usr/bin/env node
/*
 * Audio checker — verifies src/audio by measurement, since nobody listens during a build.
 *
 *   node tools/audio-check.cjs            run everything
 *   node tools/audio-check.cjs --no-live  skip the live-engine tests
 *   node tools/audio-check.cjs --only=match,beam   only these effects (no music/live)
 *   node tools/audio-check.cjs --suggest  also print the gain change that would bring each
 *                                         effect to its intended loudness (for tuning sfx.ts)
 *
 *   node tools/audio-check.cjs --no-long  skip the three-minute music renders
 *
 * It opens /audio-lab.html from the Vite dev server (port 5182; started here if it is not
 * already running) in headless Chromium and
 *   1. renders EVERY sound effect (each step of the stepped ones) and 20 s of each music
 *      track through OfflineAudioContext at 44.1 kHz, through the real output chain, and
 *      measures duration, peak, RMS, loudness, DC offset, spectral centroid, pitch and how
 *      much of the energy is harsh (above 6 kHz) or boom (below 150 Hz);
 *   2. renders three minutes of each track with the scheduler stepped as in live play:
 *      no clipping, no silence, no drift, no loop, a bounded number of audio nodes;
 *   3. renders a worst-case storm of effects over music to prove the output cannot clip, and
 *      checks that the first sound of a new context is not swallowed by the limiter;
 *   4. drives the live engine: unlock by a real click, 200 effects in one frame, toggles,
 *      track switching, suspend/resume, a stalled main thread;
 *   5. attacks the live engine while recording its real output sample by sample: 500
 *      effects in one tick, rapid track switching, suspend in the middle of a cross-fade,
 *      a three-second stall of the main thread, a hidden page, a context suspended behind
 *      the engine's back, fades that must not be chopped.
 * Rendered audio goes to shots/audio/<id>.wav with a spectrogram <id>.png next to it, plus
 * report.txt / report.json. Exit code 1 if any check fails.
 */
'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.AUDIO_CHECK_PORT || 5182);
const PAGE_URL = 'http://127.0.0.1:' + PORT + '/audio-lab.html';
const OUT = path.join(ROOT, 'shots', 'audio');
const args = process.argv.slice(2);
const NO_LIVE = args.indexOf('--no-live') >= 0;
const NO_LONG = args.indexOf('--no-long') >= 0;
const SUGGEST = args.indexOf('--suggest') >= 0;
const onlyArg = args.filter((a) => a.indexOf('--only=') === 0)[0];
const ONLY = onlyArg ? onlyArg.slice(7).split(',') : null;

// ───────────────────────── limits ─────────────────────────
const LIMITS = {
  clipPeak: 0.99,
  silentRms: 0.003,
  dc: 0.01,
  tailPeak: 0.002,
  // nominal duration (s) by class: [min, max]
  duration: { ui: [0.04, 0.25], game: [0.08, 0.9], jingle: [0.4, 2.2] },
  // loudness (A-weighted loudest frame, dB) relative to the median of the game effects
  gameSpread: 3, // game + jingle: within ±3 dB (a 6 dB window)
  uiBelow: [4, 14], // UI sounds: this many dB under the median
  // tone: share of a sound's energy above 6 kHz (harsh, hissy) and below 150 Hz (boom that
  // costs headroom and that a phone speaker cannot play)
  harsh: 0.3,
  boom: 0.3,
  // music
  musicHalves: 3.5, // dB between first and second half
  musicGap: 1, // s of silence
  musicUnderSfx: 8, // music RMS at least this many dB under the median effect
  // like for like (A-weighted loudest frame, as for the effects): the music's loudest moment
  // and its 95th percentile must sit this far under the median game effect
  musicMaxUnder: 5,
  musicP95Under: 8,
  musicPeak: 0.5, // sample peak of music alone
  musicOnsetsPerBar: [2.5, 22],
  // three minutes of music
  longSeconds: 180,
  longMinutes: 3, // dB between any two whole minutes
  longTenSeconds: 6, // dB between the loudest and the quietest 10 s
  longDifference: 0.5, // first vs last minute: 0 = identical samples, ~1 = unrelated
  longNodes: 160, // live audio nodes of the music at any time
  // first sound of a new context vs the same sound later (dB)
  startup: 1.5,
};

// Intended loudness (A-weighted, dB) used by --suggest: one level for game effects, UI
// sounds 8 dB lower, plus small deliberate offsets (a double blast should out-weigh a tap).
const TARGET = { game: -14.5, ui: -22.5 };
const INTENT = {
  bigCombo: 0.5, nova: -1, prism: 1, beam: 0, stoneBreak: -1, win: 0.5, reward: 1, purchase: 0, goalDone: 1,
  lose: -1, lifeLost: -2, invalid: -1.5, praise: -1.5, coin: -1, sand: -2.5, stone: -2, vine: -2, chain: -1,
  vineGrow: -1.5, createBeam: -0.5, createNova: -0.5, createPrism: -0.5, shuffle: -0.5, swap: 1.5, button: -1, land: -1.5,
  levelStart: -0.5, movesLow: -0.5,
};

const failures = [];
const lines = [];
function out(s) {
  lines.push(s);
  console.log(s);
}
function fail(what, detail) {
  failures.push(what + ': ' + detail);
}
function pad(s, n) {
  s = String(s);
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}
function padL(s, n) {
  s = String(s);
  return s.length >= n ? s : ' '.repeat(n - s.length) + s;
}
function f(x, d) {
  return typeof x === 'number' && isFinite(x) ? x.toFixed(d === undefined ? 1 : d) : '—';
}
function median(xs) {
  const s = xs.slice().sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ───────────────────────── dev server ─────────────────────────
function reachable() {
  return new Promise((resolve) => {
    const req = http.get(PAGE_URL, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensureServer() {
  if (await reachable()) return null;
  const vite = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  const child = spawn(process.execPath, [vite, '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 80; i++) {
    await sleep(250);
    if (await reachable()) return child;
    if (child.exitCode !== null) break;
  }
  try {
    child.kill();
  } catch (e) {
    /* ignore */
  }
  throw new Error('dev server did not start on port ' + PORT);
}

function save(report) {
  fs.writeFileSync(path.join(OUT, report.id + '.wav'), Buffer.from(report.wav, 'base64'));
  fs.writeFileSync(path.join(OUT, report.id + '.png'), Buffer.from(report.png.split(',')[1], 'base64'));
}

function slim(report) {
  const copy = Object.assign({}, report);
  delete copy.wav;
  delete copy.png;
  return copy;
}

// ───────────────────────── effects ─────────────────────────
async function checkEffects(page, report) {
  const variants = await page.evaluate(() => window.__audioLab.variants());
  const expected = await page.evaluate(() => window.__audioLab.expected());
  const chosen = ONLY ? variants.filter((v) => ONLY.indexOf(v.name) >= 0) : variants;
  const results = [];
  for (const v of chosen) {
    const r = await page.evaluate((x) => window.__audioLab.sfxReport(x.name, x.step), v);
    save(r);
    results.push(r);
  }
  report.sfx = results.map(slim);

  const gameLoud = results.filter((r) => r.cls !== 'ui').map((r) => r.metrics.loudADb);
  const ref = median(gameLoud);
  report.sfxMedianLoudA = ref;
  report.sfxMedianLoud = median(results.filter((r) => r.cls !== 'ui').map((r) => r.metrics.loudDb));

  out('');
  out('SOUND EFFECTS — rendered offline at 44.1 kHz through sfx bus → master → limiter → trim → guard');
  out(
    pad('sound', 15) + pad('class', 7) + padL('dur s', 7) + padL('aud s', 7) + padL('peak', 7) + padL('rms', 7) + padL('loud', 7) +
      padL('loudA', 7) + padL('Δmed', 6) + padL('DC', 9) + padL('centroid Hz', 13) + padL('start→end', 13) + padL('pitch Hz', 10) + padL('>6k %', 7) + padL('<150 %', 8) + '  flags',
  );
  for (const r of results) {
    const m = r.metrics;
    const flags = [];
    const lim = LIMITS.duration[r.cls];
    if (m.clips) flags.push('CLIPS');
    if (m.silent) flags.push('SILENT');
    if (Math.abs(m.dc) > LIMITS.dc) flags.push('DC');
    if (r.tailPeak > LIMITS.tailPeak) flags.push('TAIL(' + f(r.tailPeak, 4) + ')');
    if (r.nominal < lim[0] || r.nominal > lim[1]) flags.push('DURATION');
    if (m.effective < 0.02 + r.nominal * 0.5) flags.push('DEAD-AIR');
    if (m.hfShare > LIMITS.harsh) flags.push('HARSH');
    if (m.lfShare > LIMITS.boom) flags.push('BOOM');
    const delta = m.loudADb - ref;
    if (!ONLY) {
      if (r.cls === 'ui') {
        if (-delta < LIMITS.uiBelow[0] || -delta > LIMITS.uiBelow[1]) flags.push('UI-LEVEL');
      } else if (Math.abs(delta) > LIMITS.gameSpread) {
        flags.push('LEVEL');
      }
    }
    out(
      pad(r.id, 15) + pad(r.cls, 7) + padL(f(r.nominal, 3), 7) + padL(f(m.effective - 0.02, 3), 7) + padL(f(m.peakDb), 7) + padL(f(m.rmsDb), 7) +
        padL(f(m.loudDb), 7) + padL(f(m.loudADb), 7) + padL((delta >= 0 ? '+' : '') + f(delta), 6) + padL(m.dc.toExponential(0), 9) +
        padL(f(m.centroid, 0), 13) + padL(f(m.centroidStart, 0) + '→' + f(m.centroidEnd, 0), 13) + padL(f(m.pitch, 0), 10) +
        padL(f(m.hfShare * 100, 0), 7) + padL(f(m.lfShare * 100, 0), 8) + '  ' + (flags.join(' ') || 'ok'),
    );
    for (const fl of flags) fail('sfx ' + r.id, fl);
  }
  out('median loudness of game effects: ' + f(ref) + ' dB(A)   (game/jingle must be within ±' + LIMITS.gameSpread + ' dB, UI ' + LIMITS.uiBelow[0] + '–' + LIMITS.uiBelow[1] + ' dB below)');
  out('columns: dur = duration reported by renderSfx · aud = until 60 dB below the peak · peak, rms, loud (loudest 50 ms) in dBFS ·');
  out('         loudA = loudest frame, A-weighted (dB) · Δmed = loudA minus the median · DC = mean sample · centroid = power-weighted');
  out('         mean frequency (whole sound, then first third → last third) · pitch = strongest spectral peak ·');
  out('         >6k / <150 = share of the energy above 6 kHz / below 150 Hz');
  out('flags:   CLIPS |sample| ≥ ' + LIMITS.clipPeak + ' · SILENT rms < ' + LIMITS.silentRms + ' · DC |mean| > ' + LIMITS.dc + ' · TAIL sound after its reported end ·');
  out('         DURATION outside ' + JSON.stringify(LIMITS.duration).replace(/"/g, '') + ' s · DEAD-AIR audible < half of dur · LEVEL / UI-LEVEL loudness window ·');
  out('         HARSH more than ' + LIMITS.harsh * 100 + ' % of the energy above 6 kHz · BOOM more than ' + LIMITS.boom * 100 + ' % below 150 Hz');
  const uiLoud = results.filter((r) => r.cls === 'ui').map((r) => r.metrics.loudADb);
  if (uiLoud.length) report.uiMedianLoudA = median(uiLoud);
  // Class summary: the three levels the mix is built on.
  const cls = (name) => results.filter((r) => r.cls === name);
  const span = (rs, key) => (rs.length ? f(Math.min.apply(null, rs.map((r) => r.metrics[key]))) + ' … ' + f(Math.max.apply(null, rs.map((r) => r.metrics[key]))) : '—');
  out('');
  out('LOUDNESS BY CLASS (A-weighted loudest frame, dB · sample peak, dBFS · RMS, dBFS)');
  for (const name of ['ui', 'game', 'jingle']) {
    const rs = cls(name);
    if (!rs.length) continue;
    out('  ' + pad(name, 7) + padL(rs.length + ' sounds', 10) + '   loudA ' + pad(span(rs, 'loudADb'), 15) + ' median ' + padL(f(median(rs.map((r) => r.metrics.loudADb))), 6) + '   peak ' + pad(span(rs, 'peakDb'), 14) + '   rms ' + span(rs, 'rmsDb'));
  }
  report.classLoudness = {};
  for (const name of ['ui', 'game', 'jingle']) {
    const rs = cls(name);
    if (rs.length) report.classLoudness[name] = { count: rs.length, medianLoudA: median(rs.map((r) => r.metrics.loudADb)), minLoudA: Math.min.apply(null, rs.map((r) => r.metrics.loudADb)), maxLoudA: Math.max.apply(null, rs.map((r) => r.metrics.loudADb)) };
  }

  if (SUGGEST) {
    // Average the steps of a stepped effect, then say how to scale its gain in sfx.ts.
    const groups = {};
    for (const r of results) {
      const name = r.id.split('-')[0];
      (groups[name] = groups[name] || { cls: r.cls, vals: [], peaks: [] }).vals.push(r.metrics.loudADb);
      groups[name].peaks.push(r.metrics.peakDb);
    }
    out('');
    out('GAIN SUGGESTIONS (multiply the effect\'s gain in src/audio/sfx.ts by this factor)');
    for (const name of Object.keys(groups)) {
      const g = groups[name];
      const mean = g.vals.reduce((a, b) => a + b, 0) / g.vals.length;
      const target = (g.cls === 'ui' ? TARGET.ui : TARGET.game) + (INTENT[name] || 0);
      const change = target - mean;
      const peakAfter = Math.max.apply(null, g.peaks) + change;
      out('  ' + pad(name, 13) + padL(f(mean), 7) + ' → ' + padL(f(target), 6) + ' dB(A)   ×' + f(Math.pow(10, change / 20), 2) + '   peak then ' + f(peakAfter) + ' dBFS');
    }
  }

  // Shape checks: do the sounds move the way their design says?
  const by = {};
  for (const r of results) by[r.id] = r;
  const shape = [];
  const want = (id, ok, text) => {
    if (!by[id.split('|')[0]]) return;
    shape.push((ok ? 'ok   ' : 'FAIL ') + text);
    if (!ok) fail('shape', text);
  };
  // match: each step is the expected scale tone, strictly rising, capped at the top.
  if (by['match-1']) {
    let rising = true;
    let exact = true;
    const got = [];
    for (let s = 1; s <= expected.match.length; s++) {
      const r = by['match-' + s];
      if (!r) continue;
      got.push(Math.round(r.metrics.pitch));
      const e = expected.match[s - 1];
      if (Math.abs(r.metrics.pitch / e - 1) > 0.012) exact = false;
      if (s > 1 && by['match-' + (s - 1)] && r.metrics.pitch <= by['match-' + (s - 1)].metrics.pitch * 1.02) rising = false;
    }
    want('match-1', rising, 'match pitch rises with every step: ' + got.join(' < ') + ' Hz');
    want('match-1', exact, 'match pitches are the D–F♯–G–A–C ladder (expected ' + expected.match.map((x) => Math.round(x)).join(', ') + ' Hz)');
  }
  if (by['star-1'] && by['star-2'] && by['star-3']) {
    const p = [1, 2, 3].map((s) => by['star-' + s].metrics.pitch);
    want('star-1', p[0] < p[1] && p[1] < p[2], 'star pitch rises 1→3: ' + p.map((x) => Math.round(x)).join(' < ') + ' Hz');
    const e = expected.star;
    want('star-1', p.every((x, i) => Math.abs(x / e[i] - 1) < 0.012), 'star pitches are F♯5, A5, D6');
  }
  if (by['praise-1'] && by['praise-4']) {
    const d = [1, 2, 3, 4].map((s) => by['praise-' + s].nominal);
    const c = [1, 2, 3, 4].map((s) => by['praise-' + s].metrics.centroid);
    want('praise-1', d[0] < d[1] && d[1] < d[2] && d[2] <= d[3], 'praise grows longer with intensity: ' + d.map((x) => f(x, 2)).join(' < ') + ' s');
    want('praise-1', c[0] < c[2], 'praise grows brighter with intensity: centroid ' + c.map((x) => Math.round(x)).join(', ') + ' Hz');
  }
  const falls = (id, factor) => {
    const r = by[id];
    if (!r) return;
    want(id, r.metrics.centroidStart > r.metrics.centroidEnd * factor, id + ' sweeps down: ' + f(r.metrics.centroidStart, 0) + ' → ' + f(r.metrics.centroidEnd, 0) + ' Hz');
  };
  const rises = (id, factor) => {
    const r = by[id];
    if (!r) return;
    want(id, r.metrics.centroidEnd > r.metrics.centroidStart * factor, id + ' sweeps up: ' + f(r.metrics.centroidStart, 0) + ' → ' + f(r.metrics.centroidEnd, 0) + ' Hz');
  };
  falls('beam', 1.5);
  falls('nova', 1.5);
  falls('bigCombo', 1.3);
  falls('popupClose', 1.2);
  falls('invalid', 1.05);
  falls('lifeLost', 1.1);
  falls('lose', 1.1);
  rises('popupOpen', 1.2);
  rises('select', 1.1);
  rises('swap', 1.2);
  rises('createBeam', 1.2);
  rises('booster', 1.3);
  if (shape.length) {
    out('');
    out('SHAPE');
    for (const s of shape) out('  ' + s);
  }
  return results;
}

// ───────────────────────── music ─────────────────────────
async function checkMusic(page, report) {
  out('');
  out('MUSIC — 20 s of each track, offline (scheduler stepped every 100 ms), through music bus → master → limiter → trim → guard');
  report.music = [];
  for (const track of ['menu', 'level']) {
    const r = await page.evaluate((t) => window.__audioLab.musicReport(t, 20, 20240521), track);
    save(r);
    report.music.push(slim(r));
    const m = r.metrics;
    const flags = [];
    const perBar = r.leadPerBar.map((x, i) => x + r.percPerBar[i]);
    const avg = perBar.reduce((a, b) => a + b, 0) / perBar.length;
    const leadAvg = r.leadPerBar.reduce((a, b) => a + b, 0) / r.leadPerBar.length;
    const emptyLeadRun = (() => {
      let run = 0;
      let worst = 0;
      for (const x of r.leadPerBar) {
        run = x === 0 ? run + 1 : 0;
        worst = Math.max(worst, run);
      }
      return worst;
    })();
    if (m.clips) flags.push('CLIPS');
    if (m.silent) flags.push('SILENT');
    if (Math.abs(m.dc) > LIMITS.dc) flags.push('DC');
    if (avg < LIMITS.musicOnsetsPerBar[0] || avg > LIMITS.musicOnsetsPerBar[1]) flags.push('ONSET-DENSITY');
    if (leadAvg < 1.5) flags.push('LEAD-TOO-SPARSE');
    if (emptyLeadRun > 2) flags.push('LEAD-GAP');
    if (r.heard < r.scheduled * 0.4) flags.push('ONSETS-NOT-HEARD');
    if (Math.abs(r.firstHalfDb - r.secondHalfDb) > LIMITS.musicHalves) flags.push('DRIFT');
    if (r.longestSilence > LIMITS.musicGap) flags.push('SILENCE-GAP');
    if (report.sfxMedianLoud !== undefined && m.rmsDb > report.sfxMedianLoud - LIMITS.musicUnderSfx) flags.push('TOO-LOUD-VS-SFX');
    if (report.sfxMedianLoud !== undefined && m.rmsDb < report.sfxMedianLoud - 24) flags.push('TOO-QUIET');
    if (report.sfxMedianLoudA !== undefined && r.loudness.max > report.sfxMedianLoudA - LIMITS.musicMaxUnder) flags.push('LOUD-MOMENTS');
    if (report.sfxMedianLoudA !== undefined && r.loudness.p95 > report.sfxMedianLoudA - LIMITS.musicP95Under) flags.push('LOUD-P95');
    if (m.peak > LIMITS.musicPeak) flags.push('PEAK');
    out('');
    out(r.id + ': ' + r.bpm + ' BPM, bar ' + f(r.barDuration, 3) + ' s, ' + r.bars + ' full bars   ' + (flags.join(' ') || 'ok'));
    out('  peak ' + f(m.peakDb) + ' dBFS · rms ' + f(m.rmsDb) + ' dBFS · loudest 50 ms ' + f(m.loudDb) + ' dBFS · A-weighted ' + f(m.loudADb) + ' dB · DC ' + m.dc.toExponential(0) + ' · centroid ' + f(m.centroid, 0) + ' Hz');
    out('  note onsets per bar, scheduled (lead+perc): ' + perBar.join(' ') + '   avg ' + f(avg));
    out('     lead only:                              ' + r.leadPerBar.join(' ') + '   avg ' + f(leadAvg));
    out('     heard in the audio (spectral flux):     ' + r.heardPerBar.join(' ') + '   total ' + r.heard + ' of ' + r.scheduled + ' scheduled');
    out('  loudness first half ' + f(r.firstHalfDb) + ' dBFS · second half ' + f(r.secondHalfDb) + ' dBFS · difference ' + f(Math.abs(r.firstHalfDb - r.secondHalfDb)) + ' dB');
    out('  longest silence ' + f(r.longestSilence, 2) + ' s · layers alone: lead ' + f(r.layerDb.lead) + ' · pad ' + f(r.layerDb.pad) + ' · perc ' + f(r.layerDb.perc) + ' dBFS');
    if (report.sfxMedianLoud !== undefined) {
      out('  music rms is ' + f(report.sfxMedianLoud - m.rmsDb) + ' dB under the median effect (loudest 50 ms ' + f(report.sfxMedianLoud) + ' dBFS)');
    }
    if (report.sfxMedianLoudA !== undefined) {
      out('  like for like, A-weighted frames: loudest ' + f(r.loudness.max) + ' · 95th percentile ' + f(r.loudness.p95) + ' · median ' + f(r.loudness.p50) + ' dB — the loudest moment is ' +
        f(report.sfxMedianLoudA - r.loudness.max) + ' dB under the median game effect (' + f(report.sfxMedianLoudA) + ')' +
        (report.uiMedianLoudA !== undefined ? ' and ' + f(report.uiMedianLoudA - r.loudness.max) + ' dB under the median UI sound (' + f(report.uiMedianLoudA) + ')' : ''));
    }
    for (const fl of flags) fail(r.id, fl);
  }
}

// ───────────────────────── output stage ─────────────────────────
async function checkOutput(page, report) {
  out('');
  out('OUTPUT STAGE');
  const storm = await page.evaluate(() => window.__audioLab.stormReport());
  save(storm);
  report.storm = slim(storm);
  const sm = storm.metrics;
  const stormOk = sm.peak < LIMITS.clipPeak;
  out('  storm (level music + every effect at once + two walls of the heaviest): peak ' + f(sm.peak, 3) + ' (' + f(sm.peakDb) + ' dBFS) · rms ' + f(sm.rmsDb) + ' dBFS   ' + (stormOk ? 'ok' : 'CLIPS'));
  if (!stormOk) fail('storm', 'peak ' + sm.peak);
  const transfer = await page.evaluate(() => window.__audioLab.chainTransfer());
  report.transfer = transfer;
  out('  1 kHz sine into the effects bus → output:');
  out('    in dBFS   ' + transfer.map((t) => padL(f(t.inDb, 0), 7)).join(''));
  out('    out peak  ' + transfer.map((t) => padL(f(t.outPeakDb), 7)).join(''));
  out('    out rms   ' + transfer.map((t) => padL(f(t.outRmsDb), 7)).join(''));
  for (const t of transfer) {
    if (Math.pow(10, t.outPeakDb / 20) >= LIMITS.clipPeak) fail('output stage', 'clips at ' + t.inDb + ' dBFS in');
  }
  // The limiter starts life half shut (about 0.18 s); the first tap of a session must not
  // be swallowed by that.
  out('  first sound of a brand-new context (5 ms after its start) against the same sound later (loudest 50 ms, dBFS):');
  report.startup = [];
  for (const v of [{ name: 'button' }, { name: 'match', step: 1 }, { name: 'land' }, { name: 'levelStart' }]) {
    const r = await page.evaluate((x) => window.__audioLab.startupReport(x.name, x.step), v);
    const diff = r.earlyDb - r.lateDb;
    const ok = Math.abs(diff) <= LIMITS.startup && r.earlyPeak < LIMITS.clipPeak;
    report.startup.push(Object.assign({ id: v.name }, r));
    out('    ' + pad(v.name, 11) + ' first ' + padL(f(r.earlyDb), 6) + '   later ' + padL(f(r.lateDb), 6) + '   difference ' + padL((diff >= 0 ? '+' : '') + f(diff), 5) + ' dB   ' + (ok ? 'ok' : 'FAIL'));
    if (!ok) fail('output stage', 'first sound of a context (' + v.name + ') is ' + f(diff) + ' dB off');
  }
}

// ───────────────────────── three minutes of music ─────────────────────────
async function checkLongMusic(page, report) {
  out('');
  out('LONG-FORM MUSIC — ' + LIMITS.longSeconds + ' s of each track, offline, scheduler stepped every 100 ms exactly as the live engine ticks');
  report.longMusic = [];
  for (const track of ['menu', 'level']) {
    const r = await page.evaluate((a) => window.__audioLab.longMusicReport(a.track, a.seconds, 20240521, 0.1), { track, seconds: LIMITS.longSeconds });
    fs.writeFileSync(path.join(OUT, 'music-' + track + '-long.wav'), Buffer.from(r.wav, 'base64'));
    fs.writeFileSync(path.join(OUT, 'music-' + track + '-long.png'), Buffer.from(r.png.split(',')[1], 'base64'));
    report.longMusic.push(slim(r));
    const flags = [];
    const minuteSpread = Math.max.apply(null, r.minuteDb) - Math.min.apply(null, r.minuteDb);
    const tenSpread = Math.max.apply(null, r.tenSecondDb) - Math.min.apply(null, r.tenSecondDb);
    const firstLast = Math.abs(r.minuteDb[0] - r.minuteDb[r.minuteDb.length - 1]);
    if (r.clips) flags.push('CLIPS');
    if (r.peak > LIMITS.musicPeak) flags.push('PEAK');
    if (r.longestSilence > LIMITS.musicGap) flags.push('SILENCE-GAP');
    if (minuteSpread > LIMITS.longMinutes) flags.push('DRIFT');
    if (tenSpread > LIMITS.longTenSeconds) flags.push('UNEVEN');
    if (r.firstLastDifference < LIMITS.longDifference) flags.push('LOOPS(samples)');
    if (r.repeatedBars > r.barsPerMinute * 0.5) flags.push('LOOPS(notes)');
    if (r.distinctBars < r.leadBars * 0.5) flags.push('REPETITIVE');
    if (r.dropped !== 0 || r.resyncs !== 0) flags.push('SCHEDULER');
    if (r.maxNodes > LIMITS.longNodes) flags.push('NODES');
    if (r.lastMinuteNodes > r.firstMinuteNodes * 1.5 + 10) flags.push('NODE-GROWTH');
    if (r.endVoices !== 0 || r.endNodes !== 0) flags.push('LEAK');
    if (report.sfxMedianLoudA !== undefined && r.loudness.max > report.sfxMedianLoudA - LIMITS.musicMaxUnder) flags.push('LOUD-MOMENTS');
    if (report.sfxMedianLoudA !== undefined && r.loudness.p95 > report.sfxMedianLoudA - LIMITS.musicP95Under) flags.push('LOUD-P95');
    out('');
    out('music-' + track + ' ' + r.seconds + ' s: ' + r.bars + ' bars, ' + r.events + ' events scheduled, ' + r.dropped + ' dropped, ' + r.resyncs + ' grid restarts   ' + (flags.join(' ') || 'ok'));
    out('  peak ' + f(r.peak, 3) + ' (' + f(20 * Math.log10(r.peak)) + ' dBFS) · rms ' + f(r.rmsDb) + ' dBFS · A-weighted frames: loudest ' + f(r.loudness.max) + ', 95th percentile ' + f(r.loudness.p95) + ', median ' + f(r.loudness.p50) + ' dB');
    out('  layers alone (first minute): lead ' + f(r.layerDb.lead) + ' · pad ' + f(r.layerDb.pad) + ' · perc ' + f(r.layerDb.perc) + ' dBFS');
    out('  loudness per minute ' + r.minuteDb.map((x) => f(x)).join(' / ') + ' dBFS (first vs last ' + f(firstLast) + ' dB apart, spread ' + f(minuteSpread) + ' dB) · per 10 s from ' + f(Math.min.apply(null, r.tenSecondDb)) + ' to ' + f(Math.max.apply(null, r.tenSecondDb)) + ' (spread ' + f(tenSpread) + ' dB)');
    out('  longest silence ' + f(r.longestSilence, 2) + ' s');
    out('  first vs last minute: waveform difference ' + f(r.firstLastDifference, 2) + ' (0 = same samples, ~1 = unrelated) · ' + r.repeatedBars + ' of ' + r.barsPerMinute + ' bars note-for-note the same · ' + r.distinctBars + ' distinct lead lines in ' + r.leadBars + ' bars');
    out('  audio nodes alive: at most ' + r.maxNodes + ' in ' + r.maxVoices + ' voices (first minute ' + r.firstMinuteNodes + ', last minute ' + r.lastMinuteNodes + ') · left when everything had ended: ' + r.endVoices + ' voices, ' + r.endNodes + ' nodes');
    if (report.sfxMedianLoudA !== undefined) {
      out('  loudest moment is ' + f(report.sfxMedianLoudA - r.loudness.max) + ' dB under the median game effect' + (report.uiMedianLoudA !== undefined ? ' and ' + f(report.uiMedianLoudA - r.loudness.max) + ' dB under the median UI sound' : '') + '; the 95th percentile is ' + f(report.sfxMedianLoudA - r.loudness.p95) + ' dB under');
    }
    for (const fl of flags) fail('music-' + track + ' long', fl);
  }
}

// ───────────────────────── live engine ─────────────────────────
async function checkLive(browser, report) {
  out('');
  out('LIVE ENGINE (headless Chromium, real AudioContext)');
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(PAGE_URL);
  await page.waitForFunction(() => window.__audioLab && window.__audioLab.ready);
  const results = [];
  const step = (name, ok, detail) => {
    results.push({ name, ok, detail });
    out('  ' + (ok ? 'ok   ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
    if (!ok) fail('live', name + (detail ? ' — ' + detail : ''));
  };
  const snap = () => page.evaluate(() => window.__audioLab.snapshot());
  const listen = (ms) => page.evaluate((t) => window.__audioLab.listen(t), ms);
  const until = async (pred, ms) => {
    const end = Date.now() + ms;
    let s = await snap();
    while (!pred(s) && Date.now() < end) {
      await sleep(40);
      s = await snap();
    }
    return s;
  };

  // 1. Before any gesture: nothing throws, nothing plays, the request is remembered.
  let threw = await page.evaluate(() => {
    try {
      const a = window.__audioLab.audio;
      a.sfx('match', { step: 2 });
      a.sfx('win');
      a.music('menu');
      a.setSfxEnabled(true);
      a.setMusicEnabled(true);
      a.suspend();
      a.resume();
      a.sfx('nonsense');
      a.music('nonsense');
      a.music('menu');
      return null;
    } catch (e) {
      return String(e);
    }
  });
  let s = await snap();
  step('calls before unlock do not throw', threw === null, threw || '');
  step('nothing exists before unlock', s.state === 'none' && s.playing === null && s.sfxPlayed === 0, 'context ' + s.state + ', wanted track ' + s.track);

  // 2. A real click unlocks; the track asked for earlier starts by itself.
  await page.click('#unlock');
  s = await until((x) => x.state === 'running' && x.playing === 'menu', 4000);
  step('unlock() by a click starts the context', s.state === 'running', 'state ' + s.state);
  step('music requested before unlock starts once unlocked', s.playing === 'menu' && s.schedulerRunning, 'playing ' + s.playing);
  step('effects fired before unlock were not queued', s.sfxPlayed === 0, 'played ' + s.sfxPlayed);
  let level = await listen(1600);
  step('menu music is audible at the output', level.rms > 0.002, 'rms ' + f(20 * Math.log10(level.rms + 1e-9)) + ' dBFS, peak ' + f(level.peak, 3));
  const menuStats = (await snap()).music;

  // 3. Storm: 200 effects in one frame.
  const storm = await page.evaluate(() => {
    const lab = window.__audioLab;
    const before = lab.snapshot();
    let err = null;
    const t0 = performance.now();
    try {
      for (let i = 0; i < 200; i++) lab.audio.sfx(lab.names[i % lab.names.length], { step: 1 + (i % 11) });
    } catch (e) {
      err = String(e);
    }
    const ms = performance.now() - t0;
    const after = lab.snapshot();
    return { err, ms, voices: after.voices, maxVoices: after.maxVoices, played: after.sfxPlayed - before.sfxPlayed, dropped: after.sfxDropped - before.sfxDropped };
  });
  step('200 effects in one frame do not throw', storm.err === null, storm.err || 'took ' + f(storm.ms) + ' ms');
  step('voice count stays capped', storm.voices <= storm.maxVoices && storm.played <= storm.maxVoices && storm.played + storm.dropped === 200, storm.voices + ' voices (cap ' + storm.maxVoices + '), ' + storm.played + ' started, ' + storm.dropped + ' dropped');
  level = await listen(700);
  step('storm does not clip the live output', level.peak < LIMITS.clipPeak, 'peak ' + f(level.peak, 3));
  s = await until((x) => x.voices === 0, 4000);
  step('every voice ends and is released', s.voices === 0, s.voices + ' voices left');

  // 4. Rate limit: the same sound ten times in a row plays once.
  const burst = await page.evaluate(() => {
    const lab = window.__audioLab;
    const before = lab.snapshot().sfxPlayed;
    for (let i = 0; i < 10; i++) lab.audio.sfx('coin');
    for (let i = 0; i < 10; i++) lab.audio.sfx('match', { step: 3 });
    lab.audio.sfx('match', { step: 4 });
    return lab.snapshot().sfxPlayed - before;
  });
  step('identical effects within 30 ms are rate-limited', burst === 3, burst + ' started out of 21 calls (coin ×10, match-3 ×10, match-4 ×1)');
  await sleep(120);
  const again = await page.evaluate(() => {
    const lab = window.__audioLab;
    const before = lab.snapshot().sfxPlayed;
    lab.audio.sfx('coin');
    return lab.snapshot().sfxPlayed - before;
  });
  step('the same effect plays again after the interval', again === 1, '');

  // 5. Track switching.
  await page.evaluate(() => window.__audioLab.audio.music('menu'));
  s = await snap();
  step('music(current track) is a no-op', s.playing === 'menu' && s.music && s.music.bars >= menuStats.bars, 'bars ' + (s.music ? s.music.bars : '—'));
  await page.evaluate(() => window.__audioLab.audio.music('level'));
  s = await snap();
  step('music("level") switches track', s.playing === 'level', 'playing ' + s.playing);
  await sleep(900);
  level = await listen(900);
  step('level music is audible after the cross-fade', level.rms > 0.002, 'rms ' + f(20 * Math.log10(level.rms + 1e-9)) + ' dBFS');
  // A jingle pulls the music down while it plays.
  const levelBefore = (await snap()).musicLevel;
  await page.evaluate(() => window.__audioLab.audio.sfx('win'));
  await sleep(350);
  const levelDuring = (await snap()).musicLevel;
  await sleep(2600);
  const levelAfter = (await snap()).musicLevel;
  step('music ducks under a jingle and comes back', levelDuring < levelBefore * 0.6 && levelAfter > levelBefore * 0.97, 'music bus ' + f(levelBefore, 2) + ' → ' + f(levelDuring, 2) + ' → ' + f(levelAfter, 2));
  await page.evaluate(() => window.__audioLab.audio.music(null));
  s = await snap();
  step('music(null) stops scheduling', s.playing === null && !s.schedulerRunning, 'scheduler ' + (s.schedulerRunning ? 'on' : 'off'));
  await sleep(1100);
  level = await listen(400);
  step('output is silent after the fade-out', level.rms < 0.0005, 'rms ' + level.rms.toExponential(1));

  // 6. Toggles.
  await page.evaluate(() => window.__audioLab.audio.music('menu'));
  await sleep(1000);
  await page.evaluate(() => window.__audioLab.audio.setMusicEnabled(false));
  s = await snap();
  step('setMusicEnabled(false) stops the music at once', s.playing === null && s.track === 'menu', 'playing ' + s.playing + ', remembered ' + s.track);
  await sleep(1100);
  level = await listen(400);
  step('music faded to silence', level.rms < 0.0005, 'rms ' + level.rms.toExponential(1));
  await page.evaluate(() => window.__audioLab.audio.setMusicEnabled(true));
  s = await snap();
  step('setMusicEnabled(true) brings the track back', s.playing === 'menu', 'playing ' + s.playing);
  const offSfx = await page.evaluate(() => {
    const lab = window.__audioLab;
    lab.audio.sfx('win');
    lab.audio.setSfxEnabled(false);
    const voices = lab.snapshot().voices;
    const before = lab.snapshot().sfxPlayed;
    lab.audio.sfx('win');
    lab.audio.sfx('match');
    return { voices, started: lab.snapshot().sfxPlayed - before };
  });
  step('setSfxEnabled(false) cuts and ignores effects', offSfx.voices === 0 && offSfx.started === 0, offSfx.voices + ' voices, ' + offSfx.started + ' started');
  await page.evaluate(() => window.__audioLab.audio.setMusicEnabled(false));
  s = await until((x) => x.state === 'suspended', 2500);
  step('with effects and music both off the context sleeps', s.state === 'suspended', 'state ' + s.state);
  const onSfx = await page.evaluate(() => {
    const lab = window.__audioLab;
    lab.audio.setSfxEnabled(true);
    return lab.snapshot().state;
  });
  s = await until((x) => x.state === 'running', 2500);
  step('switching effects back on wakes it', s.state === 'running', 'state ' + onSfx + ' → ' + s.state);
  const backSfx = await page.evaluate(() => {
    const lab = window.__audioLab;
    const before = lab.snapshot().sfxPlayed;
    lab.audio.sfx('star', { step: 2 });
    return lab.snapshot().sfxPlayed - before;
  });
  step('effects play again', backSfx === 1, '');
  await page.evaluate(() => window.__audioLab.audio.setMusicEnabled(true));
  s = await until((x) => x.playing === 'menu', 2500);
  step('music returns with its toggle', s.playing === 'menu', 'playing ' + s.playing);

  // 7. Suspend / resume.
  await sleep(700);
  const sus = await page.evaluate(() => {
    const lab = window.__audioLab;
    lab.audio.sfx('reward');
    lab.audio.suspend();
    const a = lab.snapshot();
    lab.audio.sfx('win');
    lab.audio.music('menu');
    return { a, started: lab.snapshot().sfxPlayed - a.sfxPlayed };
  });
  step('suspend() stops scheduling at once', sus.a.playing === null && !sus.a.schedulerRunning && sus.a.voices === 0 && sus.started === 0, 'scheduler ' + (sus.a.schedulerRunning ? 'on' : 'off') + ', voices ' + sus.a.voices);
  s = await until((x) => x.state === 'suspended', 2500);
  const t1 = s.time;
  await sleep(400);
  s = await snap();
  step('suspend() suspends the context', s.state === 'suspended' && Math.abs(s.time - t1) < 0.01, 'state ' + s.state + ', clock stopped at ' + f(s.time, 2) + ' s');
  await page.evaluate(() => window.__audioLab.audio.resume());
  s = await until((x) => x.state === 'running' && x.playing === 'menu', 3000);
  step('resume() restarts the context and the previous track', s.state === 'running' && s.playing === 'menu', 'state ' + s.state + ', playing ' + s.playing);
  await sleep(700);
  level = await listen(900);
  step('music is audible again after resume', level.rms > 0.002, 'rms ' + f(20 * Math.log10(level.rms + 1e-9)) + ' dBFS');
  await page.evaluate(() => {
    const a = window.__audioLab.audio;
    a.setMusicEnabled(false);
    a.suspend();
    a.resume();
  });
  await sleep(500);
  s = await snap();
  step('resume() leaves music off when it is disabled', s.playing === null && s.state === 'running', 'playing ' + s.playing);
  await page.evaluate(() => window.__audioLab.audio.setMusicEnabled(true));

  // 8. A stalled main thread (timer cannot fire for 0.8 s): notes are skipped, not bunched.
  await page.evaluate(() => window.__audioLab.audio.music('level'));
  await sleep(1500);
  const stall = await page.evaluate(() => {
    const lab = window.__audioLab;
    const before = lab.snapshot().music;
    const t0 = performance.now();
    while (performance.now() - t0 < 800) {
      /* block */
    }
    return before;
  });
  await sleep(1500);
  s = await snap();
  const skipped = s.music.dropped - stall.dropped + (s.music.resyncs - stall.resyncs);
  step('a stalled scheduler skips late notes instead of bunching them', skipped > 0 && s.music.events > stall.events, 'dropped ' + (s.music.dropped - stall.dropped) + ', grid restarts ' + (s.music.resyncs - stall.resyncs) + ', then ' + (s.music.events - stall.events) + ' more events scheduled');
  level = await listen(500);
  step('no burst after the stall', level.peak < 0.7, 'peak ' + f(level.peak, 3));

  await page.evaluate(() => window.__audioLab.audio.music(null));
  step('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  report.live = results;
  await page.close();
}

// ───────────────────────── adversarial live tests ─────────────────────────
/*
 * Every scenario runs in its own page (its own engine and AudioContext), unlocked by a real
 * click. Two instruments from the lab page look at what really happens:
 *   rec   — an AudioWorklet that copies every sample leaving the output chain;
 *   probe — notes every source start: the time it was scheduled for and the audio clock at
 *           that moment, so a note scheduled in the past (late) or a crowd of notes at one
 *           instant (a burst) cannot hide.
 */
async function checkAdversarial(browser, report) {
  out('');
  out('ADVERSARIAL LIVE TESTS (headless Chromium, real AudioContext; output recorded sample by sample)');
  const results = [];
  const step = (name, ok, detail) => {
    results.push({ name, ok, detail });
    out('  ' + (ok ? 'ok   ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
    if (!ok) fail('adversarial', name + (detail ? ' — ' + detail : ''));
  };
  const db = (x) => f(20 * Math.log10(Math.max(x, 1e-9)));
  const snapOf = (page) => page.evaluate(() => window.__audioLab.snapshot());
  const untilOf = async (page, pred, ms) => {
    const end = Date.now() + ms;
    let s = await snapOf(page);
    while (!pred(s) && Date.now() < end) {
      await sleep(30);
      s = await snapOf(page);
    }
    return s;
  };
  const open = async (unlock) => {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.goto(PAGE_URL);
    await page.waitForFunction(() => window.__audioLab && window.__audioLab.ready);
    if (unlock !== false) {
      await page.click('#unlock');
      await untilOf(page, (x) => x.state === 'running', 4000);
    }
    return { page, errors };
  };
  const saveRec = async (page, id, title) => {
    const files = await page.evaluate((t) => window.__audioLab.rec.files(t), title);
    if (!files) return;
    fs.writeFileSync(path.join(OUT, id + '.wav'), Buffer.from(files.wav, 'base64'));
    fs.writeFileSync(path.join(OUT, id + '.png'), Buffer.from(files.png.split(',')[1], 'base64'));
  };
  /** Largest number of entries of `times` inside any window of `width` seconds. */
  const crowd = (times, width) => {
    const t = times.slice().sort((a, b) => a - b);
    let best = 0;
    let lo = 0;
    for (let hi = 0; hi < t.length; hi++) {
      while (t[hi] - t[lo] > width) lo++;
      best = Math.max(best, hi - lo + 1);
    }
    return best;
  };
  const maxOf = (xs, a, b) => {
    let m = 0;
    for (let i = Math.max(0, a); i < Math.min(xs.length, b); i++) m = Math.max(m, xs[i]);
    return m;
  };

  // ── 1. 500 effects in one tick, over music ──
  {
    out('  · 500 effects in one tick');
    const { page, errors } = await open();
    await page.evaluate(() => window.__audioLab.audio.music('level'));
    await sleep(1600);
    const base = await snapOf(page);
    const r = await page.evaluate(async () => {
      const lab = window.__audioLab;
      await lab.rec.start();
      lab.probe.start();
      const before = lab.snapshot();
      let err = null;
      const t0 = performance.now();
      try {
        for (let i = 0; i < 500; i++) lab.audio.sfx(lab.names[i % lab.names.length], { step: 1 + (i % 13), volume: 0.5 + (i % 5) * 0.125 });
      } catch (e) {
        err = String(e);
      }
      const ms = performance.now() - t0;
      const after = lab.snapshot();
      await new Promise((resolve) => setTimeout(resolve, 2800));
      const rec = await lab.rec.stop();
      const probe = lab.probe.stop();
      return { err, ms, before, after, rec: { peak: rec.peak, holes: rec.holes, seconds: rec.seconds, rmsDb: rec.rmsDb }, probe: { starts: probe.starts, late: probe.late, worstLead: probe.worstLead } };
    });
    await saveRec(page, 'live-flood', 'live: 500 effects in one tick over level music');
    const played = r.after.sfxPlayed - r.before.sfxPlayed;
    const dropped = r.after.sfxDropped - r.before.sfxDropped;
    step('500 effects in one tick do not throw', r.err === null, r.err || 'took ' + f(r.ms) + ' ms');
    step('the flood is capped', played <= r.after.maxVoices && played + dropped === 500, played + ' started (cap ' + r.after.maxVoices + '), ' + dropped + ' dropped, ' + (r.after.liveNodes - r.before.liveNodes) + ' audio nodes added');
    step('the flood does not clip the real output', r.rec.peak < LIMITS.clipPeak && r.rec.holes === 0, 'recorded peak ' + f(r.rec.peak, 3) + ' over ' + f(r.rec.seconds, 2) + ' s');
    step('no source of the flood was scheduled in the past', r.probe.late === 0, r.probe.starts + ' sources started, smallest lead ' + f(r.probe.worstLead * 1000, 1) + ' ms');
    const s = await untilOf(page, (x) => x.voices === 0 && x.liveVoices <= base.liveVoices + 4, 4000);
    step('every effect voice is released afterwards', s.voices === 0 && s.liveVoices <= base.liveVoices + 4, s.liveVoices + ' voices / ' + s.liveNodes + ' nodes alive (music alone before: ' + base.liveVoices + ' / ' + base.liveNodes + ')');
    // Junk in, nothing out.
    const junk = await page.evaluate(() => {
      const a = window.__audioLab.audio;
      const before = window.__audioLab.snapshot().sfxPlayed;
      try {
        for (const name of ['__proto__', 'constructor', 'toString', 'hasOwnProperty', '', 'nope', null, undefined, 42, {}, []]) a.sfx(name, { step: 3 });
        a.sfx('match', null);
        a.sfx('match', { step: Infinity, volume: -1 });
        a.sfx('match', { step: -Infinity, volume: NaN });
        a.sfx('star', { step: 1e9 });
        a.sfx('praise', { step: '3', volume: '1' });
        a.music(42);
        a.music({});
        a.music('level');
        a.setSfxEnabled('yes');
        a.setMusicEnabled(1);
        return { err: null, played: window.__audioLab.snapshot().sfxPlayed - before };
      } catch (e) {
        return { err: String(e), played: 0 };
      }
    });
    step('junk names and options are ignored without throwing', junk.err === null && junk.played <= 5, junk.err || junk.played + ' real effects started out of 16 junk calls');
    step('no page errors (flood)', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }

  // ── 2. rapid music switching ──
  {
    out('  · rapid music switching');
    const { page, errors } = await open();
    await page.evaluate(() => window.__audioLab.audio.music('menu'));
    await sleep(1500);
    const base = await snapOf(page);
    const r = await page.evaluate(async () => {
      const lab = window.__audioLab;
      await lab.rec.start();
      const tracks = ['menu', 'level', null];
      let seed = 12345;
      let maxFading = 0;
      let maxNodes = 0;
      let changes = 0;
      let last = 'menu';
      const startsBefore = lab.snapshot().musicStarts;
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      for (let i = 0; i < 80; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const t = tracks[seed % 3];
        if (t !== last) changes++;
        last = t;
        lab.audio.music(t);
        const s = lab.snapshot();
        maxFading = Math.max(maxFading, s.fading);
        maxNodes = Math.max(maxNodes, s.liveNodes);
        await wait(25);
      }
      // thirty changes inside one tick
      for (let i = 0; i < 30; i++) lab.audio.music(i % 2 ? 'menu' : 'level');
      const burst = lab.snapshot();
      lab.audio.music('level');
      const afterSwitch = lab.snapshot();
      // … and forty redundant calls
      for (let i = 0; i < 40; i++) lab.audio.music('level');
      const afterRedundant = lab.snapshot();
      await wait(1700);
      const rec = await lab.rec.stop();
      return {
        maxFading, maxNodes, changes, burstFading: burst.fading, burstNodes: burst.liveNodes,
        starts: afterSwitch.musicStarts - startsBefore, redundantStarts: afterRedundant.musicStarts - afterSwitch.musicStarts,
        barsA: afterSwitch.music ? afterSwitch.music.bars : -1, barsB: afterRedundant.music ? afterRedundant.music.bars : -1,
        end: lab.snapshot(),
        rec: { peak: rec.peak, holes: rec.holes, maxStep: rec.maxStep, seconds: rec.seconds, tailRms: Math.max.apply(null, rec.rms20.slice(-40)) },
      };
    });
    await saveRec(page, 'live-switching', 'live: 80 track changes in 2 s, 30 in one tick, then level');
    step('110 track changes end on the track asked for last', r.end.playing === 'level' && r.end.track === 'level' && r.end.schedulerRunning, 'playing ' + r.end.playing + ' after ' + r.starts + ' player starts');
    step('redundant music() calls start nothing', r.redundantStarts === 0 && r.barsB >= r.barsA, r.redundantStarts + ' extra players after 40 identical calls');
    step('fading players do not pile up', r.maxFading <= 6 && r.burstFading <= 2 && r.end.fading === 0, 'at most ' + r.maxFading + ' fading at once (after 30 changes in one tick: ' + r.burstFading + '), ' + r.end.fading + ' left at the end');
    step('audio nodes stay bounded while switching', r.maxNodes <= base.liveNodes * 4 + 60 && r.end.liveNodes <= base.liveNodes * 2 + 40, 'at most ' + r.maxNodes + ' nodes, ' + r.end.liveNodes + ' at the end (one track alone: ' + base.liveNodes + ')');
    step('switching neither clips nor clicks', r.rec.peak < LIMITS.musicPeak + 0.1 && r.rec.maxStep < 0.2 && r.rec.holes === 0, 'recorded peak ' + f(r.rec.peak, 3) + ', largest sample-to-sample jump ' + f(r.rec.maxStep, 3));
    step('the last track is audible', r.rec.tailRms > 0.002, 'rms ' + db(r.rec.tailRms) + ' dBFS in the last 0.8 s');
    step('no page errors (switching)', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }

  // ── 3. suspend in the middle of a cross-fade, then resume ──
  {
    out('  · suspend during a cross-fade, then resume');
    const { page, errors } = await open();
    await page.evaluate(() => window.__audioLab.audio.music('menu'));
    await sleep(1500);
    await page.evaluate(() => window.__audioLab.audio.music('level'));
    await sleep(250);
    const r = await page.evaluate(async () => {
      const lab = window.__audioLab;
      const mid = lab.snapshot();
      lab.audio.suspend();
      const at = lab.snapshot();
      lab.audio.sfx('win');
      lab.audio.music('level');
      return { mid, at, started: lab.snapshot().sfxPlayed - at.sfxPlayed };
    });
    step('the cross-fade was really in progress', r.mid.fading === 1 && r.mid.playing === 'level', r.mid.fading + ' player fading, playing ' + r.mid.playing);
    step('suspend() drops both players and every voice at once', r.at.playing === null && r.at.fading === 0 && r.at.liveVoices === 0 && !r.at.schedulerRunning && r.started === 0, 'playing ' + r.at.playing + ', fading ' + r.at.fading + ', ' + r.at.liveVoices + ' voices, ' + r.at.liveNodes + ' nodes');
    let s = await untilOf(page, (x) => x.state === 'suspended', 2500);
    step('the context is suspended', s.state === 'suspended', 'state ' + s.state);
    await sleep(700);
    const startsBefore = (await snapOf(page)).musicStarts;
    await page.evaluate(() => {
      window.__audioLab.probe.start();
      window.__audioLab.audio.resume();
    });
    s = await untilOf(page, (x) => x.state === 'running' && x.playing === 'level', 3000);
    step('resume() brings back the track asked for last', s.state === 'running' && s.playing === 'level' && s.fading === 0, 'state ' + s.state + ', playing ' + s.playing + ', fading ' + s.fading);
    const rec = await page.evaluate(async () => {
      const lab = window.__audioLab;
      await lab.rec.start();
      await new Promise((resolve) => setTimeout(resolve, 1600));
      const rec = await lab.rec.stop();
      const probe = lab.probe.stop();
      return { peak: rec.peak, rmsDb: rec.rmsDb, holes: rec.holes, late: probe.late, starts: probe.starts, worstLead: probe.worstLead, snap: lab.snapshot() };
    });
    step('exactly one player was started by resume()', rec.snap.musicStarts - startsBefore === 1, rec.snap.musicStarts - startsBefore + ' started');
    step('music is audible again, without a burst', rec.rmsDb > -50 && rec.peak < LIMITS.musicPeak + 0.1, 'rms ' + f(rec.rmsDb) + ' dBFS, peak ' + f(rec.peak, 3));
    step('nothing was scheduled in the past after resume', rec.late === 0 && rec.snap.music && rec.snap.music.dropped === 0 && rec.snap.music.resyncs === 0, rec.starts + ' sources, smallest lead ' + f(rec.worstLead * 1000, 1) + ' ms, ' + (rec.snap.music ? rec.snap.music.dropped : '—') + ' notes dropped');
    // suspend() and resume() fired back to back (a shell that reports pause/resume twice)
    const dbl = await page.evaluate(async () => {
      const lab = window.__audioLab;
      const before = lab.snapshot().musicStarts;
      lab.audio.suspend();
      lab.audio.resume();
      lab.audio.resume();
      lab.audio.suspend();
      lab.audio.suspend();
      lab.audio.resume();
      await new Promise((resolve) => setTimeout(resolve, 900));
      const s = lab.snapshot();
      return { starts: s.musicStarts - before, s };
    });
    step('suspend()/resume() fired back to back settle on one running player', dbl.s.state === 'running' && dbl.s.playing === 'level' && dbl.starts === 1 && dbl.s.fading === 0, 'state ' + dbl.s.state + ', playing ' + dbl.s.playing + ', ' + dbl.starts + ' player started');
    step('no page errors (suspend/resume)', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }

  // ── 4. the music toggle remembers the track ──
  {
    out('  · music toggle and track order');
    const { page, errors } = await open();
    await page.evaluate(() => window.__audioLab.audio.music('menu'));
    await sleep(800);
    const r = await page.evaluate(async () => {
      const lab = window.__audioLab;
      lab.audio.setMusicEnabled(false);
      const off = lab.snapshot();
      lab.audio.music('level');
      const asked = lab.snapshot();
      lab.audio.setMusicEnabled(true);
      const on = lab.snapshot();
      await lab.rec.start();
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const rec = await lab.rec.stop();
      return { off, asked, on, rmsDb: rec.rmsDb, later: lab.snapshot() };
    });
    step("setMusicEnabled(false) → music('level') → setMusicEnabled(true) plays 'level'", r.off.playing === null && r.asked.playing === null && r.asked.track === 'level' && r.on.playing === 'level' && r.later.playing === 'level', 'off: ' + r.off.playing + ' · asked while off: ' + r.asked.playing + ' (remembered ' + r.asked.track + ') · on: ' + r.on.playing);
    step('… and it is audible', r.rmsDb > -50, 'rms ' + f(r.rmsDb) + ' dBFS');
    step('no page errors (toggle)', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
    // the same order before the context exists
    const b = await open(false);
    await b.page.evaluate(() => {
      const a = window.__audioLab.audio;
      a.setMusicEnabled(false);
      a.music('level');
      a.setMusicEnabled(true);
    });
    await b.page.click('#unlock');
    const s = await untilOf(b.page, (x) => x.state === 'running' && x.playing === 'level', 4000);
    step('the same sequence before unlocking also ends on level', s.playing === 'level', 'playing ' + s.playing);
    await b.page.close();
  }

  // ── 5. a three-second stall of the main thread ──
  {
    out('  · three-second main-thread stall');
    const { page, errors } = await open();
    await page.evaluate(() => window.__audioLab.audio.music('level'));
    await sleep(2500);
    const r = await page.evaluate(async () => {
      const lab = window.__audioLab;
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      await lab.rec.start();
      lab.probe.start();
      await wait(2000);
      const before = lab.snapshot();
      const st = lab.stall(3000);
      const rightAfter = lab.snapshot();
      await wait(2600);
      const rec = await lab.rec.stop();
      const probe = lab.probe.stop();
      return { before, st, rightAfter, end: lab.snapshot(), rec, probe };
    });
    await saveRec(page, 'live-stall', 'live: level music, main thread blocked for 3 s (from ' + f(r.st.before - r.rec.t0, 2) + ' s to ' + f(r.st.after - r.rec.t0, 2) + ' s)');
    const t0 = r.st.before - r.rec.t0;
    const t1 = r.st.after - r.rec.t0;
    const w = 0.02;
    const pre = maxOf(r.rec.rms20, 0, Math.floor(t0 / w));
    const post = maxOf(r.rec.rms20, Math.ceil(t1 / w), r.rec.rms20.length);
    const mid = maxOf(r.rec.rms20, Math.ceil((t0 + 1.2) / w), Math.floor((t1 - 0.2) / w));
    const tail = maxOf(r.rec.rms20, r.rec.rms20.length - 50, r.rec.rms20.length);
    // sources started before / after the stall: how many share one instant
    const whenPre = [];
    const whenPost = [];
    let lateAfter = 0;
    for (let i = 0; i < r.probe.when.length; i++) {
      if (r.probe.at[i] < r.st.before) whenPre.push(r.probe.when[i]);
      else {
        whenPost.push(r.probe.when[i]);
        if (r.probe.when[i] < r.st.after - 0.005) lateAfter++;
      }
    }
    const crowdPre = crowd(whenPre, 0.03);
    const crowdPost = crowd(whenPost, 0.03);
    const m0 = r.before.music;
    const m1 = r.end.music;
    report.stall = { stalled: r.st.after - r.st.before, pre, post, mid, crowdPre, crowdPost, late: r.probe.late, lateAfter, dropped: m1.dropped - m0.dropped, resyncs: m1.resyncs - m0.resyncs, events: m1.events - m0.events, holes: r.rec.holes };
    step('the audio clock ran on through the stall', r.st.after - r.st.before > 2.7 && r.rec.holes === 0, 'clock advanced ' + f(r.st.after - r.st.before, 2) + ' s while the main thread was blocked for 3 s');
    step('the scheduler noticed and skipped what was late', m1.dropped - m0.dropped + (m1.resyncs - m0.resyncs) > 0 && m1.events > m0.events, (m1.dropped - m0.dropped) + ' notes dropped, ' + (m1.resyncs - m0.resyncs) + ' bar-grid restart, then ' + (m1.events - m0.events) + ' events scheduled');
    step('no note was scheduled in the past', r.probe.late === 0 && lateAfter === 0, r.probe.starts + ' sources started, smallest lead ' + f(r.probe.worstLead * 1000, 1) + ' ms, ' + lateAfter + ' aimed before the end of the stall');
    step('no burst of late notes after the stall', crowdPost <= crowdPre + 4 && post <= pre * 1.6 + 0.005, 'most sources at one instant: ' + crowdPost + ' after vs ' + crowdPre + ' before · loudest 20 ms: ' + db(post) + ' dBFS after vs ' + db(pre) + ' before');
    step('music carries on after the stall', tail > 0.002 && r.end.playing === 'level', 'rms ' + db(tail) + ' dBFS in the last second (during the stall it fell to ' + db(mid) + ')');
    step('no page errors (stall)', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }

  // ── 6. hidden page, and a context suspended behind the engine's back ──
  {
    out('  · hidden page / context suspended by the system');
    const { page, errors } = await open();
    await page.evaluate(() => window.__audioLab.audio.music('menu'));
    await sleep(1200);
    const hid = await page.evaluate(() => {
      const lab = window.__audioLab;
      lab.audio.sfx('reward');
      lab.setHidden(true);
      const at = lab.snapshot();
      lab.audio.sfx('win');
      lab.audio.unlock();
      return { at, started: lab.snapshot().sfxPlayed - at.sfxPlayed };
    });
    let s = await untilOf(page, (x) => x.state === 'suspended', 2500);
    step('a hidden page pauses everything by itself', hid.at.hidden && hid.at.playing === null && hid.at.liveVoices === 0 && hid.started === 0 && s.state === 'suspended', 'hidden ' + hid.at.hidden + ', playing ' + hid.at.playing + ', ' + hid.at.liveVoices + ' voices, state ' + s.state);
    await page.evaluate(() => window.__audioLab.setHidden(false));
    s = await untilOf(page, (x) => x.state === 'running' && x.playing === 'menu', 3000);
    step('showing the page again brings the music back', s.state === 'running' && s.playing === 'menu' && !s.hidden, 'state ' + s.state + ', playing ' + s.playing);
    await sleep(600);
    const before = await snapOf(page);
    await page.evaluate(() => window.__audioLab.audio.debug().context.suspend());
    await sleep(150);
    s = await untilOf(page, (x) => x.state === 'running' && x.playing === 'menu' && x.musicStarts > before.musicStarts, 3000);
    step('a context suspended behind its back is resumed by the engine', s.state === 'running' && s.playing === 'menu', 'state ' + s.state + ', playing ' + s.playing + ', ' + (s.musicStarts - before.musicStarts) + ' player started');
    step('no page errors (hidden)', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }

  // ── 7. fades are heard to the end ──
  {
    out('  · fades and cuts');
    const { page, errors } = await open();
    await page.evaluate(() => window.__audioLab.audio.music('level'));
    await sleep(1800);
    // (a) music(null): a fade, not a cut; then the player's voices are gone
    const a = await page.evaluate(async () => {
      const lab = window.__audioLab;
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      await lab.rec.start();
      await wait(300);
      lab.audio.music(null);
      await wait(1300);
      const rec = await lab.rec.stop();
      return { hardCut: rec.hardCut, maxStep: rec.maxStep, rms20: rec.rms20, snap: lab.snapshot() };
    });
    const fadeStart = 15; // 0.3 s in 20 ms windows
    const early = maxOf(a.rms20, fadeStart + 2, fadeStart + 10);
    const lateFade = maxOf(a.rms20, fadeStart + 20, fadeStart + 28);
    const after = maxOf(a.rms20, fadeStart + 36, a.rms20.length);
    step('music(null) fades out instead of cutting', a.hardCut < 0.004 && early > lateFade && after < 0.0005, 'level 0.1 s into the fade ' + db(early) + ', at 0.5 s ' + db(lateFade) + ', after it ' + db(after) + ' dBFS; level right before silence ' + f(a.hardCut, 4));
    step('the stopped player leaves nothing running', a.snap.liveVoices === 0 && a.snap.fading === 0 && !a.snap.schedulerRunning, a.snap.liveVoices + ' voices, ' + a.snap.liveNodes + ' nodes');
    // (b) switching effects off in the middle of a jingle: a short ramp, then nothing
    const b = await page.evaluate(async () => {
      const lab = window.__audioLab;
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      await lab.rec.start();
      lab.audio.sfx('win');
      lab.audio.sfx('bigCombo');
      await wait(260);
      const during = lab.snapshot();
      lab.audio.setSfxEnabled(false);
      await wait(400);
      const rec = await lab.rec.stop();
      const snap = lab.snapshot();
      lab.audio.setSfxEnabled(true);
      return { hardCut: rec.hardCut, rms20: rec.rms20, during, snap };
    });
    const cutAt = 13;
    step('setSfxEnabled(false) ramps a sounding jingle down and stops its voices', b.hardCut < 0.02 && maxOf(b.rms20, cutAt + 5, b.rms20.length) < 0.0005 && b.snap.liveVoices === 0 && b.during.liveVoices >= 2, 'level right before silence ' + f(b.hardCut, 4) + ', ' + b.during.liveVoices + ' → ' + b.snap.liveVoices + ' voices');
    // (c) effects and music both off: the context sleeps only after the fade
    await page.evaluate(() => window.__audioLab.audio.music('menu'));
    await sleep(1500);
    const c = await page.evaluate(async () => {
      const lab = window.__audioLab;
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      lab.audio.setSfxEnabled(false);
      await lab.rec.start();
      await wait(200);
      const t0 = performance.now();
      lab.audio.setMusicEnabled(false);
      let slept = -1;
      for (let i = 0; i < 100; i++) {
        await wait(25);
        if (lab.snapshot().state === 'suspended') {
          slept = performance.now() - t0;
          break;
        }
      }
      const rec = await lab.rec.stop();
      return { slept, tailEdge: rec.tailEdge, hardCut: rec.hardCut, seconds: rec.seconds, rms20: rec.rms20 };
    });
    step('with both toggles off the context sleeps only after the fade-out', c.slept > 600 && c.slept < 2500 && c.tailEdge < 0.002, 'slept after ' + f(c.slept, 0) + ' ms; last samples before sleeping ' + f(c.tailEdge, 5) + ' (music was at ' + db(maxOf(c.rms20, 0, 10)) + ' dBFS)');
    const woke = await page.evaluate(async () => {
      const lab = window.__audioLab;
      lab.audio.setMusicEnabled(true);
      lab.audio.setSfxEnabled(true);
      await new Promise((resolve) => setTimeout(resolve, 600));
      return lab.snapshot();
    });
    step('… and wakes with the toggles', woke.state === 'running' && woke.playing === 'menu', 'state ' + woke.state + ', playing ' + woke.playing);
    step('no page errors (fades)', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }
  report.adversarial = results;
}

// ───────────────────────── main ─────────────────────────
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await ensureServer();
  const browser = await chromium.launch();
  const report = {};
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(PAGE_URL);
    await page.waitForFunction(() => window.__audioLab && window.__audioLab.ready);
    await checkEffects(page, report);
    if (!ONLY) {
      await checkMusic(page, report);
      if (!NO_LONG) await checkLongMusic(page, report);
      await checkOutput(page, report);
    }
    if (errors.length) fail('page', errors.join(' | '));
    await page.close();
    if (!ONLY && !NO_LIVE) {
      await checkLive(browser, report);
      await checkAdversarial(browser, report);
    }
  } finally {
    await browser.close();
    if (server) server.kill();
  }
  out('');
  if (failures.length) {
    out('FAILED — ' + failures.length + ' problem(s):');
    for (const x of failures) out('  ✗ ' + x);
  } else {
    out('ALL AUDIO CHECKS PASSED');
  }
  out('files: ' + path.relative(ROOT, OUT) + '/*.wav, *.png, report.txt, report.json');
  if (!ONLY) {
    fs.writeFileSync(path.join(OUT, 'report.txt'), lines.join('\n') + '\n');
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
  }
  process.exit(failures.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
