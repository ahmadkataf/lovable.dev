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
 * It opens /audio-lab.html from the Vite dev server (port 5182; started here if it is not
 * already running) in headless Chromium and
 *   1. renders EVERY sound effect (each step of the stepped ones) and 20 s of each music
 *      track through OfflineAudioContext at 44.1 kHz, through the real output chain, and
 *      measures duration, peak, RMS, loudness, DC offset, spectral centroid and pitch;
 *   2. renders a worst-case storm of effects over music to prove the output cannot clip;
 *   3. drives the live engine: unlock by a real click, 200 effects in one frame, toggles,
 *      track switching, suspend/resume, a stalled main thread.
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
  // music
  musicHalves: 3.5, // dB between first and second half
  musicGap: 2, // s of silence
  musicUnderSfx: 8, // music RMS at least this many dB under the median effect
  musicOnsetsPerBar: [2.5, 22],
};

// Intended loudness (A-weighted, dB) used by --suggest: one level for game effects, UI
// sounds 8 dB lower, plus small deliberate offsets (a double blast should out-weigh a tap).
const TARGET = { game: -14.5, ui: -22.5 };
const INTENT = {
  bigCombo: 0.5, nova: -1, prism: 1, beam: 0, stoneBreak: -1, win: 0.5, reward: 1, purchase: 0, goalDone: 1,
  lose: -1, lifeLost: -1.5, invalid: -1.5, praise: -1.5, coin: -1, sand: -2.5, stone: -2, vine: -2, chain: -1,
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
  out('SOUND EFFECTS — rendered offline at 44.1 kHz through sfx bus → master → limiter → guard');
  out(
    pad('sound', 15) + pad('class', 7) + padL('dur s', 7) + padL('aud s', 7) + padL('peak', 7) + padL('rms', 7) + padL('loud', 7) +
      padL('loudA', 7) + padL('Δmed', 6) + padL('DC', 9) + padL('centroid Hz', 13) + padL('start→end', 13) + padL('pitch Hz', 10) + '  flags',
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
        padL(f(m.centroid, 0), 13) + padL(f(m.centroidStart, 0) + '→' + f(m.centroidEnd, 0), 13) + padL(f(m.pitch, 0), 10) + '  ' + (flags.join(' ') || 'ok'),
    );
    for (const fl of flags) fail('sfx ' + r.id, fl);
  }
  out('median loudness of game effects: ' + f(ref) + ' dB(A)   (game/jingle must be within ±' + LIMITS.gameSpread + ' dB, UI ' + LIMITS.uiBelow[0] + '–' + LIMITS.uiBelow[1] + ' dB below)');

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
  out('MUSIC — 20 s of each track, offline, through music bus → master → limiter → guard');
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
      await checkOutput(page, report);
    }
    if (errors.length) fail('page', errors.join(' | '));
    await page.close();
    if (!ONLY && !NO_LIVE) await checkLive(browser, report);
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
