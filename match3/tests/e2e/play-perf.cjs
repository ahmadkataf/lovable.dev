/**
 * Frame-time measurement of the play screen under CPU throttling (Chrome DevTools Protocol).
 *
 *   npx vite --port 5184 --strictPort            (in another terminal)
 *   node tests/e2e/play-perf.cjs [rates]         default "1,4,6"
 *
 * A full 9×9 board of six colours (harness level `perf`) at 412×915, device pixel ratio 3 — the
 * canvas a flagship phone gets — plays the heaviest things the game can do, each on a fresh board:
 * prism + prism (the whole board), nova + nova, prism + nova (every gem of a colour becomes a nova
 * and they all go off), prism + beam, beam + nova, beam + beam, and a plain match for comparison.
 * For each it reports
 *   - the interval between animation frames while the blast plays (mean / median / 95th centile),
 *     next to the same measure of an idle page taken just before (the machine's own jitter);
 *   - the time the game's frame function took (scheduler + effects + every canvas call);
 *   - the canvas pixels touched per frame (fill rate — the number that matters on a phone's GPU,
 *     and the only one that does not depend on how busy this machine is), average and worst frame;
 *   - canvas redraws per animation frame (must be exactly 1).
 * Under a throttle the blasts are measured in the steady state: after 13 s of ordinary play, in
 * which the renderer has stepped its quality down as far as the frame times asked for (the
 * "quality" column: 0 = full resolution … 3 = lowest).
 * It fails when a frame is drawn more than once or the worst frame touches more than 9 canvases'
 * worth of pixels, and at ×4 when the game's own work averages more than 8 ms a frame or an
 * ordinary match does not hold 60 fps (median interval 16.7 ms + the idle jitter + 10 %).
 *
 * Headless Chromium rasterises in software — some 60 megapixels a second under the ×4 throttle,
 * a tenth of the weakest phone GPU — so the absolute frame times of the big blasts are a
 * pessimistic stand-in for a phone; they are reported, not judged.
 */
const { chromium } = require('playwright');
const H = require('./play-harness.cjs');

const RATES = (process.argv[2] || '1,4,6').split(',').map(Number);
/** screen: PERF_W × PERF_H CSS px at PERF_DPR (default: 412×915 @3x, the largest canvas a phone gets) */
const W = Number(process.env.PERF_W) || 412;
const HGT = Number(process.env.PERF_H) || 915;
const DPR = Number(process.env.PERF_DPR) || 3;
const ONLY = process.env.PERF_ONLY || '';
/** ordinary play under the throttle before a blast is measured (the renderer adapts its quality in that time) */
const WARM_MS = Number(process.env.PERF_WARM) || 13000;

const BLASTS = [
  ['plain match (7×7)', 'easy', null],
  ['nova + nova', 'perf', [{ c: 6, r: 1 }, { c: 7, r: 1 }]],
  ['prism + nova (all go off)', 'perf', [{ c: 6, r: 5 }, { c: 7, r: 5 }]],
  ['prism + beam (all go off)', 'perf', [{ c: 6, r: 3 }, { c: 7, r: 3 }]],
  ['beam + nova', 'perf', [{ c: 2, r: 3 }, { c: 3, r: 3 }]],
  ['beam + beam', 'perf', [{ c: 1, r: 7 }, { c: 2, r: 7 }]],
  ['prism + prism (whole board)', 'perf', [{ c: 1, r: 1 }, { c: 2, r: 1 }]],
];

/** In the page: record every animation frame, and what the board canvas is asked to draw. */
function instrument() {
  const canvas = document.querySelector('.pl-board');
  const ctx = canvas.getContext('2d');
  const st = (window.__probe = { raf: [], draws: [], cur: null, canvasPx: canvas.width * canvas.height });
  const tick = (t) => {
    st.raf.push(t);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  const drawImage = ctx.drawImage.bind(ctx);
  ctx.drawImage = function (img, ...a) {
    const w = a.length === 2 ? img.width : a.length === 4 ? a[2] : a[6];
    const h = a.length === 2 ? img.height : a.length === 4 ? a[3] : a[7];
    if (st.cur) st.cur.px += Math.abs(w * h);
    return drawImage(img, ...a);
  };
  const fillRect = ctx.fillRect.bind(ctx);
  ctx.fillRect = function (x, y, w, h) {
    if (st.cur) st.cur.px += Math.abs(w * h);
    return fillRect(x, y, w, h);
  };
  const clearRect = ctx.clearRect.bind(ctx);
  ctx.clearRect = function (x, y, w, h) {
    // the renderer clears once per redraw: a frame boundary
    st.cur = { t: performance.now(), px: Math.abs(w * h) };
    st.draws.push(st.cur);
    return clearRect(x, y, w, h);
  };
}

function gapsOf(times) {
  const g = [];
  for (let i = 1; i < times.length; i++) g.push(times[i] - times[i - 1]);
  g.sort((a, b) => a - b);
  const sum = g.reduce((a, x) => a + x, 0);
  return { n: g.length, mean: g.length ? sum / g.length : 0, median: g.length ? g[Math.floor(g.length / 2)] : 0, p95: g.length ? g[Math.floor(g.length * 0.95)] : 0, max: g.length ? g[g.length - 1] : 0 };
}

/**
 * A device that cannot keep up is found out in the first seconds of play, and the renderer steps
 * its quality down (fewer particles, a smaller canvas). So the blasts are measured in the steady
 * state: after some ordinary play under the same throttle.
 */
async function warmUp(page, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    await page.waitForFunction(() => window.__play.isIdle() || window.__play.state() !== 'play', null, { timeout: 60000 });
    if ((await H.state(page)) !== 'play') break;
    const m = await page.evaluate(() => window.__play.hint());
    if (!m) break;
    await page.evaluate((mv) => window.__play.swap(mv.a, mv.b), m);
    await page.waitForTimeout(60);
  }
  await page.waitForFunction(() => window.__play.isIdle() || window.__play.state() !== 'play', null, { timeout: 60000 });
}

