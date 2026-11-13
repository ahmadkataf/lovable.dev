/*
 * Zumurud wrapper self-test (debug builds only):
 *
 *   adb shell am start -n com.zumurud.game/.MainActivity --ez diag true
 *
 * Exercises every native bridge method and every promise the wrapper makes to the game page, and
 * prints one line per check on screen and to the console ("DIAG PASS|FAIL|WAIT|INFO name: detail",
 * Logcat tag ZumurudJS). WAIT lines need something only a person or tools/android/emu-smoke.sh can
 * do: press Back, send the app to the background and return, restart the app.
 * Every change is followed by "DIAG SUMMARY pass=… fail=… wait=…" (logged as a warning so it also
 * shows in builds that only forward warnings).
 *
 * Kept to plain ES2017 inside one module so it also runs on old WebViews.
 */
window.__diagModuleRan = true;

const t0 = performance.now();
const B = window.AndroidBridge;
const D = window.DiagBridge;
const outEl = document.getElementById('out');
const summaryEl = document.getElementById('summary');
const frameEl = document.getElementById('frame');

const order = [];
const results = {};
let summaryTimer = 0;
let finished = false;

function set(name, status, detail) {
  if (!results[name]) order.push(name);
  const previous = results[name];
  results[name] = { status: status, detail: String(detail === undefined ? '' : detail) };
  if (!previous || previous.status !== status || previous.detail !== results[name].detail) {
    console.log('DIAG ' + status + ' ' + name + ': ' + results[name].detail);
  }
  render();
}

function render() {
  outEl.textContent = '';
  let pass = 0;
  let fail = 0;
  let wait = 0;
  for (const name of order) {
    const r = results[name];
    if (r.status === 'PASS') pass++;
    else if (r.status === 'FAIL') fail++;
    else if (r.status === 'WAIT') wait++;
    const line = document.createElement('div');
    line.className = r.status;
    line.textContent = r.status + ' ' + name + (r.detail ? ': ' + r.detail : '');
    outEl.appendChild(line);
  }
  const text = 'pass=' + pass + ' fail=' + fail + ' wait=' + wait;
  summaryEl.textContent = text + (!finished ? '  (running…)' : fail === 0 && wait === 0 ? '  — ALL PASS' : '');
  summaryEl.className = fail > 0 ? 'FAIL' : wait > 0 ? 'WAIT' : 'PASS';
  clearTimeout(summaryTimer);
  summaryTimer = setTimeout(function () {
    console.warn('DIAG SUMMARY ' + text);
  }, 400);
}

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

