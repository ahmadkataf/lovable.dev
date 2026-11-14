#!/usr/bin/env node
/*
 * Audio checker — verifies src/audio by measurement, since nobody listens during a build.
 *
 *   node tools/audio-check.cjs              run everything
 *   node tools/audio-check.cjs --no-live    skip the live-engine tests
 *   node tools/audio-check.cjs --no-long    skip the three-minute music renders
 *   node tools/audio-check.cjs --sfx        only the effects and the loudness hierarchy
 *   node tools/audio-check.cjs --only=match,beam   only these effects (no music/live)
 *   node tools/audio-check.cjs --calibrate  measure every effect, then rewrite each `gain:` in
 *                                           src/audio/sfx.ts so that the effect peaks at the
 *                                           level of its loudness tier (run again to verify)
 *
 * It opens /audio-lab.html from the Vite dev server (port 5182; started here if it is not
 * already running) in headless Chromium and
 *   1. renders EVERY sound effect (each step of the stepped ones, each take of the ones that
 *      have several) through OfflineAudioContext at 44.1 kHz and the real output chain, and
 *      measures peak, RMS, loudness, duration, attack, DC offset, spectral centroid, pitch
 *      and how much of the energy is harsh (above 6 kHz) or boom (below 150 Hz);
 *   2. checks the mix against docs/STRATEGY.md (audio-01): the cascade pitch ladder, the
 *      peak level of every loudness tier, the music 20 dB down and ducked a further 4 dB
 *      under big sounds, at most 3 'match' voices and 12 voices in all, a −1 dBFS ceiling,
 *      90 / 108 BPM;
 *   3. renders 20 s and three minutes of each music track with the scheduler stepped as in
 *      live play: no clipping, no silence, no drift, no loop, a bounded number of audio nodes;
 *   4. renders a minute of scripted play over the level music and measures its programme
 *      loudness (ITU-R BS.1770), and a worst-case storm of effects that must stay under the
 *      ceiling; checks that the first sound of a new context is not swallowed by the limiter;
 *   5. drives the live engine: unlock by a real click, 200 effects in one frame, toggles,
 *      track switching, suspend/resume, a stalled main thread;
 *   6. attacks the live engine while recording its real output sample by sample: 500
 *      effects in one tick, rapid track switching, suspend in the middle of a cross-fade,
 *      a three-second stall of the main thread, a hidden page, a context suspended behind
 *      the engine's back, fades that must not be chopped, voices that are stolen.
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
const SFX_SOURCE = path.join(ROOT, 'src', 'audio', 'sfx.ts');
const args = process.argv.slice(2);
const NO_LIVE = args.indexOf('--no-live') >= 0;
const NO_LONG = args.indexOf('--no-long') >= 0;
const CALIBRATE = args.indexOf('--calibrate') >= 0;
const SFX_ONLY = args.indexOf('--sfx') >= 0;
const onlyArg = args.filter((a) => a.indexOf('--only=') === 0)[0];
const ONLY = onlyArg ? onlyArg.slice(7).split(',') : null;

// ───────────────────────── limits ─────────────────────────
const LIMITS = {
  silentRms: 0.003,
  dc: 0.01,
  tailPeak: 0.002,
  // The ceiling of the whole mix: −1 dBFS (plus rounding).
  ceilingDb: -1,
  ceiling: Math.pow(10, -1 / 20) + 0.0005,
  // Peak level of an effect against its tier: every step and take within this many dB, and
  // the mean of an effect's steps and takes within `tierMean`.
  tierEach: 1,
  tierMean: 0.6,
  // nominal duration (s) by tier: [min, max]
  duration: {
    ui: [0.04, 0.25], soft: [0.04, 0.4], handle: [0.08, 0.3], clear: [0.08, 0.25],
    board: [0.08, 0.7], special: [0.25, 0.9], big: [0.4, 1.2], jingle: [0.4, 2.2],
  },
  // The sounds heard all the time: short, and speaking at once.
  frequent: ['button', 'select', 'swap', 'match', 'land'],
  frequentDuration: [0.08, 0.25],
  frequentAttack: 0.008,
  // tone: share of a sound's energy above 6 kHz (harsh, hissy) and below 150 Hz (boom that
  // costs headroom and that a phone speaker cannot play)
  harsh: 0.3,
  boom: 0.3,
  // tuning of the cascade ladder and of the takes (cents)
  ladderCents: 8,
  takeCents: 2.5,
  // music
  musicPeakBelow: 3.5, // the music's peak may fall this far short of its level (dB) …
  musicPeakAbove: 0.1, // … but must not exceed it
  musicHalves: 3.5, // dB between first and second half
  musicGap: 1, // s of silence
  musicUnderClear: 6, // music's loud moments (95th percentile, A-weighted) under the median 'match'
  musicOnsetsPerBar: [2.5, 22],
  bpm: { menu: 90, level: 108 },
  // three minutes of music
  longSeconds: 180,
  longMinutes: 3, // dB between any two whole minutes
  longTenSeconds: 6, // dB between the loudest and the quietest 10 s
  longDifference: 0.5, // first vs last minute: 0 = identical samples, ~1 = unrelated
  longNodes: 160, // live audio nodes of the music at any time
  // pumping: share of the time the sustained part of the music is pushed more than 3 / 6 dB
  // down by the compressor and clipper reacting to notes and drum strokes
  pump3: 0.04,
  pump6: 0.005,
  // ducking
  duckTolerance: 0.7, // dB
  duckHold: [0.45, 0.95], // s the music stays down under a special
  // first sound of a new context vs the same sound later (dB)
  startup: 1.5,
  // programme loudness of a minute of play (LUFS): the study's estimate, and the window that
  // the peak hierarchy leaves room for
  lufsEstimate: -16,
  lufs: [-34, -14],
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
function dbToGain(db) {
  return Math.pow(10, db / 20);
}

/**
 * Rewrite the `gain:` of every effect in sfx.ts so that its mean peak sits on its tier, and
 * for the stepped effects the `trimDb:` list that evens out their steps. A sound that was
 * loud enough to reach the limiter measures too low the first time: run it twice.
 */
function calibrate(groups) {
  let src = fs.readFileSync(SFX_SOURCE, 'utf8');
  out('');
  out('CALIBRATION — gains rewritten in src/audio/sfx.ts');
  let changed = 0;
  const meanOf = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  for (const name of Object.keys(groups)) {
    const g = groups[name];
    // A stepped sound: one cell per step and take; the gain goes by the mean of the cells.
    const steps = Object.keys(g.cells).map(Number).sort((a, b) => a - b);
    const cells = [];
    for (const st of steps) for (let k = 0; k < g.cells[st].length; k++) cells.push({ step: st, take: k, peak: g.cells[st][k] });
    const mean = cells.length ? meanOf(cells.map((c) => c.peak)) : meanOf(g.peaks);
    const re = new RegExp('(\\n  ' + name + ': \\{\\n    gain: )([0-9.]+)(,)');
    const m = re.exec(src);
    if (!m) {
      fail('calibrate', 'no gain found for ' + name);
      continue;
    }
    const old = Number(m[2]);
    const next = Math.round(old * dbToGain(g.target - mean) * 1000) / 1000;
    if (next !== old) changed++;
    src = src.replace(re, '$1' + next + '$3');
    out('  ' + pad(name, 13) + padL(f(mean), 7) + ' → ' + padL(f(g.target, 0), 4) + ' dBFS   gain ' + padL(f(old, 3), 6) + ' → ' + padL(f(next, 3), 6));
    const tre = new RegExp('(\\n  ' + name + ': \\{\\n    gain: [0-9.]+,\\n    trimDb: \\[)([^\\]]*)(\\])');
    const tm = tre.exec(src);
    if (tm && cells.length) {
      const oldTrim = tm[2].split(',').map((x) => x.trim()).filter((x) => x.length).map(Number);
      const takes = g.cells[steps[0]].length;
      const nextTrim = cells.map((c, i) => Math.round(((oldTrim[i] || 0) + (mean - c.peak)) * 10) / 10);
      // One step per line when there are several takes, one line otherwise.
      let text;
      if (takes > 1) {
        const rows = [];
        for (let i = 0; i < nextTrim.length; i += takes) rows.push('      ' + nextTrim.slice(i, i + takes).join(', ') + ',');
        text = '\n' + rows.join('\n') + '\n    ';
      } else {
        text = nextTrim.join(', ');
      }
      src = src.replace(tre, '$1' + text + '$3');
      out('  ' + pad('', 13) + 'trims (dB' + (takes > 1 ? ', per step: one per take' : ', per step') + '): ' + (takes > 1 ? steps.map((st, i) => nextTrim.slice(i * takes, i * takes + takes).join('/')).join('  ') : nextTrim.join(', ')));
    }
  }
  fs.writeFileSync(SFX_SOURCE, src);
  out('  ' + changed + ' gain(s) changed; run the checker again to verify.');
}

