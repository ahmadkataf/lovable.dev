/**
 * Frame-time measurement of the play screen under CPU throttling (Chrome DevTools Protocol).
 *
 *   npx vite --port 5184 --strictPort            (in another terminal)
 *   node tests/e2e/play-perf.cjs [rates]         default "1,4,6"
 *
 * A full 9×9 board of six colours (harness level `perf`) at 412×915, device pixel ratio 3 — the
 * canvas a flagship phone gets — plays the heaviest things the game can do: prism + prism (the
 * whole board), nova + nova, prism + nova (every gem of a colour becomes a nova and they all go
 * off), prism + beam, beam + nova, then ordinary cascades. For each blast it reports the interval
 * between animation frames (what the player sees) and the time the game's own frame function took
 * (what the game costs), and it fails when the mean frame interval at ×4 exceeds 16.7 ms + 10 %.
 *
 * Headless Chromium rasterises the canvas in software, so the absolute numbers are a pessimistic
 * stand-in for a phone's GPU; the throttle multiplies them further. It is the trend and the budget
 * that matter.
 */
const { chromium } = require('playwright');
const H = require('./play-harness.cjs');

const RATES = (process.argv[2] || '1,4,6').split(',').map(Number);
const BUDGET_MS = 16.7 * 1.1;

const BLASTS = [
  { name: 'prism + prism (whole board)', a: { c: 1, r: 1 }, b: { c: 2, r: 1 } },
  { name: 'nova + nova', kinds: ['nova', 'nova'] },
  { name: 'prism + nova (all go off)', kinds: ['prism', 'nova'] },
  { name: 'prism + beam (all go off)', kinds: ['prism', 'beamH', 'beamV'] },
  { name: 'beam + nova', kinds: ['beamH', 'nova', 'beamV'] },
  { name: 'beam + beam', kinds: ['beamH', 'beamV', 'beamH'] },
  { name: 'hinted move', hint: true },
  { name: 'hinted move', hint: true },
  { name: 'hinted move', hint: true },
];

/** Two neighbouring specials of the wanted kinds that are still on the board. */
function findPair(page, kinds) {
  return page.evaluate((want) => {
    const s = window.__play.snapshot();
    const at = (c, r) => (c >= 0 && r >= 0 && c < s.cols && r < s.rows ? s.cells[r * s.cols + c].piece : null);
    const special = (p) => p && (p.kind === 'prism' || p.kind === 'nova' || p.kind === 'beamH' || p.kind === 'beamV');
    let fallback = null;
    for (let r = 0; r < s.rows; r++) {
      for (let c = 0; c < s.cols; c++) {
        const p = at(c, r);
        if (!special(p)) continue;
        for (const [dc, dr] of [[1, 0], [0, 1]]) {
          const q = at(c + dc, r + dr);
          if (!special(q)) continue;
          const pair = { a: { c, r }, b: { c: c + dc, r: r + dr } };
          if (want.includes(p.kind) && want.includes(q.kind) && (p.kind !== q.kind || want.filter((k) => k === p.kind).length > 1 || want.length === 2 && want[0] === want[1])) return pair;
          if (!fallback) fallback = pair;
        }
      }
    }
    return fallback;
  }, kinds);
}

async function measure(browser, rate) {
  const problems = [];
  const page = await H.openHarness(browser, { w: 412, h: 915, dpr: 3, query: 'level=perf&seed=3&tut=0&inv=0', problems, tag: `[perf ×${rate}]` });
  await H.idle(page);
  await page.waitForTimeout(600);
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate });
  // a frame recorder that runs all the time
  await page.evaluate(() => {
    window.__frames = [];
    const tick = (t) => {
      window.__frames.push(t);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const rows = [];
  for (const blast of BLASTS) {
    await H.idle(page);
    await page.waitForTimeout(250);
    let move = null;
    if (blast.hint) move = await page.evaluate(() => window.__play.hint());
    else if (blast.a) move = { a: blast.a, b: blast.b };
    else move = await findPair(page, blast.kinds);
    if (!move) continue;
    const before = await page.evaluate(() => ({ t: performance.now(), perf: window.__play.perf(), n: window.__frames.length }));
    await page.evaluate((m) => window.__play.swap(m.a, m.b), move);
    await page.waitForFunction(() => window.__play.isIdle() || window.__play.state() !== 'play', null, { timeout: 120000 });
    const r = await page.evaluate((b) => {
      const now = performance.now();
      const perf = window.__play.perf();
      const times = window.__frames.slice(b.n);
      const gaps = [];
      for (let i = 1; i < times.length; i++) gaps.push(times[i] - times[i - 1]);
      gaps.sort((x, y) => x - y);
      const sum = gaps.reduce((a, x) => a + x, 0);
      const frames = perf.frames - b.perf.frames;
      const work = perf.meanWork * perf.frames - b.perf.meanWork * b.perf.frames;
      return {
        ms: now - b.t,
        frames: gaps.length,
        mean: gaps.length ? sum / gaps.length : 0,
        p95: gaps.length ? gaps[Math.floor(gaps.length * 0.95)] : 0,
        max: gaps.length ? gaps[gaps.length - 1] : 0,
        slow: gaps.filter((g) => g > 25).length,
        work: frames > 0 ? work / frames : 0,
        lowEnd: perf.lowEnd,
        particles: perf.particles,
      };
    }, before);
    rows.push({ name: blast.name, ...r });
    if ((await H.state(page)) !== 'play') break;
  }
  await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.context().close();
  return { rows, problems };
}

(async () => {
  const browser = await chromium.launch();
  let failed = false;
  for (const rate of RATES) {
    const { rows, problems } = await measure(browser, rate);
    console.log(`\nCPU ×${rate}  (9×9 board, 412×915 @3x)`);
    console.log('  blast                              time   frames   mean    p95     max   >25ms   game work/frame   low-end');
    let total = 0;
    let frames = 0;
    for (const r of rows) {
      total += r.mean * r.frames;
      frames += r.frames;
      console.log(
        `  ${r.name.padEnd(32)} ${String(Math.round(r.ms)).padStart(6)} ${String(r.frames).padStart(8)} ${r.mean.toFixed(1).padStart(6)} ${r.p95.toFixed(1).padStart(6)} ${r.max.toFixed(1).padStart(7)} ${String(r.slow).padStart(7)} ${r.work.toFixed(2).padStart(14)} ms   ${r.lowEnd ? 'on' : 'off'}`,
      );
    }
    const mean = frames > 0 ? total / frames : 0;
    console.log(`  mean frame interval over all blasts: ${mean.toFixed(2)} ms`);
    if (problems.length > 0) {
      console.log('  CONSOLE PROBLEMS:\n   ' + problems.join('\n   '));
      failed = true;
    }
    if (rate === 4 && mean > BUDGET_MS) {
      console.log(`  ✗ over budget (${BUDGET_MS.toFixed(1)} ms)`);
      failed = true;
    }
  }
  await browser.close();
  console.log(failed ? '\nplay perf: FAILED' : '\nplay perf: PASSED');
  process.exit(failed ? 1 : 0);
})();