async function check(name, fn) {
  try {
    const detail = await fn();
    if (detail !== undefined) set(name, 'PASS', detail);
  } catch (err) {
    set(name, 'FAIL', err && err.message ? err.message : String(err));
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function withTimeout(promise, ms, what) {
  return Promise.race([
    promise,
    new Promise(function (_, reject) {
      setTimeout(function () {
        reject(new Error(what + ' timed out after ' + ms + ' ms'));
      }, ms);
    }),
  ]);
}

// ───────────────────────── hooks the wrapper calls ─────────────────────────

const seen = { back: 0, pause: 0, resume: 0, insets: [], store: [], hidden: 0, visible: 0 };
const hooks = window.__native || {};
hooks.back = function () {
  seen.back++;
  onBack();
};
hooks.pause = function () {
  seen.pause++;
  onLifecycle();
};
hooks.resume = function () {
  seen.resume++;
  onLifecycle();
};
hooks.insets = function (json) {
  seen.insets.push(json);
  onInsets();
};
hooks.store = function (json) {
  seen.store.push(json);
};
window.__native = hooks;
document.addEventListener('visibilitychange', function () {
  if (document.hidden) seen.hidden++;
  else seen.visible++;
  onLifecycle();
});

window.addEventListener('resize', function () {
  console.log('DIAG INFO resize: ' + window.innerWidth + '×' + window.innerHeight + ' CSS px, devicePixelRatio ' + window.devicePixelRatio);
});

const cspViolations = [];
document.addEventListener('securitypolicyviolation', function (e) {
  cspViolations.push(e.violatedDirective + ' ' + e.blockedURI);
});

function nativeState() {
  // Asks the debug-only DiagBridge for the activity's own view of things.
  return new Promise(function (resolve) {
    if (!D) return resolve(null);
    const name = '__diagState' + Math.floor(Math.random() * 1e9);
    const timer = setTimeout(function () {
      delete window[name];
      resolve(null);
    }, 3000);
    window[name] = function (state) {
      clearTimeout(timer);
      delete window[name];
      resolve(state);
    };
    D.requestState(name);
  });
}

// ───────────────────────── checks that wait for the outside world ─────────────────────────

let backArmed = false;

function onBack() {
  if (!backArmed) return;
  set('back', 'PASS', '__native.back() called ' + seen.back + '× while not at root; now at root again (next Back leaves the app)');
  backArmed = false;
  B.setAtRoot(true);
}

function onLifecycle() {
  const detail =
    'pause×' + seen.pause + ' resume×' + seen.resume + ' hidden×' + seen.hidden + ' visible×' + seen.visible;
  if (seen.pause > 0 && seen.resume > 0 && seen.hidden > 0 && seen.visible > 0) set('lifecycle', 'PASS', detail);
  else set('lifecycle', 'WAIT', detail + ' — press Home, then return to the app');
}

function showInsetFrame(i) {
  frameEl.style.borderTopWidth = i.top + 'px';
  frameEl.style.borderRightWidth = i.right + 'px';
  frameEl.style.borderBottomWidth = i.bottom + 'px';
  frameEl.style.borderLeftWidth = i.left + 'px';
}

function parseInsets(json) {
  const i = JSON.parse(json);
  for (const side of ['top', 'right', 'bottom', 'left']) {
    assert(typeof i[side] === 'number' && i[side] >= 0 && isFinite(i[side]), 'insets.' + side + ' is not a number: ' + json);
  }
  return i;
}

function onInsets() {
  check('insets', function () {
    const now = B.insets();
    const i = parseInsets(now);
    showInsetFrame(i);
    const pushed = seen.insets.length;
    if (pushed === 0) {
      set('insets', 'WAIT', 'insets()=' + now + ' — no __native.insets() push yet');
      return undefined;
    }
    const last = seen.insets[pushed - 1];
    parseInsets(last);
    assert(last === now, 'last push ' + last + ' differs from insets() ' + now);
    return 'insets()=' + now + ' pushes=' + pushed + ' (red frame = inset area)';
  });
}

// ───────────────────────── the checks ─────────────────────────

async function run() {
  set('module', 'PASS', 'ES module executed after ' + Math.round(t0) + ' ms; UA ' + ((/Chrome\/[\d.]+/.exec(navigator.userAgent) || ['?'])[0]));

  await check('bridge', function () {
    assert(B && typeof B === 'object', 'window.AndroidBridge is missing');
    const names = ['loadSave', 'storeSave', 'haptic', 'setAtRoot', 'info', 'rate', 'ready', 'insets', 'storeCaps', 'iapQuery', 'iapBuy', 'iapFinish', 'iapRestore', 'adShowRewarded', 'adShowInterstitial', 'adPrivacyOptions'];
    const missing = names.filter(function (n) {
      return typeof B[n] !== 'function';
    });
    assert(missing.length === 0, 'missing methods: ' + missing.join(', '));
    return names.length + ' methods present';
  });
  if (!B) return;

  // Does requestAnimationFrame tick while the splash screen is still up? (Decides when the game may call ready().)
  const before = await nativeState();
  let ticks = 0;
  let counting = true;
  (function loop() {
    requestAnimationFrame(function () {
      if (!counting) return;
      ticks++;
      loop();
    });
  })();
  await sleep(1500);
  counting = false;
  await check('ready', function () {
    const calledAt = Math.round(performance.now());
    B.ready();
    B.ready(); // calling it again is harmless
    const splash = before ? (before.splashUp ? 'splash still up' : 'splash already gone') : 'splash state unknown';
    return 'ready() called at ' + calledAt + ' ms (' + splash + '); requestAnimationFrame ticked ' + ticks + '× in the 1500 ms before';
  });

  await check('mime', async function () {
    const expected = {
      './diag.js': 'text/javascript',
      './diag.css': 'text/css',
      './data.json': 'application/json',
      './shape.svg': 'image/svg+xml',
      './pixel.png': 'image/png',
      './font.woff2': 'font/woff2',
      './index.html': 'text/html',
    };
    const got = [];
    for (const url of Object.keys(expected)) {
      const res = await fetch(url);
      assert(res.status === 200, url + ' → HTTP ' + res.status);
      const type = (res.headers.get('content-type') || '').toLowerCase();
      assert(type.indexOf(expected[url]) === 0, url + ' served as "' + type + '", expected ' + expected[url]);
      got.push(url.slice(2).split('.').pop());
    }
    const missing = await fetch('./no-such-file.txt');
    assert(missing.status === 404, 'a missing file answered HTTP ' + missing.status + ', expected 404');
    const escape = await fetch('./..%2f..%2fAndroidManifest.xml').then(function (r) { return r.status; }, function () { return 0; });
    assert(escape !== 200, 'path traversal answered 200');
    return got.join(' ') + ' correct; missing file → 404';
  });

  await check('css', function () {
    const w = getComputedStyle(document.getElementById('css-mark')).width;
    assert(w === '7px', 'external stylesheet not applied (marker width ' + w + ')');
    return 'external stylesheet applied';
  });

  await check('font', async function () {
    assert(document.fonts && typeof document.fonts.load === 'function', 'no FontFaceSet');
    await withTimeout(document.fonts.load('700 17px "DiagFont"', 'Zumurud'), 5000, 'font load');
    assert(document.fonts.check('700 17px "DiagFont"', 'Zumurud'), 'document.fonts.check is false');
    let loaded = 0;
    document.fonts.forEach(function (f) {
      if (f.family.replace(/["']/g, '') === 'DiagFont' && f.status === 'loaded') loaded++;
    });
    assert(loaded > 0, 'no loaded FontFace for DiagFont');
    return 'bundled woff2 loaded (document.fonts.check true)';
  });

  await check('fetch-json', async function () {
    const data = await (await fetch('./data.json')).json();
    assert(data && data.ok === true && data.answer === 42, 'unexpected JSON content');
    const viaXhr = await new Promise(function (resolve, reject) {
      const x = new XMLHttpRequest();
      x.open('GET', './data.json');
      x.onload = function () { resolve(x.status); };
      x.onerror = function () { reject(new Error('XHR failed')); };
      x.send();
    });
    assert(viaXhr === 200, 'XHR status ' + viaXhr);
    return 'fetch + XHR of a bundled file work (origin ' + location.origin + ')';
  });

  await check('net-image', function () {
    return withTimeout(new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () { reject(new Error('an external image LOADED')); };
      img.onerror = function () { resolve('external https image refused'); };
      img.src = 'https://example.com/favicon.ico?' + Date.now();
    }), 8000, 'external image');
  });

  await check('net-fetch', async function () {
    let reached = '';
    try {
      const res = await withTimeout(fetch('https://example.com/', { mode: 'no-cors', cache: 'no-store' }), 8000, 'external fetch');
      reached = 'fetch resolved (type ' + res.type + ', status ' + res.status + ')';
    } catch (err) {
      return 'external https fetch refused (' + (err && err.name) + ')';
    }
    throw new Error(reached);
  });

  await check('net-http', function () {
    return withTimeout(new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () { reject(new Error('a cleartext http image LOADED')); };
      img.onerror = function () { resolve('cleartext http image refused'); };
      img.src = 'http://example.com/favicon.ico?' + Date.now();
    }), 8000, 'http image');
  });

  await check('net-websocket', function () {
    return withTimeout(new Promise(function (resolve, reject) {
      let ws;
      try {
        ws = new WebSocket('wss://example.com/socket');
      } catch (err) {
        return resolve('WebSocket constructor refused (' + err.name + ')');
      }
      ws.onopen = function () { reject(new Error('a WebSocket OPENED')); };
      ws.onerror = function () {
        const byCsp = cspViolations.some(function (v) { return v.indexOf('connect-src') === 0; });
        resolve('WebSocket refused' + (byCsp ? ' by the page policy (connect-src)' : ''));
      };
    }), 8000, 'websocket');
  });

  await check('localStorage', function () {
    const key = '__diag_ls';
    localStorage.setItem(key, 'v1');
    assert(localStorage.getItem(key) === 'v1', 'value did not read back');
    localStorage.removeItem(key);
    const runs = Number(localStorage.getItem('__diag_runs') || '0') + 1;
    localStorage.setItem('__diag_runs', String(runs));
    return 'works; page runs counted in localStorage: ' + runs;
  });

  // Save round trip. The marker is left in the save slot so the next start can prove persistence.
  await check('save', function () {
    const before = B.loadSave();
    assert(typeof before === 'string', 'loadSave() returned ' + typeof before);
    let previous = null;
    try {
      previous = JSON.parse(before);
    } catch (_) {
      previous = null;
    }
    const runs = previous && previous.__diag ? previous.__diag.runs : 0;
    const stamp = Date.now();
    const text = JSON.stringify({ __diag: { runs: runs + 1, stamp: stamp, text: 'زمرد ✓ "quotes" \\ \u2028 end' } });
    B.storeSave(text);
    const after = B.loadSave();
    assert(after === text, 'loadSave() did not return what storeSave() stored');
    window.__diagSave = { text: text, runs: runs };
    return 'round trip ok (' + text.length + ' chars incl. Arabic, quotes, U+2028)';
  });

  await check('save-restart', function () {
    const runs = window.__diagSave ? window.__diagSave.runs : 0;
    if (runs >= 1) return 'the save written by an earlier process was read back (diagnostics run #' + (runs + 1) + ')';
    set('save-restart', 'WAIT', 'first run — force-stop and start the app again to prove the save survives');
    return undefined;
  });

  await check('save-limit', function () {
    const good = B.loadSave();
    const big = new Array(1024 * 1024 + 2).join('x'); // 1 MiB + 1
    B.storeSave(big);
    assert(B.loadSave() === good, 'a payload over 1 MB replaced the save');
    const edge = new Array(200 * 1024 + 1).join('y');
    B.storeSave(edge);
    assert(B.loadSave() === edge, 'a 200 KB payload was not stored');
    B.storeSave(good);
    assert(B.loadSave() === good, 'could not restore the marker');
    return 'payload > 1 MB rejected, 200 KB accepted';
  });

  await check('bad-input', function () {
    const calls = [
      function () { B.storeSave(null); },
      function () { B.storeSave(undefined); },
      function () { B.storeSave(12345); },
      function () { B.haptic(null); },
      function () { B.haptic(undefined); },
      function () { B.haptic('no-such-kind'); },
      function () { B.haptic(7); },
      function () { B.haptic(new Array(5000).join('z')); },
      function () { B.setAtRoot(null); },
      function () { B.setAtRoot('yes'); },
      function () { B.iapQuery(null); },
      function () { B.iapBuy(null); },
      function () { B.iapBuy('../../etc'); },
      function () { B.iapFinish(null); },
      function () { B.adShowRewarded(null); },
      function () { B.adShowRewarded('<script>'); },
    ];
    const good = window.__diagSave ? window.__diagSave.text : B.loadSave();
    let thrown = 0;
    for (const call of calls) {
      try {
        call();
      } catch (_) {
        thrown++;
      }
    }
    assert(thrown === 0, thrown + ' of ' + calls.length + ' bad calls threw into JS');
    const now = B.loadSave();
    // storeSave(12345) arrives as the string "12345" (WebView coerces); anything else must be ignored.
    assert(now === good || now === '12345', 'a bad storeSave() call damaged the save: ' + now.slice(0, 40));
    B.storeSave(good);
    B.setAtRoot(true);
    return calls.length + ' malformed calls, none threw';
  });

  await check('haptic', function () {
    const kinds = ['light', 'medium', 'heavy', 'success', 'error'];
    for (const kind of kinds) B.haptic(kind);
    return kinds.join(', ') + ' accepted without throwing';
  });

  await check('info', function () {
    const raw = B.info();
    const info = JSON.parse(raw);
    assert(typeof info.versionName === 'string' && /^\d+\.\d+/.test(info.versionName), 'versionName: ' + info.versionName);
    assert(typeof info.versionCode === 'number' && info.versionCode >= 1, 'versionCode: ' + info.versionCode);
    assert(typeof info.locale === 'string' && /^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$/.test(info.locale), 'locale: ' + info.locale);
    return raw + ' navigator.language=' + navigator.language;
  });

  onInsets();

  await check('store', async function () {
    const caps = JSON.parse(B.storeCaps());
    assert(typeof caps.billing === 'boolean' && typeof caps.ads === 'boolean', 'storeCaps: ' + B.storeCaps());
    const start = seen.store.length;
    B.iapQuery(JSON.stringify([{ id: 'coins_small', kind: 'consumable' }]));
    B.iapRestore();
    B.iapBuy('coins_small');
    B.adShowRewarded('freeCoins');
    B.adShowInterstitial();
    B.adPrivacyOptions();
    B.iapFinish('token');
    await sleep(500);
    const events = seen.store.slice(start).map(function (json) { return JSON.parse(json).type; });
    if (!caps.billing && !caps.ads) {
      assert(events.join(',') === 'products,owned,purchase,adResult,adResult,ads', 'events without a store: ' + events.join(','));
    }
    return 'caps ' + B.storeCaps() + '; events via __native.store: ' + (events.join(',') || 'none yet');
  });

  await check('audio', async function () {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    assert(Ctx, 'no AudioContext');
    const ctx = new Ctx();
    const stateAtStart = ctx.state;
    if (ctx.state !== 'running') await withTimeout(ctx.resume(), 3000, 'AudioContext.resume()');
    const osc = ctx.createOscillator();
    osc.frequency.value = 440;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    const mute = ctx.createGain();
    mute.gain.value = 0.0001; // analysed at full level, all but silent on the speaker
    osc.connect(analyser);
    analyser.connect(mute);
    mute.connect(ctx.destination);
    osc.start();
    const data = new Uint8Array(analyser.fftSize);
    let peak = 0;
    const startTime = ctx.currentTime;
    for (let i = 0; i < 25 && peak < 20; i++) {
      await sleep(60);
      analyser.getByteTimeDomainData(data);
      for (let k = 0; k < data.length; k++) peak = Math.max(peak, Math.abs(data[k] - 128));
    }
    const advanced = ctx.currentTime - startTime;
    osc.stop();
    await ctx.close();
    assert(peak >= 20, 'analyser saw no signal (peak ' + peak + ', state ' + ctx.state + ')');
    assert(advanced > 0, 'AudioContext clock did not advance');
    return 'state at creation "' + stateAtStart + '" (no tap needed), analyser peak ' + peak + '/128, clock +' + advanced.toFixed(2) + ' s, ' + ctx.sampleRate + ' Hz';
  });

  await check('canvas', async function () {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    assert(g, 'no 2D context');
    g.fillStyle = '#f5c95a';
    g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#ff4d5e';
    g.beginPath();
    g.arc(16, 16, 8, 0, Math.PI * 2);
    g.fill();
    const edge = g.getImageData(1, 1, 1, 1).data;
    const mid = g.getImageData(16, 16, 1, 1).data;
    assert(edge[0] === 245 && edge[1] === 201 && edge[2] === 90, 'edge pixel ' + Array.prototype.join.call(edge, ','));
    assert(mid[0] === 255 && mid[1] === 77 && mid[2] === 94, 'centre pixel ' + Array.prototype.join.call(mid, ','));
    // data: and blob: URLs are in-memory and must keep working (the game uses canvas.toDataURL images).
    await withTimeout(new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = resolve;
      img.onerror = function () { reject(new Error('a data: URL image failed to load')); };
      img.src = c.toDataURL('image/png');
    }), 4000, 'data URL image');
    const blobUrl = URL.createObjectURL(new Blob(['{"b":1}'], { type: 'application/json' }));
    const viaBlob = await (await fetch(blobUrl)).json();
    URL.revokeObjectURL(blobUrl);
    assert(viaBlob.b === 1, 'blob: URL fetch failed');
    const svg = await withTimeout(new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () { resolve(img.naturalWidth); };
      img.onerror = function () { reject(new Error('bundled SVG image failed')); };
      img.src = './shape.svg';
    }), 4000, 'svg image');
    return '2D drawing reads back exactly; data: image, blob: fetch and bundled SVG (' + svg + 'px) load';
  });

  await check('viewport', function () {
    const dpr = window.devicePixelRatio;
    assert(dpr > 0 && window.innerWidth > 0 && window.innerHeight > 0, 'bad viewport');
    return window.innerWidth + '×' + window.innerHeight + ' CSS px, devicePixelRatio ' + dpr + ' → ' +
      Math.round(window.innerWidth * dpr) + '×' + Math.round(window.innerHeight * dpr) + ' px; screen ' + screen.width + '×' + screen.height;
  });

  await check('text-zoom', function () {
    // HTML text must not follow the system font size: compare laid-out text with canvas text (never zoomed).
    const probe = document.getElementById('probe');
    const domWidth = probe.getBoundingClientRect().width;
    const g = document.createElement('canvas').getContext('2d');
    g.font = '16px monospace';
    const canvasWidth = g.measureText(probe.textContent).width;
    const ratio = domWidth / canvasWidth;
    assert(Math.abs(ratio - 1) < 0.03, 'HTML text is scaled ×' + ratio.toFixed(3) + ' (font size setting leaks into the page)');
    return 'HTML text ×' + ratio.toFixed(3) + ' of canvas text (16px → ' + getComputedStyle(probe).fontSize + ')';
  });

  await check('dialogs', function () {
    const start = performance.now();
    window.alert('diag');
    const confirmed = window.confirm('diag');
    const answer = window.prompt('diag', 'x');
    const took = performance.now() - start;
    assert(took < 1500, 'a JS dialog blocked for ' + Math.round(took) + ' ms');
    return 'alert/confirm/prompt return at once without UI (confirm=' + confirmed + ', prompt=' + answer + ')';
  });

  await check('navigation', async function () {
    // Leaving the bundled origin must be cancelled; this page must still be alive afterwards.
    const marker = String(Math.random());
    window.__diagNavMarker = marker;
    location.href = 'https://example.org/';
    await sleep(700);
    const opened = window.open('https://example.org/', '_blank');
    await sleep(500);
    assert(window.__diagNavMarker === marker && location.pathname.indexOf('/assets/') === 0, 'the page navigated away');
    return 'location.href and window.open to another origin were cancelled (window.open → ' + (opened ? 'window' : 'null') + ')';
  });

  // Back: say "not at root" — the wrapper must now send Back to the page.
  backArmed = true;
  B.setAtRoot(false);
  set('back', 'WAIT', 'setAtRoot(false) sent — press Back once');
  await sleep(400);
  const state = await nativeState();
  await check('native-state', function () {
    if (!state) {
      set('native-state', 'INFO', 'no DiagBridge in this build');
      return undefined;
    }
    assert(state.backToPage === true, 'setAtRoot(false) did not enable the Back callback');
    assert(state.pageReady === true, 'ready() did not reach the activity');
    assert(state.errorShown === false, 'the error screen is showing');
    return 'Back→page enabled, splash released, renderer restarts ' + state.rendererRestarts + ', API ' + state.sdk +
      ', sw' + state.smallestWidthDp + 'dp, fontScale ' + state.fontScale + ', requestedOrientation ' + state.requestedOrientation;
  });
  if (state && state.rendererRestarts > 0) {
    set('renderer-recovery', 'PASS', 'this page was reloaded by the wrapper after losing the renderer ' + state.rendererRestarts + '×');
  }

  finished = true;
  onLifecycle();
}

run().catch(function (err) {
  set('diag', 'FAIL', 'the self-test itself failed: ' + (err && err.message ? err.message : err));
});