async function measure(browser, rate, blast) {
  const [name, level, move] = blast;
  const problems = [];
  const page = await H.openHarness(browser, { w: W, h: HGT, dpr: DPR, query: `level=mix&seed=3&tut=0&inv=0`, problems, tag: `[perf ×${rate}]` });
  await H.idle(page);
  await page.waitForTimeout(500);
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate });
  if (rate > 1) await warmUp(page, WARM_MS);
  await page.evaluate((key) => window.__demo.start(key), level);
  await H.idle(page);
  await page.waitForTimeout(400);
  await page.evaluate(instrument);
  // the machine's own jitter: animation frames of an idle page
  await page.waitForTimeout(700);
  const idle = gapsOf(await page.evaluate(() => window.__probe.raf.slice()));
  const m = move ? { a: move[0], b: move[1] } : await page.evaluate(() => window.__play.hint());
  const before = await page.evaluate(() => ({ raf: window.__probe.raf.length, draws: window.__probe.draws.length, perf: window.__play.perf() }));
  await page.evaluate((mv) => window.__play.swap(mv.a, mv.b), m);
  await page.waitForFunction(() => window.__play.isIdle() || window.__play.state() !== 'play', null, { timeout: 180000 });
  const after = await page.evaluate((b) => {
    const p = window.__probe;
    const perf = window.__play.perf();
    const draws = p.draws.slice(b.draws);
    const frames = perf.frames - b.perf.frames;
    // animation frames between the first and the last redraw of the turn
    const t0 = draws.length ? draws[0].t : 0;
    const t1 = draws.length ? draws[draws.length - 1].t : 0;
    const raf = p.raf.filter((t) => t >= t0 - 1 && t <= t1 + 1);
    return {
      raf,
      draws: draws.length,
      rafs: raf.length,
      fillAvg: draws.reduce((s, d) => s + d.px, 0) / Math.max(1, draws.length) / p.canvasPx,
      fillMax: draws.reduce((mx, d) => Math.max(mx, d.px), 0) / p.canvasPx,
      canvasMP: p.canvasPx / 1e6,
      work: frames > 0 ? (perf.meanWork * perf.frames - b.perf.meanWork * b.perf.frames) / frames : 0,
      quality: perf.quality,
      canvas: document.querySelector('.pl-board').width + '×' + document.querySelector('.pl-board').height,
    };
  }, before);
  await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.context().close();
  return { name, idle, gaps: gapsOf(after.raf), ...after, problems };
}

(async () => {
  const browser = await chromium.launch();
  const failures = [];
  for (const rate of RATES) {
    console.log(`\nCPU ×${rate}   9×9 board, ${W}×${HGT} @${DPR}x`);
    console.log('  blast                          frames   interval mean / median / p95   idle median   game work   redraws/frame   fill avg / worst (canvases)');
    let work = 0;
    let frames = 0;
    for (const blast of BLASTS) {
      if (ONLY && blast[0].indexOf(ONLY) < 0) continue;
      const r = await measure(browser, rate, blast);
      work += r.work * r.gaps.n;
      frames += r.gaps.n;
      const perFrame = r.rafs > 0 ? r.draws / r.rafs : 0;
      console.log(
        `  ${r.name.padEnd(30)} ${String(r.gaps.n).padStart(5)}   ${r.gaps.mean.toFixed(1).padStart(13)} / ${r.gaps.median.toFixed(1).padStart(5)} / ${r.gaps.p95.toFixed(1).padStart(5)}   ${r.idle.median.toFixed(1).padStart(10)}   ${r.work.toFixed(2).padStart(6)} ms   ${perFrame.toFixed(2).padStart(13)}   ${r.fillAvg.toFixed(2).padStart(8)} / ${r.fillMax.toFixed(2)}   quality ${r.quality} (${r.canvas})`,
      );
      if (r.problems.length > 0) failures.push(`×${rate} ${r.name}: console problems: ${r.problems.join('; ')}`);
      if (perFrame > 1.05) failures.push(`×${rate} ${r.name}: ${perFrame.toFixed(2)} canvas redraws per animation frame`);
      if (r.fillMax > 9) failures.push(`×${rate} ${r.name}: worst frame touched ${r.fillMax.toFixed(1)} canvases of pixels`);
      if (rate === 4) {
        if (r.work > 8) failures.push(`×4 ${r.name}: the game's own work averages ${r.work.toFixed(1)} ms a frame`);
        const allowed = Math.max(16.7, r.idle.median) * 1.1;
        if (r.name.indexOf('plain') >= 0 && r.gaps.median > allowed) failures.push(`×4 ${r.name}: median frame interval ${r.gaps.median.toFixed(1)} ms (idle ${r.idle.median.toFixed(1)} ms)`);
      }
    }
    console.log(`  game work averaged over all frames: ${(frames > 0 ? work / frames : 0).toFixed(2)} ms`);
  }
  await browser.close();
  if (failures.length > 0) console.log('\n' + failures.map((f) => '  ✗ ' + f).join('\n'));
  console.log(failures.length > 0 ? '\nplay perf: FAILED' : '\nplay perf: PASSED');
  process.exit(failures.length > 0 ? 1 : 0);
})();