async function checkEffects(page, report) {
  const variants = await page.evaluate(() => window.__audioLab.variants());
  const expected = await page.evaluate(() => window.__audioLab.expected());
  report.expected = expected;
  const chosen = ONLY ? variants.filter((v) => ONLY.indexOf(v.name) >= 0) : variants;
  const results = [];
  // Calibration measures at a quarter of the volume (and adds the 12 dB back), so that a
  // sound whose gain is still far too high cannot reach the limiter and hide its true peak.
  const volume = CALIBRATE ? 0.25 : 1;
  const restore = (r) => {
    if (volume === 1) return;
    r.metrics.peakDb -= 20 * Math.log10(volume);
  };
  for (const v of chosen) {
    const r = await page.evaluate((x) => window.__audioLab.sfxReport(x.v.name, x.v.step, 0, x.volume), { v, volume });
    restore(r);
    r.name = v.name;
    r.step = v.step;
    save(r);
    results.push(r);
  }
  // The other takes of the sound that has several, at every step.
  const takes = [];
  if (!ONLY || ONLY.indexOf('match') >= 0) {
    for (let step = 1; step <= expected.match.length; step++) {
      for (let k = 1; k < expected.variants.length; k++) {
        const r = await page.evaluate((x) => window.__audioLab.sfxReport('match', x.step, x.k, x.volume), { step, k, volume });
        restore(r);
        r.name = 'match';
        r.step = step;
        r.take = k;
        if (step === 1 || step === 6 || step === 12) save(r);
        takes.push(r);
      }
    }
  }
  const all = results.concat(takes);
  report.sfx = all.map(slim);

  out('');
  out('SOUND EFFECTS — rendered offline at 44.1 kHz through sfx bus → master → limiter → trim → guard (gain from bus to output: 0 dB)');
  out(
    pad('sound', 15) + pad('tier', 8) + padL('target', 7) + padL('peak', 7) + padL('Δ', 6) + padL('rms', 7) + padL('loud', 7) + padL('loudA', 7) +
      padL('dur s', 7) + padL('aud s', 7) + padL('att ms', 7) + padL('DC', 8) + padL('centroid Hz', 12) + padL('start→end', 12) + padL('pitch Hz', 9) + padL('>6k %', 6) + padL('<150 %', 7) + '  flags',
  );
  const groups = {};
  for (const r of all) {
    const m = r.metrics;
    const flags = [];
    const lim = LIMITS.duration[r.tier];
    const delta = m.peakDb - r.targetDb;
    (groups[r.name] = groups[r.name] || { tier: r.tier, target: r.targetDb, peaks: [], rms: [], loudA: [], cells: {} }).peaks.push(m.peakDb);
    if (r.step !== undefined) (groups[r.name].cells[r.step] = groups[r.name].cells[r.step] || [])[r.take || 0] = m.peakDb;
    groups[r.name].rms.push(m.rmsDb);
    groups[r.name].loudA.push(m.loudADb);
    if (m.peak >= LIMITS.ceiling) flags.push('CLIPS');
    if (m.silent && r.targetDb > -17) flags.push('SILENT');
    if (Math.abs(m.dc) > LIMITS.dc) flags.push('DC');
    if (r.tailPeak > LIMITS.tailPeak) flags.push('TAIL(' + f(r.tailPeak, 4) + ')');
    if (r.nominal < lim[0] || r.nominal > lim[1]) flags.push('DURATION');
    if (m.effective < 0.02 + r.nominal * 0.5) flags.push('DEAD-AIR');
    if (m.hfShare > LIMITS.harsh) flags.push('HARSH');
    if (m.lfShare > LIMITS.boom) flags.push('BOOM');
    if (!CALIBRATE && Math.abs(delta) > LIMITS.tierEach) flags.push('LEVEL');
    if (LIMITS.frequent.indexOf(r.name) >= 0) {
      if (r.nominal < LIMITS.frequentDuration[0] || r.nominal > LIMITS.frequentDuration[1]) flags.push('FREQUENT-LENGTH');
      if (r.attack > LIMITS.frequentAttack) flags.push('SLOW-ATTACK');
    }
    out(
      pad(r.id, 15) + pad(r.tier, 8) + padL(f(r.targetDb, 0), 7) + padL(f(m.peakDb), 7) + padL((delta >= 0 ? '+' : '') + f(delta), 6) + padL(f(m.rmsDb), 7) +
        padL(f(m.loudDb), 7) + padL(f(m.loudADb), 7) + padL(f(r.nominal, 3), 7) + padL(f(m.effective - 0.02, 3), 7) + padL(f(r.attack * 1000, 1), 7) + padL(m.dc.toExponential(0), 8) +
        padL(f(m.centroid, 0), 12) + padL(f(m.centroidStart, 0) + '→' + f(m.centroidEnd, 0), 12) + padL(f(m.pitch, 0), 9) +
        padL(f(m.hfShare * 100, 0), 6) + padL(f(m.lfShare * 100, 0), 7) + '  ' + (flags.join(' ') || 'ok'),
    );
    for (const fl of flags) fail('sfx ' + r.id, fl);
  }
  out('columns: target = peak level of the tier (dBFS) · peak, rms, loud (loudest 50 ms) in dBFS · Δ = peak minus target ·');
  out('         loudA = loudest frame, A-weighted (dB) · dur = duration reported by renderSfx · aud = until 60 dB below the peak ·');
  out('         att = time from 10 % to 70 % of the peak · DC = mean sample · centroid = power-weighted mean frequency');
  out('         (whole sound, then first third → last third) · pitch = strongest spectral peak · >6k / <150 = share of the energy');
  out('flags:   CLIPS above the ceiling · SILENT rms < ' + LIMITS.silentRms + ' · DC |mean| > ' + LIMITS.dc + ' · TAIL sound after its reported end · LEVEL peak more than ' + LIMITS.tierEach + ' dB off its tier ·');
  out('         DURATION outside ' + JSON.stringify(LIMITS.duration).replace(/"/g, '') + ' s ·');
  out('         DEAD-AIR audible < half of dur · HARSH more than ' + LIMITS.harsh * 100 + ' % above 6 kHz · BOOM more than ' + LIMITS.boom * 100 + ' % below 150 Hz ·');
  out('         FREQUENT-LENGTH / SLOW-ATTACK: ' + LIMITS.frequent.join(', ') + ' must last ' + LIMITS.frequentDuration[0] * 1000 + '–' + LIMITS.frequentDuration[1] * 1000 + ' ms and speak within ' + LIMITS.frequentAttack * 1000 + ' ms');

  if (CALIBRATE) {
    calibrate(groups);
    return results;
  }

  // The loudness hierarchy: one row per tier.
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const tierRows = [];
  out('');
  out('LOUDNESS HIERARCHY (docs/STRATEGY.md audio-01) — peak level of each tier at the output');
  out('  ' + pad('tier', 9) + padL('target', 7) + padL('measured peak dBFS', 22) + padL('mean', 7) + padL('rms dBFS', 10) + padL('loudA med', 11) + '   sounds');
  report.tiers = [];
  for (const t of expected.tiers) {
    const names = Object.keys(groups).filter((n) => groups[n].tier === t.name);
    if (!names.length) continue;
    const peaks = [].concat.apply([], names.map((n) => groups[n].peaks));
    const rms = [].concat.apply([], names.map((n) => groups[n].rms));
    const loudA = [].concat.apply([], names.map((n) => groups[n].loudA));
    const row = { tier: t.name, target: t.peakDb, min: Math.min.apply(null, peaks), max: Math.max.apply(null, peaks), mean: mean(peaks), rms: mean(rms), loudA: median(loudA), names };
    tierRows.push(row);
    report.tiers.push(row);
    out('  ' + pad(t.name, 9) + padL(f(t.peakDb, 0), 7) + padL(f(row.min) + ' … ' + f(row.max), 22) + padL(f(row.mean), 7) + padL(f(row.rms), 10) + padL(f(row.loudA), 11) + '   ' + names.join(' '));
    if (!ONLY) {
      for (const n of names) {
        const g = groups[n];
        const m = mean(g.peaks);
        if (Math.abs(m - g.target) > LIMITS.tierMean) fail('hierarchy', n + ' peaks at ' + f(m) + ' dBFS on average, its tier (' + g.tier + ') is ' + g.target);
      }
    }
  }
  report.groups = groups;
  if (!ONLY) {
    // Each tier is louder than the one below it — as peaks (by construction) and to the ear.
    for (let i = 1; i < tierRows.length; i++) {
      if (!(tierRows[i].mean > tierRows[i - 1].mean + 0.5)) fail('hierarchy', tierRows[i].tier + ' does not peak above ' + tierRows[i - 1].tier);
    }
    const byTier = {};
    for (const r of tierRows) byTier[r.tier] = r;
    const order = [['ui', 'clear'], ['clear', 'special'], ['special', 'jingle']];
    for (const pair of order) {
      if (byTier[pair[0]] && byTier[pair[1]] && !(byTier[pair[1]].loudA > byTier[pair[0]].loudA + 2)) {
        fail('hierarchy', pair[1] + ' is not perceptibly louder than ' + pair[0] + ' (A-weighted ' + f(byTier[pair[1]].loudA) + ' vs ' + f(byTier[pair[0]].loudA) + ')');
      }
    }
    report.clearLoudA = byTier.clear ? byTier.clear.loudA : undefined;
    report.uiLoudA = byTier.ui ? byTier.ui.loudA : undefined;
  }

  // Shape checks: do the sounds move the way their design says?
  const by = {};
  for (const r of all) by[r.id] = r;
  const shape = [];
  const want = (id, ok, text) => {
    if (!by[id.split('|')[0]]) return;
    shape.push((ok ? 'ok   ' : 'FAIL ') + text);
    if (!ok) fail('shape', text);
  };
  // match: the cascade ladder — 12 rungs above D4, then the top note held with a sparkle layer.
  if (by['match-1'] && by['match-13']) {
    const ladder = [0, 4, 5, 7, 10, 12, 16, 17, 19, 22, 24, 28];
    const d4 = 440 * Math.pow(2, (62 - 69) / 12);
    const got = [];
    const semis = [];
    let worst = 0;
    for (let s = 1; s <= 13; s++) {
      const e = expected.match[s - 1];
      const hz = await page.evaluate((x) => window.__audioLab.tuningOf('match', x.s, 0, x.e, 0.04, 0.16), { s, e });
      got.push(hz);
      semis.push(12 * Math.log2(hz / d4));
      worst = Math.max(worst, Math.abs(1200 * Math.log2(hz / e)));
    }
    report.ladder = { hz: got, semitones: semis, worstCents: worst };
    let rising = true;
    for (let s = 1; s < 12; s++) if (!(got[s] > got[s - 1] * 1.02)) rising = false;
    const onLadder = ladder.every((x, i) => Math.abs(semis[i] - x) < LIMITS.ladderCents / 100);
    want('match-1', rising, "'match' rises with every step: " + got.slice(0, 12).map((x) => Math.round(x)).join(' < ') + ' Hz');
    want('match-1', onLadder, "'match' steps 1…12 sound " + semis.slice(0, 12).map((x) => f(x, 2)).join(' ') + ' semitones above D4 (ladder ' + ladder.join(' ') + '; worst error ' + f(worst, 1) + ' cents)');
    want('match-1', Math.abs(1200 * Math.log2(got[12] / got[11])) < LIMITS.ladderCents, "'match' holds the top note after step 12: step 13 sounds " + f(got[12], 1) + ' Hz, step 12 ' + f(got[11], 1) + ' Hz');
    const c12 = by['match-12'].metrics.centroid;
    const c13 = by['match-13'].metrics.centroid;
    want('match-1', c13 > c12 * 1.05, "step 13 adds the sparkle layer: centroid " + f(c12, 0) + ' → ' + f(c13, 0) + ' Hz');
    // The sparkle partials sit 12 dB under the body.
    const spark = await page.evaluate(async (e) => {
      const lab = window.__audioLab;
      const a = await lab.notesOf('match', 13, [{ from: 0.06, to: 0.16 }], e * 1.9, e * 2.1);
      return a[0];
    }, expected.match[12]);
    want('match-1', Math.abs(spark / (2 * expected.match[12]) - 1) < 0.01, 'the sparkle layer has a partial at twice the note: ' + f(spark, 0) + ' Hz');
    // Round-robin takes.
    const takeRows = await page.evaluate(() => window.__audioLab.variantReport(5));
    report.takes = takeRows;
    const centsOk = takeRows.every((t, i) => Math.abs(t.cents - expected.variants[i].cents) < LIMITS.takeCents);
    want('match-1', takeRows.length === 3 && centsOk, "'match' has three takes, detuned " + takeRows.map((t) => (t.cents >= 0 ? '+' : '') + f(t.cents, 1)).join(' / ') + ' cents (designed ' + expected.variants.map((v) => v.cents).join(' / ') + ')');
    want('match-1', takeRows.every((t) => t.attack <= LIMITS.frequentAttack) && expected.variants.every((v) => v.attack <= LIMITS.frequentAttack), 'every take speaks within 8 ms: designed ' + expected.variants.map((v) => v.attack * 1000).join(' / ') + ' ms, measured (10 → 70 %) ' + takeRows.map((t) => f(t.attack * 1000, 1)).join(' / ') + ' ms');
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
    want('praise-1', d[0] < d[1] && d[1] < d[2] && d[2] < d[3], 'praise grows longer with its tier: ' + d.map((x) => f(x, 2)).join(' < ') + ' s');
    // The motif of each tier, note by note (85 ms apart).
    let motifOk = true;
    const heard = [];
    for (let tier = 1; tier <= 4; tier++) {
      const notes = expected.praise[tier - 1];
      const slots = notes.map((_, k) => ({ from: k * 0.085 + 0.004, to: k * 0.085 + 0.07 }));
      const got = await page.evaluate((x) => window.__audioLab.notesOf('praise', x.tier, x.slots, 500, 1700), { tier, slots });
      heard.push(got.map((x) => Math.round(x)).join(' '));
      if (got.length !== tier + 1) motifOk = false;
      for (let k = 0; k < got.length; k++) {
        if (Math.abs(got[k] / notes[k] - 1) > 0.015) motifOk = false;
        if (k > 0 && !(got[k] > got[k - 1])) motifOk = false;
      }
    }
    want('praise-1', motifOk, 'praise tiers 1…4 are rising motifs of 2, 3, 4 and 5 ladder notes: ' + heard.join(' | ') + ' Hz');
    report.praise = { heard, centroid: c };
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
  // Weight: a blast has a body in the range a phone speaker can play (150–400 Hz), and does
  // not depend on anything below 120 Hz.
  for (const id of ['beam', 'nova', 'bigCombo']) {
    const r = by[id];
    if (!r) continue;
    want(id, r.metrics.bodyShare >= 0.25 && r.metrics.subShare < 0.15, id + ' has its weight where a phone can play it: ' + f(r.metrics.bodyShare * 100, 0) + ' % of the energy at 150–400 Hz, ' + f(r.metrics.subShare * 100, 0) + ' % below 120 Hz');
  }
  if (by.lose && by.win) {
    want('lose', by.lose.metrics.centroid < by.win.metrics.centroid && by.lose.metrics.hfShare < 0.02, 'lose is gentle: centroid ' + f(by.lose.metrics.centroid, 0) + ' Hz (win ' + f(by.win.metrics.centroid, 0) + '), ' + f(by.lose.metrics.hfShare * 100, 1) + ' % above 6 kHz, attack ' + f(by.lose.attack * 1000, 0) + ' ms');
  }
  if (shape.length) {
    out('');
    out('SHAPE');
    for (const s of shape) out('  ' + s);
  }
  return results;
}

// ───────────────────────── music ─────────────────────────
/** Flags for the music's level in the mix; `peakDb` is its sample peak after the fade-in. */
function musicLevelFlags(report, peakDb, loudness) {
  const flags = [];
  const target = report.expected.musicPeakDb;
  if (peakDb > target + LIMITS.musicPeakAbove) flags.push('PEAK-ABOVE-' + target);
  if (peakDb < target - LIMITS.musicPeakBelow) flags.push('TOO-QUIET');
  if (report.clearLoudA !== undefined && loudness.p95 > report.clearLoudA - LIMITS.musicUnderClear) flags.push('LOUD-VS-EFFECTS');
  return flags;
}

async function checkMusic(page, report) {
  out('');
  out('MUSIC — 20 s of each track, offline (scheduler stepped every 100 ms), through music in → glue → clip → music bus → master → limiter → trim → guard');
  report.music = [];
  for (const track of ['menu', 'level']) {
    const r = await page.evaluate((t) => window.__audioLab.musicReport(t, 20, 20240521), track);
    save(r);
    report.music.push(slim(r));
    const m = r.metrics;
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
    const flags = musicLevelFlags(report, m.peakDb, r.loudness);
    if (m.rms < 0.0015) flags.push('SILENT');
    if (Math.abs(m.dc) > LIMITS.dc) flags.push('DC');
    if (r.bpm !== LIMITS.bpm[track]) flags.push('TEMPO');
    if (avg < LIMITS.musicOnsetsPerBar[0] || avg > LIMITS.musicOnsetsPerBar[1]) flags.push('ONSET-DENSITY');
    if (leadAvg < 1.5) flags.push('LEAD-TOO-SPARSE');
    if (emptyLeadRun > 2) flags.push('LEAD-GAP');
    if (r.heard < r.scheduled * 0.4) flags.push('ONSETS-NOT-HEARD');
    if (Math.abs(r.firstHalfDb - r.secondHalfDb) > LIMITS.musicHalves) flags.push('DRIFT');
    if (r.longestSilence > LIMITS.musicGap) flags.push('SILENCE-GAP');
    out('');
    out(r.id + ': ' + r.bpm + ' BPM (designed ' + LIMITS.bpm[track] + '), bar ' + f(r.barDuration, 3) + ' s, ' + r.bars + ' full bars   ' + (flags.join(' ') || 'ok'));
    out('  peak ' + f(m.peakDb) + ' dBFS (music level ' + report.expected.musicPeakDb + ') · rms ' + f(m.rmsDb) + ' dBFS · crest ' + f(r.crest) + ' dB · loudest 50 ms ' + f(m.loudDb) + ' dBFS · A-weighted ' + f(m.loudADb) + ' dB · DC ' + m.dc.toExponential(0) + ' · centroid ' + f(m.centroid, 0) + ' Hz');
    out('  note onsets per bar, scheduled (lead+perc): ' + perBar.join(' ') + '   avg ' + f(avg));
    out('     lead only:                              ' + r.leadPerBar.join(' ') + '   avg ' + f(leadAvg));
    out('     heard in the audio (spectral flux):     ' + r.heardPerBar.join(' ') + '   total ' + r.heard + ' of ' + r.scheduled + ' scheduled');
    out('  loudness first half ' + f(r.firstHalfDb) + ' dBFS · second half ' + f(r.secondHalfDb) + ' dBFS · difference ' + f(Math.abs(r.firstHalfDb - r.secondHalfDb)) + ' dB');
    out('  longest silence ' + f(r.longestSilence, 2) + ' s · layers alone: lead ' + f(r.layerDb.lead) + ' · pad ' + f(r.layerDb.pad) + ' · perc ' + f(r.layerDb.perc) + ' dBFS · compressor: ' + f(r.glueMean) + ' dB on average, ' + f(r.glueMax) + ' dB at most');
    if (report.clearLoudA !== undefined) {
      out('  like for like, A-weighted frames: loudest ' + f(r.loudness.max) + ' · 95th percentile ' + f(r.loudness.p95) + ' · median ' + f(r.loudness.p50) + ' dB — its loud moments are ' +
        f(report.clearLoudA - r.loudness.p95) + " dB under the median 'match' (" + f(report.clearLoudA) + ')' +
        (report.uiLoudA !== undefined ? ' and ' + f(report.uiLoudA - r.loudness.p95) + ' dB under the median interface tap (' + f(report.uiLoudA) + ')' : ''));
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
  const stormOk = sm.peak < LIMITS.ceiling;
  out('  storm (level music + every effect at once + two walls of the heaviest, straight into the bus): peak ' + f(sm.peak, 3) + ' (' + f(sm.peakDb) + ' dBFS, ceiling ' + LIMITS.ceilingDb + ') · rms ' + f(sm.rmsDb) + ' dBFS   ' + (stormOk ? 'ok' : 'OVER'));
  if (!stormOk) fail('storm', 'peak ' + f(sm.peakDb, 2) + ' dBFS is over the ' + LIMITS.ceilingDb + ' dBFS ceiling');
  const transfer = await page.evaluate(() => window.__audioLab.chainTransfer());
  report.transfer = transfer;
  out('  1 kHz sine into the effects bus → output (the chain is transparent up to about ' + f(20 * Math.log10(report.expected.limiterOnset)) + ' dBFS, then the limiter holds it under the ceiling):');
  out('    in dBFS   ' + transfer.map((t) => padL(f(t.inDb, 0), 7)).join(''));
  out('    out peak  ' + transfer.map((t) => padL(f(t.outPeakDb), 7)).join(''));
  out('    out rms   ' + transfer.map((t) => padL(f(t.outRmsDb), 7)).join(''));
  for (const t of transfer) {
    if (Math.pow(10, t.outPeakDb / 20) >= LIMITS.ceiling) fail('output stage', 'over the ceiling at ' + t.inDb + ' dBFS in (' + f(t.outPeakDb, 2) + ' dBFS out)');
    // Below the limiter the chain must add or take nothing: tier levels are bus levels.
    if (t.inDb <= -6 && Math.abs(t.outPeakDb - t.inDb) > 0.25) fail('output stage', 'gain from bus to output is ' + f(t.outPeakDb - t.inDb, 2) + ' dB at ' + t.inDb + ' dBFS (must be 0)');
  }
  // The limiter starts life half shut (about 0.18 s); the first tap of a session must not
  // be swallowed by that.
  out('  first sound of a brand-new context (5 ms after its start) against the same sound later (loudest 50 ms, dBFS):');
  report.startup = [];
  for (const v of [{ name: 'button' }, { name: 'match', step: 1 }, { name: 'land' }, { name: 'levelStart' }]) {
    const r = await page.evaluate((x) => window.__audioLab.startupReport(x.name, x.step), v);
    const diff = r.earlyDb - r.lateDb;
    const ok = Math.abs(diff) <= LIMITS.startup && r.earlyPeak < LIMITS.ceiling;
    report.startup.push(Object.assign({ id: v.name }, r));
    out('    ' + pad(v.name, 11) + ' first ' + padL(f(r.earlyDb), 6) + '   later ' + padL(f(r.lateDb), 6) + '   difference ' + padL((diff >= 0 ? '+' : '') + f(diff), 5) + ' dB   ' + (ok ? 'ok' : 'FAIL'));
    if (!ok) fail('output stage', 'first sound of a context (' + v.name + ') is ' + f(diff) + ' dB off');
  }
}

// ───────────────────────── the mix ─────────────────────────
async function checkMix(page, report) {
  const e = report.expected;
  out('');
  out('MIX — voice allocation and ducking (offline, the same mixer as the live engine)');
  const step = (name, ok, detail) => {
    out('  ' + (ok ? 'ok   ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
    if (!ok) fail('mix', name + (detail ? ' — ' + detail : ''));
  };

  // 500 calls at one instant.
  const flood = await page.evaluate(() => window.__audioLab.floodReport(500));
  report.flood = flood;
  step('500 effects at one instant: at most ' + e.maxVoices + ' voices, at most ' + e.matchVoices + " of them 'match'",
    flood.voices <= e.maxVoices && flood.liveVoices <= e.maxVoices && flood.matchVoices <= e.matchVoices && flood.played + flood.dropped === flood.calls,
    flood.voices + ' voices sounding (' + flood.matchVoices + " 'match'), " + flood.liveVoices + ' alive in the graph · ' + flood.played + ' started, ' + flood.stolen + ' of them stolen again, ' + flood.dropped + ' dropped');
  const quietTiers = flood.survivors.filter((t) => t === 'ui' || t === 'soft' || t === 'handle').length;
  step('the voices that survive a flood are the loud tiers', quietTiers === 0 && flood.survivors.length === flood.voices, 'survivors: ' + flood.survivors.join(' '));
  step('the flood stays under the ceiling and leaves nothing behind', flood.peak < LIMITS.ceiling && flood.endVoices === 0 && flood.endNodes === 0, 'peak ' + f(20 * Math.log10(flood.peak)) + ' dBFS · ' + flood.endVoices + ' voices / ' + flood.endNodes + ' nodes left');

  // A stolen voice fades.
  const steal = await page.evaluate(() => window.__audioLab.stealReport());
  report.steal = steal;
  step("four 'match' sounds in a row: the fourth takes the place of the first", steal.matchPlayed === 4 && steal.matchStolen === 1 && steal.matchMost === e.matchVoices, steal.matchPlayed + ' started, ' + steal.matchStolen + ' stolen, at most ' + steal.matchMost + ' at once');
  step('a stolen voice fades out instead of being chopped',
    steal.stolen === 1 && steal.played === 13 && steal.before > 0.05 && steal.after < steal.before * 0.01 && steal.untouched > steal.before * 0.2 && steal.hardCut < steal.before * 0.05,
    'a jingle sounding at ' + f(20 * Math.log10(steal.before + 1e-9)) + ' dBFS is taken by the 13th voice: ' + f(20 * Math.log10(steal.after + 1e-9)) + ' dBFS 30 ms later (left alone: ' + f(20 * Math.log10(steal.untouched + 1e-9)) + '); level right before silence ' + f(steal.hardCut, 4));

  // Ducking: −4 dB for about 0.6 s under specials and big moments, for a jingle's length under jingles.
  report.duck = [];
  for (const name of ['beam', 'nova', 'prism', 'bigCombo', 'praise', 'win', 'lose', 'star']) {
    const d = await page.evaluate((n) => window.__audioLab.duckReport(n), name);
    report.duck.push(d);
    const jingle = name === 'win' || name === 'lose';
    const depthOk = Math.abs(d.duringDb - e.duckDb) <= LIMITS.duckTolerance;
    const holdOk = jingle ? d.held > 1.2 && d.held < 2.6 : d.held >= LIMITS.duckHold[0] && d.held <= LIMITS.duckHold[1];
    step('music ducks under ' + name, depthOk && holdOk && Math.abs(d.afterDb) < 0.3, f(d.duringDb) + ' dB (designed ' + e.duckDb + ') for ' + f(d.held, 2) + ' s' + (jingle ? ' (the length of the jingle)' : ' (designed about ' + e.duckHold + ')') + ', then back to ' + f(d.afterDb, 2) + ' dB');
  }
  for (const name of ['match', 'land', 'button', 'swap', 'stone', 'createBeam']) {
    const d = await page.evaluate((n) => window.__audioLab.duckReport(n), name);
    report.duck.push(d);
    step('music does not duck under ' + name, Math.abs(d.duringDb) < 0.3 && d.held === 0, f(d.duringDb, 2) + ' dB');
  }

  // A minute of play.
  const mix = await page.evaluate(() => window.__audioLab.mixReport(60, 7));
  fs.writeFileSync(path.join(OUT, 'mix.wav'), Buffer.from(mix.wav, 'base64'));
  fs.writeFileSync(path.join(OUT, 'mix.png'), Buffer.from(mix.png.split(',')[1], 'base64'));
  report.mix = slim(mix);
  out('');
  out('MIX — ' + mix.seconds + ' s of scripted play over the level music (' + mix.events + ' sound calls: moves, cascades, blockers, specials, praise, goal, finale, win, stars)');
  out('  ' + mix.played + ' effects played, ' + mix.dropped + ' dropped by the rate limit, ' + mix.stolen + ' voices stolen · most voices at once: ' + mix.maxVoices + ' (cap ' + e.maxVoices + "), most 'match' voices: " + mix.maxMatchVoices + ' (cap ' + e.matchVoices + ')');
  out('  peak ' + f(mix.peakDb) + ' dBFS (ceiling ' + LIMITS.ceilingDb + ') · rms ' + f(mix.rmsDb) + ' dBFS');
  out('  programme loudness (ITU-R BS.1770, mono sent to both channels): integrated ' + f(mix.loudness.integrated) + ' LUFS · loudest 400 ms ' + f(mix.loudness.momentaryMax) + ' LUFS · ungated ' + f(mix.loudness.ungated) + ' LUFS');
  out('     effects alone ' + f(mix.sfxOnly.integrated) + ' LUFS · music alone ' + f(mix.musicOnly.integrated) + ' LUFS (peak ' + f(mix.musicOnlyPeakDb) + ' dBFS) · deepest dip of the music under the effects ' + f(mix.duckDeepestDb) + ' dB');
  out('     the study estimated about ' + LIMITS.lufsEstimate + ' LUFS; with every effect peaking at −5 dBFS or less and the music 20 dB down, the mix sits ' + f(mix.loudness.integrated - LIMITS.lufsEstimate) + ' LU from that');
  step('the mix stays under the ceiling', mix.peak < LIMITS.ceiling, f(mix.peakDb) + ' dBFS');
  step('voice caps hold in play', mix.maxVoices <= e.maxVoices && mix.maxMatchVoices <= e.matchVoices, mix.maxVoices + ' / ' + mix.maxMatchVoices);
  step('programme loudness is in the window the peak hierarchy allows', mix.loudness.integrated >= LIMITS.lufs[0] && mix.loudness.integrated <= LIMITS.lufs[1], f(mix.loudness.integrated) + ' LUFS (window ' + LIMITS.lufs.join(' … ') + ')');
  step('the music is under the effects', mix.musicOnly.integrated < mix.sfxOnly.integrated - 3, 'music ' + f(mix.musicOnly.integrated) + ' LUFS, effects ' + f(mix.sfxOnly.integrated) + ' LUFS');
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
    const peakDb = 20 * Math.log10(r.peak);
    const flags = musicLevelFlags(report, peakDb, r.loudness);
    const minuteSpread = Math.max.apply(null, r.minuteDb) - Math.min.apply(null, r.minuteDb);
    const tenSpread = Math.max.apply(null, r.tenSecondDb) - Math.min.apply(null, r.tenSecondDb);
    const firstLast = Math.abs(r.minuteDb[0] - r.minuteDb[r.minuteDb.length - 1]);
    if (r.peak >= LIMITS.ceiling) flags.push('CLIPS');
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
    const pump = await page.evaluate((t) => window.__audioLab.pumpReport(t), track);
    report.longMusic[report.longMusic.length - 1].pump = pump;
    if (pump.below3 > LIMITS.pump3 || pump.below6 > LIMITS.pump6) flags.push('PUMPING');
    out('');
    out('music-' + track + ' ' + r.seconds + ' s: ' + r.bars + ' bars, ' + r.events + ' events scheduled, ' + r.dropped + ' dropped, ' + r.resyncs + ' grid restarts   ' + (flags.join(' ') || 'ok'));
    out('  peak ' + f(r.peak, 3) + ' (' + f(peakDb) + ' dBFS, music level ' + report.expected.musicPeakDb + ') · rms ' + f(r.rmsDb) + ' dBFS · crest ' + f(r.crest) + ' dB · A-weighted frames: loudest ' + f(r.loudness.max) + ', 95th percentile ' + f(r.loudness.p95) + ', median ' + f(r.loudness.p50) + ' dB');
    out('  dynamics: without the compressor and clipper the crest would be ' + f(r.rawCrest) + ' dB — they bring the body ' + f(r.densityGainDb) + ' dB closer to the peak (compressor ' + f(r.glueMean) + ' dB on average, ' + f(r.glueMax) + ' dB at most; clipper bending on ' + f(r.clipShare * 100, 2) + ' % of the samples)');
    out('  pumping (a steady tone sent through with the lead and the drum): more than 3 dB down ' + f(pump.below3 * 100) + ' % of the time, more than 6 dB ' + f(pump.below6 * 100, 2) + ' % · 5 % of the time below ' + f(pump.p5) + ' dB, deepest dip ' + f(pump.deepest) + ' dB');
    out('  layers alone (first minute): lead ' + f(r.layerDb.lead) + ' · pad ' + f(r.layerDb.pad) + ' · perc ' + f(r.layerDb.perc) + ' dBFS');
    out('  loudness per minute ' + r.minuteDb.map((x) => f(x)).join(' / ') + ' dBFS (first vs last ' + f(firstLast) + ' dB apart, spread ' + f(minuteSpread) + ' dB) · per 10 s from ' + f(Math.min.apply(null, r.tenSecondDb)) + ' to ' + f(Math.max.apply(null, r.tenSecondDb)) + ' (spread ' + f(tenSpread) + ' dB)');
    out('  longest silence ' + f(r.longestSilence, 2) + ' s');
    out('  first vs last minute: waveform difference ' + f(r.firstLastDifference, 2) + ' (0 = same samples, ~1 = unrelated) · ' + r.repeatedBars + ' of ' + r.barsPerMinute + ' bars note-for-note the same · ' + r.distinctBars + ' distinct lead lines in ' + r.leadBars + ' bars');
    out('  audio nodes alive: at most ' + r.maxNodes + ' in ' + r.maxVoices + ' voices (first minute ' + r.firstMinuteNodes + ', last minute ' + r.lastMinuteNodes + ') · left when everything had ended: ' + r.endVoices + ' voices, ' + r.endNodes + ' nodes');
    if (report.clearLoudA !== undefined) {
      out("  its loud moments (95th percentile) are " + f(report.clearLoudA - r.loudness.p95) + " dB under the median 'match'" + (report.uiLoudA !== undefined ? ' and ' + f(report.uiLoudA - r.loudness.p95) + ' dB under the median interface tap' : ''));
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
      for (let i = 0; i < 200; i++) lab.audio.sfx(lab.names[i % lab.names.length], { step: 1 + (i % 13) });
    } catch (e) {
      err = String(e);
    }
    const ms = performance.now() - t0;
    const after = lab.snapshot();
    return { err, ms, voices: after.voices, matchVoices: after.matchVoices, maxVoices: after.maxVoices, played: after.sfxPlayed - before.sfxPlayed, dropped: after.sfxDropped - before.sfxDropped, stolen: after.sfxStolen - before.sfxStolen };
  });
  step('200 effects in one frame do not throw', storm.err === null, storm.err || 'took ' + f(storm.ms) + ' ms');
  step('voice count stays capped at 12 (3 for match)', storm.maxVoices === 12 && storm.voices <= storm.maxVoices && storm.matchVoices <= 3 && storm.played - storm.stolen <= storm.maxVoices && storm.played + storm.dropped === 200,
    storm.voices + ' voices (cap ' + storm.maxVoices + "), " + storm.matchVoices + " 'match' · " + storm.played + ' started, ' + storm.stolen + ' of them stolen again, ' + storm.dropped + ' dropped');
  level = await listen(700);
  step('storm stays under the ceiling at the live output', level.peak < LIMITS.ceiling, 'peak ' + f(level.peak, 3) + ' (' + f(20 * Math.log10(level.peak + 1e-9)) + ' dBFS)');
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
  // 'land' has a longer interval of its own; 'match' has three voices of its own. The
  // calls are spaced on the audio clock (busy-waiting), so a slow timer cannot blur the test.
  await sleep(400);
  const budget = await page.evaluate(() => {
    const lab = window.__audioLab;
    const ctx = lab.audio.debug().context;
    const waitAudio = (seconds) => {
      const until = ctx.currentTime + seconds;
      const giveUp = performance.now() + 2000;
      while (ctx.currentTime < until && performance.now() < giveUp) {
        /* busy */
      }
    };
    const a = lab.snapshot();
    for (let i = 0; i < 12; i++) {
      lab.audio.sfx('land');
      waitAudio(0.01);
    }
    const b = lab.snapshot();
    waitAudio(0.4);
    let most = 0;
    const c = lab.snapshot();
    for (let i = 0; i < 8; i++) {
      lab.audio.sfx('match', { step: 1 + i });
      most = Math.max(most, lab.snapshot().matchVoices);
      waitAudio(0.04);
    }
    const d = lab.snapshot();
    return { lands: b.sfxPlayed - a.sfxPlayed, landSpan: b.time - a.time, matches: d.sfxPlayed - c.sfxPlayed, matchSpan: d.time - c.time, most, stolen: d.sfxStolen - c.sfxStolen };
  });
  const landsMost = Math.floor(budget.landSpan / 0.06) + 1;
  step("'land' starts at most once per 60 ms", budget.lands >= 2 && budget.lands <= landsMost && budget.lands < 12, budget.lands + ' started out of 12 calls in ' + f(budget.landSpan * 1000, 0) + ' ms of audio time (at most ' + landsMost + ' fit)');
  step("'match' never has more than three voices", budget.matches === 8 && budget.most <= 3 && budget.stolen >= 2, budget.matches + ' started over ' + f(budget.matchSpan * 1000, 0) + ' ms, at most ' + budget.most + ' at once, ' + budget.stolen + ' older ones faded out');

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
  // A jingle pulls the music down 4 dB while it plays; a special does so for about 0.6 s.
  // The music bus is watched on the audio clock, so the reading does not depend on timers.
  const watchDuck = (name, opts, seconds) =>
    page.evaluate(async (a) => {
      const lab = window.__audioLab;
      const before = lab.snapshot();
      lab.audio.sfx(a.name, a.opts);
      const series = [];
      const end = performance.now() + a.seconds * 1000;
      while (performance.now() < end) {
        const sn = lab.snapshot();
        series.push([sn.time - before.time, sn.musicLevel]);
        await new Promise((resolve) => setTimeout(resolve, 15));
      }
      return { rest: before.musicLevel, series };
    }, { name, opts, seconds });
  /** Deepest and shallowest level (dB re the resting level) seen between two audio times. */
  const duckBetween = (w, from, to) => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const [t, v] of w.series) {
      if (t < from || t > to) continue;
      const d = 20 * Math.log10(Math.max(v, 1e-9) / Math.max(w.rest, 1e-9));
      lo = Math.min(lo, d);
      hi = Math.max(hi, d);
    }
    return { lo, hi, seen: lo !== Infinity };
  };
  const dWin = await watchDuck('win', undefined, 3.6);
  const winA = duckBetween(dWin, 0.3, 1.5);
  const winB = duckBetween(dWin, 2.9, 3.6);
  step('music ducks 4 dB under a jingle, for its whole length, and comes back', winA.seen && winB.seen && Math.abs(winA.lo + 4) < 0.7 && Math.abs(winA.hi + 4) < 0.7 && Math.abs(winB.lo) < 0.4,
    'music bus at rest ' + f(dWin.rest, 3) + ' · from 0.3 to 1.5 s into the jingle ' + f(winA.lo) + ' … ' + f(winA.hi) + ' dB · after 2.9 s ' + f(winB.lo, 2) + ' dB');
  const dBeam = await watchDuck('beam', undefined, 2.2);
  const beamA = duckBetween(dBeam, 0.2, 0.5);
  const beamB = duckBetween(dBeam, 1.6, 2.2);
  const dMatch = await watchDuck('match', { step: 2 }, 0.5);
  const matchA = duckBetween(dMatch, 0, 0.5);
  step('music ducks under a special for about 0.6 s, and not at all under a match', beamA.seen && beamB.seen && matchA.seen && Math.abs(beamA.lo + 4) < 0.7 && Math.abs(beamB.lo) < 0.4 && Math.abs(matchA.lo) < 0.3,
    'beam: ' + f(beamA.lo) + ' dB between 0.2 and 0.5 s, ' + f(beamB.lo, 2) + ' dB after 1.6 s · match: ' + f(matchA.lo, 2) + ' dB');
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
  // Music alone can never be louder than its level in the mix (plus rounding).
  const MUSIC_LIMIT = Math.pow(10, report.expected.musicPeakDb / 20) * 1.02;
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
  /*
   * Samples missing from a recording: render quanta the browser skipped. That happens when
   * the machine is busy or the audio graph is being rebuilt wholesale, and it is the
   * browser's doing — but a lot of it would be an audible drop-out, so it is bounded, counted
   * and reported.
   */
  let skipped = 0;
  const HOLES_OK = 2048;
  const holesOk = (rec) => {
    skipped += rec.holes || 0;
    return (rec.holes || 0) <= HOLES_OK;
  };
  const holesNote = (rec) => (rec.holes ? ' · the browser skipped ' + Math.round(rec.holes / 128) + ' render quanta (' + f((rec.holes / 44100) * 1000, 0) + ' ms)' : '');

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
      // Voices that were pushed out fade for 12 ms; look again once they are gone.
      await new Promise((resolve) => setTimeout(resolve, 70));
      const settled = lab.snapshot();
      await new Promise((resolve) => setTimeout(resolve, 2730));
      const rec = await lab.rec.stop();
      const probe = lab.probe.stop();
      return { err, ms, before, after, settled, rec: { peak: rec.peak, holes: rec.holes, seconds: rec.seconds, rmsDb: rec.rmsDb }, probe: { starts: probe.starts, late: probe.late, cancelled: probe.cancelled, worstLead: probe.worstLead } };
    });
    await saveRec(page, 'live-flood', 'live: 500 effects in one tick over level music');
    const played = r.after.sfxPlayed - r.before.sfxPlayed;
    const dropped = r.after.sfxDropped - r.before.sfxDropped;
    step('500 effects in one tick do not throw', r.err === null, r.err || 'took ' + f(r.ms) + ' ms');
    const stolen = r.after.sfxStolen - r.before.sfxStolen;
    step('the flood is capped: 12 voices, 3 of them match', r.after.maxVoices === 12 && r.after.voices <= 12 && r.after.matchVoices <= 3 && r.settled.liveVoices - r.before.liveVoices <= 12 + 4 && played - stolen <= 12 && played + dropped === 500,
      r.after.voices + ' voices sounding (' + r.after.matchVoices + " 'match') · " + played + ' started, ' + stolen + ' of them stolen again, ' + dropped + ' dropped · in the graph 70 ms later: ' + (r.settled.liveVoices - r.before.liveVoices) + ' more voices, ' + (r.settled.liveNodes - r.before.liveNodes) + ' more nodes than the music alone');
    step('the flood stays under the ceiling at the real output', r.rec.peak < LIMITS.ceiling && holesOk(r.rec), 'recorded peak ' + f(r.rec.peak, 3) + ' (' + f(20 * Math.log10(r.rec.peak + 1e-9)) + ' dBFS) over ' + f(r.rec.seconds, 2) + ' s' + holesNote(r.rec));
    step('no source of the flood was left to start in the past', r.probe.late === 0, r.probe.starts + ' sources left to sound, smallest lead ' + f(r.probe.worstLead * 1000, 1) + ' ms (effects aim ' + f(r.after.sfxLead * 1000, 0) + ' ms ahead) · ' + (r.after.sfxRebuilt - r.before.sfxRebuilt) + ' voices rebuilt because the clock overtook them, ' + r.probe.cancelled + ' sources taken back');
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
    step('switching never exceeds the music level and does not click', r.rec.peak <= MUSIC_LIMIT && r.rec.maxStep < MUSIC_LIMIT * 0.6 && holesOk(r.rec), 'recorded peak ' + f(r.rec.peak, 3) + ' (' + f(20 * Math.log10(r.rec.peak + 1e-9)) + ' dBFS), largest sample-to-sample jump ' + f(r.rec.maxStep, 3) + holesNote(r.rec));
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
    step('music is audible again, without a burst', rec.rmsDb > -50 && rec.peak <= MUSIC_LIMIT, 'rms ' + f(rec.rmsDb) + ' dBFS, peak ' + f(rec.peak, 3));
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
    step('the audio clock ran on through the stall', r.st.after - r.st.before > 2.7 && holesOk(r.rec), 'clock advanced ' + f(r.st.after - r.st.before, 2) + ' s while the main thread was blocked for 3 s' + holesNote(r.rec));
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
    // … in the middle of a jingle: its frozen remainder must not play when the sound returns.
    const cut = await page.evaluate(async () => {
      const lab = window.__audioLab;
      lab.audio.sfx('win');
      await new Promise((resolve) => setTimeout(resolve, 250));
      const sounding = lab.snapshot().voices;
      await lab.audio.debug().context.suspend();
      await new Promise((resolve) => setTimeout(resolve, 60));
      return { sounding, after: lab.snapshot() };
    });
    await sleep(150);
    s = await untilOf(page, (x) => x.state === 'running' && x.playing === 'menu' && x.musicStarts > before.musicStarts, 3000);
    step('a context suspended behind its back is resumed by the engine', s.state === 'running' && s.playing === 'menu', 'state ' + s.state + ', playing ' + s.playing + ', ' + (s.musicStarts - before.musicStarts) + ' player started');
    step('the jingle that was interrupted is cut, not finished later', cut.sounding === 1 && cut.after.voices === 0 && s.voices === 0, cut.sounding + ' voice sounding before, ' + cut.after.voices + ' right after the interruption, ' + s.voices + ' when the sound is back');
    const afterCut = await page.evaluate(async () => {
      const lab = window.__audioLab;
      const before = lab.snapshot().sfxPlayed;
      lab.audio.sfx('star', { step: 1 });
      await new Promise((resolve) => setTimeout(resolve, 80));
      return { started: lab.snapshot().sfxPlayed - before, voices: lab.snapshot().voices };
    });
    step('effects play again after the interruption', afterCut.started === 1 && afterCut.voices === 1, afterCut.started + ' started, ' + afterCut.voices + ' sounding');
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
      const at = lab.snapshot().time;
      lab.audio.music(null);
      await wait(1300);
      const rec = await lab.rec.stop();
      return { hardCut: rec.hardCut, maxStep: rec.maxStep, rms20: rec.rms20, snap: lab.snapshot(), at: at - rec.t0 };
    });
    const fadeStart = Math.round(a.at / 0.02); // where the fade begins, in 20 ms windows
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
      return { hardCut: rec.hardCut, rms20: rec.rms20, during, snap, at: during.time - rec.t0 };
    });
    const cutAt = Math.round(b.at / 0.02);
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
  // ── 8. unlocking and resuming in the same breath as a sound ──
  {
    out('  · unlock / resume races');
    // (a) the very first tap of a session lands on something that plays a sound
    const a = await open(false);
    await a.page.click('#sfx-win');
    let s = await untilOf(a.page, (x) => x.state === 'running', 4000);
    const first = await a.page.evaluate(async () => {
      const lab = window.__audioLab;
      const level = await lab.listen(900);
      return { level, snap: lab.snapshot() };
    });
    step('the tap that unlocks audio is heard: its own effect is queued and played', s.state === 'running' && first.snap.unlocked && first.snap.sfxPlayed === 1 && first.level.rms > 0.01, 'state ' + s.state + ', ' + first.snap.sfxPlayed + ' effect played, loudest rms ' + db(first.level.rms) + ' dBFS');
    step('no page errors (first tap)', a.errors.length === 0, a.errors.slice(0, 2).join(' | '));
    await a.page.close();
    // (b) resume() and an effect in the same tick
    const b = await open();
    await b.page.evaluate(() => window.__audioLab.audio.music('level'));
    await sleep(700);
    await b.page.evaluate(() => window.__audioLab.audio.suspend());
    s = await untilOf(b.page, (x) => x.state === 'suspended', 2500);
    await sleep(300);
    const r = await b.page.evaluate(async () => {
      const lab = window.__audioLab;
      const before = lab.snapshot();
      lab.audio.resume();
      lab.audio.sfx('reward');
      const queued = lab.snapshot().sfxPlayed - before.sfxPlayed;
      const level = await lab.listen(900);
      return { queued, level, snap: lab.snapshot() };
    });
    step('an effect fired in the same tick as resume() is played once the context runs', r.queued === 1 && r.snap.state === 'running' && r.snap.playing === 'level' && r.level.rms > 0.01, r.queued + ' queued, state ' + r.snap.state + ', loudest rms ' + db(r.level.rms) + ' dBFS');
    // (c) effects fired while suspended, long before the resume, are not played late
    await b.page.evaluate(() => window.__audioLab.audio.suspend());
    await untilOf(b.page, (x) => x.state === 'suspended', 2500);
    const stale = await b.page.evaluate(async () => {
      const lab = window.__audioLab;
      const before = lab.snapshot().sfxPlayed;
      for (let i = 0; i < 20; i++) lab.audio.sfx(lab.names[i]);
      await new Promise((resolve) => setTimeout(resolve, 700));
      lab.audio.resume();
      await new Promise((resolve) => setTimeout(resolve, 500));
      const s2 = lab.snapshot();
      return { started: s2.sfxPlayed - before, voices: s2.voices, state: s2.state };
    });
    step('effects asked for while suspended are dropped, not played on resume', stale.started === 0 && stale.voices === 0 && stale.state === 'running', stale.started + ' started, ' + stale.voices + ' sounding after resume');
    // (d) both toggles flipped a hundred times in one tick
    const flip = await b.page.evaluate(async () => {
      const lab = window.__audioLab;
      const before = lab.snapshot();
      let err = null;
      try {
        for (let i = 0; i < 100; i++) {
          lab.audio.setSfxEnabled(i % 2 === 0);
          lab.audio.setMusicEnabled(i % 3 !== 0);
          lab.audio.sfx('match', { step: 1 + (i % 12) });
          if (i % 10 === 0) lab.audio.music(i % 20 === 0 ? 'menu' : 'level');
        }
        lab.audio.setSfxEnabled(true);
        lab.audio.setMusicEnabled(true);
        lab.audio.music('level');
      } catch (e) {
        err = String(e);
      }
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const s2 = lab.snapshot();
      const again = s2.sfxPlayed;
      lab.audio.sfx('coin');
      return { err, s2, played: lab.snapshot().sfxPlayed - again, nodesBefore: before.liveNodes };
    });
    step('a hundred toggle flips in one tick end in the state asked for last', flip.err === null && flip.s2.state === 'running' && flip.s2.playing === 'level' && flip.s2.sfxEnabled && flip.s2.musicEnabled && flip.s2.fading === 0 && flip.played === 1 && flip.s2.liveNodes <= flip.nodesBefore * 2 + 40,
      flip.err || 'state ' + flip.s2.state + ', playing ' + flip.s2.playing + ', ' + flip.s2.fading + ' fading, ' + flip.s2.liveNodes + ' nodes alive, effects play: ' + (flip.played === 1));
    step('no page errors (races)', b.errors.length === 0, b.errors.slice(0, 2).join(' | '));
    await b.page.close();
  }

  // ── 9. a long cascade: voices stolen continuously, over music, with specials ──
  {
    out('  · a long cascade with voices stolen all the way');
    const { page, errors } = await open();
    await page.evaluate(() => window.__audioLab.audio.music('level'));
    await sleep(1500);
    const base = await snapOf(page);
    const r = await page.evaluate(async () => {
      const lab = window.__audioLab;
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      await lab.rec.start();
      lab.probe.start();
      const before = lab.snapshot();
      const ctx = lab.audio.debug().context;
      let most = 0;
      let mostMatch = 0;
      for (let i = 0; i < 60; i++) {
        const next = ctx.currentTime + 0.045;
        lab.audio.sfx('match', { step: 1 + (i % 16) });
        if (i % 5 === 0) lab.audio.sfx('land');
        if (i % 7 === 3) lab.audio.sfx(['beam', 'nova', 'prism', 'bigCombo'][(i >> 2) % 4]);
        if (i % 9 === 4) lab.audio.sfx('praise', { step: 1 + (i % 4) });
        if (i % 11 === 6) lab.audio.sfx(['stone', 'sand', 'chain', 'vine', 'stoneBreak'][i % 5]);
        const s = lab.snapshot();
        most = Math.max(most, s.voices);
        mostMatch = Math.max(mostMatch, s.matchVoices);
        // Let the music's scheduler tick, then wait out the rest of the 45 ms on the audio clock.
        await wait(0);
        const giveUp = performance.now() + 1000;
        while (ctx.currentTime < next && performance.now() < giveUp) {
          /* busy */
        }
      }
      const after = lab.snapshot();
      await wait(1500);
      const rec = await lab.rec.stop();
      const probe = lab.probe.stop();
      return { before, after, most, mostMatch, end: lab.snapshot(), rec: { peak: rec.peak, holes: rec.holes, rmsDb: rec.rmsDb, seconds: rec.seconds }, probe: { late: probe.late, starts: probe.starts, cancelled: probe.cancelled, worstLead: probe.worstLead } };
    });
    await saveRec(page, 'live-cascade', 'live: 60 matches 45 ms apart with specials, praise and blockers over level music');
    const played = r.after.sfxPlayed - r.before.sfxPlayed;
    const stolen = r.after.sfxStolen - r.before.sfxStolen;
    step('voice caps hold through a long cascade', r.most <= 12 && r.mostMatch <= 3 && stolen > 20, 'at most ' + r.most + ' voices, ' + r.mostMatch + " 'match' · " + played + ' effects played, ' + stolen + ' voices faded out to make room');
    step('the cascade stays under the ceiling', r.rec.peak < LIMITS.ceiling && holesOk(r.rec), 'recorded peak ' + f(r.rec.peak, 3) + ' (' + f(20 * Math.log10(r.rec.peak + 1e-9)) + ' dBFS), rms ' + f(r.rec.rmsDb) + ' dBFS over ' + f(r.rec.seconds, 1) + ' s' + holesNote(r.rec));
    step('nothing in it was left to start in the past', r.probe.late === 0, r.probe.starts + ' sources left to sound, smallest lead ' + f(r.probe.worstLead * 1000, 1) + ' ms · ' + (r.end.sfxRebuilt - r.before.sfxRebuilt) + ' effect voices rebuilt, ' + (r.end.music.dropped - r.before.music.dropped) + ' music notes left out because the clock had overtaken them, ' + r.probe.cancelled + ' sources taken back');
    const s = await untilOf(page, (x) => x.voices === 0 && x.liveVoices <= base.liveVoices + 4, 4000);
    step('every stolen and finished voice is released', s.voices === 0 && s.liveVoices <= base.liveVoices + 4 && s.liveNodes <= base.liveNodes + 30, s.liveVoices + ' voices / ' + s.liveNodes + ' nodes alive (music alone before: ' + base.liveVoices + ' / ' + base.liveNodes + ')');
    step('no page errors (cascade)', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }
  report.adversarial = results;
  report.skippedSamples = skipped;
  out('  render quanta skipped by the browser during these recordings: ' + Math.round(skipped / 128) + ' (' + f((skipped / 44100) * 1000, 0) + ' ms in all; up to ' + Math.round(HOLES_OK / 128) + ' per scenario are tolerated)');
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
    if (!ONLY && !CALIBRATE && !SFX_ONLY) {
      await checkMusic(page, report);
      if (!NO_LONG) await checkLongMusic(page, report);
      await checkMix(page, report);
      await checkOutput(page, report);
    }
    if (errors.length) fail('page', errors.join(' | '));
    await page.close();
    if (!ONLY && !NO_LIVE && !CALIBRATE && !SFX_ONLY) {
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
  if (!ONLY && !CALIBRATE && !SFX_ONLY) {
    fs.writeFileSync(path.join(OUT, 'report.txt'), lines.join('\n') + '\n');
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
  }
  process.exit(failures.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
