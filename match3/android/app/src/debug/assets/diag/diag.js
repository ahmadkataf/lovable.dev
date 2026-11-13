/*
 * Zumurud wrapper self-test (debug builds only):
 *
 *   adb shell am start -n com.zumurud.game/.MainActivity --ez diag true
 *
 * Exercises every native bridge method and every promise the wrapper makes to the game page, and
 * prints one line per check on screen and to the console ("DIAG PASS|FAIL|WAIT|INFO name: detail",
 * Logcat tag ZumurudJS). The "store" panel (button at the top, or key S) calls the purchase and ad
 * methods by hand and lists every StoreEvent ("DIAG STORE ← …"). WAIT lines need something only a person or tools/android/emu-smoke.sh can
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

// Result lines go to the console as log lines. A release build only forwards warnings and errors
// to Logcat, so when this page runs as the bundled content of a release build (no DiagBridge) the
// lines are sent as warnings instead.
const say = D ? console.log.bind(console) : console.warn.bind(console);

const order = [];
const results = {};
let summaryTimer = 0;
let finished = false;

function set(name, status, detail) {
  if (!results[name]) order.push(name);
  const previous = results[name];
  results[name] = { status: status, detail: String(detail === undefined ? '' : detail) };
  if (!previous || previous.status !== status || previous.detail !== results[name].detail) {
    say('DIAG ' + status + ' ' + name + ': ' + results[name].detail);
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
  onStoreEvent(json);
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

let insetsTimer = 0;

function onInsets() {
  // Pushes arrive asynchronously: while the bars are still moving, insets() can already be one step
  // ahead of the push being handled. Compare only once things have been quiet for a moment.
  clearTimeout(insetsTimer);
  insetsTimer = setTimeout(checkInsets, 500);
}

let insetsMismatches = 0;

function checkInsets() {
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
    if (last !== now) {
      // The push for the newest change is still on its way: the bars are moving, or the page is
      // being paused and receives it when it is shown again. Only a difference that stays while
      // the page is visible is an error; until then the earlier result stands.
      insetsMismatches = document.hidden ? 0 : insetsMismatches + 1;
      if (insetsMismatches < 8) {
        clearTimeout(insetsTimer);
        insetsTimer = setTimeout(checkInsets, 1000);
        return undefined;
      }
      throw new Error('last push ' + last + ' still differs from insets() ' + now + ' after ' + insetsMismatches + ' s');
    }
    insetsMismatches = 0;
    return 'insets()=' + now + ' pushes=' + pushed + ' (red frame = inset area)';
  });
}

// ───────────────────────── monetisation: purchases and ads ─────────────────────────
// Every StoreEvent the wrapper sends is kept, shown in the "store" panel and logged
// ("DIAG STORE ← …"). The panel's buttons call the MonetizeBridge methods one by one; the same
// actions can be sent from a computer: adb shell am start … --es diagcmd store-query (etc.).

const PRODUCTS = [
  { id: 'coins_small', kind: 'consumable' },
  { id: 'coins_medium', kind: 'consumable' },
  { id: 'coins_large', kind: 'consumable' },
  { id: 'coins_xl', kind: 'consumable' },
  { id: 'coins_mega', kind: 'consumable' },
  { id: 'starter_pack', kind: 'entitlement' },
  { id: 'remove_ads', kind: 'entitlement' },
];

const storeEvents = [];
const storeWaiters = [];
const storeEl = document.getElementById('store');
const storeLogEl = document.getElementById('store-log');
const storeCapsEl = document.getElementById('store-caps');
const productEl = document.getElementById('store-product');
const tabEl = document.getElementById('tab');

function clock() {
  const d = new Date();
  function two(n) { return (n < 10 ? '0' : '') + n; }
  return two(d.getHours()) + ':' + two(d.getMinutes()) + ':' + two(d.getSeconds()) + '.' + ('00' + d.getMilliseconds()).slice(-3);
}

/** Purchase tokens are secrets of a sort: show only their start. */
function maskToken(text) {
  return String(text).replace(/("token":")([^"]{0,6})[^"]*(")/g, '$1$2…$3');
}

function storeLog(kind, text) {
  const shown = maskToken(text);
  say('DIAG STORE ' + kind + ' ' + shown);
  if (!storeLogEl) return;
  const line = document.createElement('div');
  line.className = kind === '←' ? 'event' : 'call';
  line.textContent = clock() + ' ' + kind + ' ' + shown;
  storeLogEl.insertBefore(line, storeLogEl.firstChild); // newest on top
  while (storeLogEl.childNodes.length > 60) storeLogEl.removeChild(storeLogEl.lastChild);
}

function onStoreEvent(json) {
  let event = null;
  try {
    event = JSON.parse(json);
  } catch (_) {
    event = null;
  }
  storeLog('←', typeof json === 'string' ? json : String(json));
  if (!event || typeof event !== 'object') {
    set('store-events', 'FAIL', 'a StoreEvent that is not JSON: ' + String(json).slice(0, 80));
    return;
  }
  storeEvents.push(event);
  // A paid purchase would be granted and saved by the game here; the page only finishes it, so a
  // test purchase does not stay open (Play refunds unfinished test purchases after 3 minutes).
  if (event.type === 'purchase' && event.state === 'purchased' && typeof event.token === 'string' && autoFinish) {
    storeLog('→', 'iapFinish("' + event.token.slice(0, 6) + '…")');
    B.iapFinish(event.token);
  }
  for (const waiter of storeWaiters.slice()) waiter();
}

let autoFinish = true;

/** Resolves with the first event at index >= from that matches. */
function waitStore(from, match, ms, what) {
  return new Promise(function (resolve, reject) {
    function look() {
      for (let i = from; i < storeEvents.length; i++) {
        if (match(storeEvents[i])) {
          done();
          resolve(storeEvents[i]);
          return true;
        }
      }
      return false;
    }
    function done() {
      clearTimeout(timer);
      const at = storeWaiters.indexOf(look);
      if (at >= 0) storeWaiters.splice(at, 1);
    }
    const timer = setTimeout(function () {
      done();
      reject(new Error('no ' + what + ' within ' + ms + ' ms'));
    }, ms);
    storeWaiters.push(look);
    look();
  });
}

function lastStoreEvent(type) {
  for (let i = storeEvents.length - 1; i >= 0; i--) if (storeEvents[i].type === type) return storeEvents[i];
  return null;
}

/** Wait until no StoreEvent has arrived for `ms`. */
async function storeQuiet(ms) {
  let count = -1;
  while (count !== storeEvents.length) {
    count = storeEvents.length;
    await sleep(ms);
  }
}

function showStore(on) {
  if (!storeEl) return;
  storeEl.hidden = !on;
  outEl.hidden = on;
  if (tabEl) tabEl.textContent = on ? '◂ checks' : 'store ▸';
  if (on && storeCapsEl && B && typeof B.storeCaps === 'function') storeCapsEl.textContent = 'storeCaps() = ' + B.storeCaps();
}

const storeActions = {
  show: function () {},
  sync: function () {
    storeLog('→', 'storeSync()');
    B.storeSync();
  },
  query: function () {
    const ids = JSON.stringify(PRODUCTS);
    storeLog('→', 'iapQuery(' + PRODUCTS.length + ' products)');
    B.iapQuery(ids);
  },
  restore: function () {
    storeLog('→', 'iapRestore()');
    B.iapRestore();
  },
  buy: function () {
    const id = productEl && productEl.value ? productEl.value : PRODUCTS[0].id;
    storeLog('→', 'iapBuy("' + id + '")');
    B.iapBuy(id);
  },
  rewarded: function () {
    storeLog('→', 'adShowRewarded("freeCoins")');
    B.adShowRewarded('freeCoins');
  },
  interstitial: function () {
    storeLog('→', 'adShowInterstitial()');
    B.adShowInterstitial();
  },
  privacy: function () {
    storeLog('→', 'adPrivacyOptions()');
    B.adPrivacyOptions();
  },
};

window.__diagStore = function (action) {
  if (action === 'hide') return showStore(false);
  const run = storeActions[action];
  if (!run || !B) return;
  showStore(true);
  try {
    run();
  } catch (err) {
    storeLog('→', action + ' THREW ' + (err && err.message ? err.message : err));
    set('store-call', 'FAIL', action + ' threw into JS: ' + (err && err.message ? err.message : err));
  }
};

if (productEl) {
  for (const p of PRODUCTS) {
    const option = document.createElement('option');
    option.value = p.id;
    option.textContent = p.id + ' (' + p.kind + ')';
    productEl.appendChild(option);
  }
}
if (storeEl) {
  storeEl.addEventListener('click', function (e) {
    const action = e.target && e.target.getAttribute ? e.target.getAttribute('data-act') : null;
    if (action) window.__diagStore(action);
  });
}
if (tabEl) {
  tabEl.addEventListener('click', function () {
    showStore(storeEl.hidden);
  });
}
// A hardware key works in every build (adb shell input keyevent KEYCODE_S): S toggles the store panel.
document.addEventListener('keydown', function (e) {
  if ((e.key === 's' || e.key === 'S') && storeEl) showStore(storeEl.hidden);
});

// ───────────────────────── the checks ─────────────────────────

async function run() {
  set('module', 'PASS', 'ES module executed after ' + Math.round(t0) + ' ms; UA ' + ((/Chrome\/[\d.]+/.exec(navigator.userAgent) || ['?'])[0]));

  await check('bridge', function () {
    assert(B && typeof B === 'object', 'window.AndroidBridge is missing');
    const names = ['loadSave', 'storeSave', 'haptic', 'setAtRoot', 'info', 'rate', 'ready', 'insets', 'storeCaps', 'storeSync', 'iapQuery', 'iapBuy', 'iapFinish', 'iapRestore', 'adShowRewarded', 'adShowInterstitial', 'adPrivacyOptions'];
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

  await check('net-image', async function () {
    const nonce = 'diag-img-' + Date.now();
    await withTimeout(new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () { reject(new Error('an external image LOADED')); };
      img.onerror = function () { resolve(); };
      img.src = 'https://example.com/favicon.ico?' + nonce;
    }), 8000, 'external image');
    // Debug builds can ask the wrapper: the request must have been answered by its filter, not by a server.
    const byFilter = D && typeof D.blockedCount === 'function' ? D.blockedCount(nonce) : -1;
    assert(byFilter !== 0, 'the image failed, but not because the request filter refused it');
    return 'external https image refused' + (byFilter > 0 ? ' by the request filter (403 ×' + byFilter + ')' : '');
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

  await check('net-iframe', async function () {
    // A frame pointing at another origin must stay empty: the page policy (frame-src) refuses it
    // before any request is made, and the wrapper's request filter would answer 403 if it got through.
    const nonce = 'diag-frame-' + Date.now();
    const url = 'https://example.com/?' + nonce;
    const before = cspViolations.length;
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:absolute;left:-9999px;width:10px;height:10px;border:0';
    const settled = new Promise(function (resolve) {
      frame.onload = function () { resolve('load'); };
      frame.onerror = function () { resolve('error'); };
      setTimeout(function () { resolve('timeout'); }, 4000);
    });
    frame.src = url;
    document.body.appendChild(frame);
    const how = await settled;
    await sleep(300);
    const byPolicy = cspViolations.slice(before).some(function (v) { return v.indexOf('frame-src') === 0 && v.indexOf('example.com') > 0; });
    const byFilter = D && typeof D.blockedCount === 'function' ? D.blockedCount(nonce) : 0;
    let readable = false;
    try {
      // A refused frame holds an empty error document; the real page would be cross-origin either way.
      readable = !!(frame.contentDocument && frame.contentDocument.body && frame.contentDocument.body.childNodes.length > 0);
    } catch (_) {
      readable = false;
    }
    document.body.removeChild(frame);
    assert(byPolicy || byFilter > 0, 'an external https iframe was neither refused by the page policy nor by the request filter (' + how + ')');
    assert(!readable, 'the external frame has content');
    return 'external https iframe refused' + (byPolicy ? ' by the page policy (frame-src)' : '') + (byFilter > 0 ? ' by the request filter (403 ×' + byFilter + ')' : '');
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

  await check('save-flush', function () {
    // Before a purchase is consumed or acknowledged the wrapper forces the save onto disk.
    if (!D || typeof D.flushSave !== 'function') {
      set('save-flush', 'INFO', 'no DiagBridge in this build');
      return undefined;
    }
    const start = performance.now();
    const first = D.flushSave();
    const second = D.flushSave();
    assert(first === true && second === true, 'the save could not be forced onto disk (' + first + ', ' + second + ')');
    assert(B.loadSave() === window.__diagSave.text, 'the save changed while it was flushed');
    return 'save forced onto disk twice in ' + Math.round(performance.now() - start) + ' ms (what iapFinish does first)';
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
      function () { B.iapQuery('not json'); },
      function () { B.iapQuery('[{"id":"../x","kind":"consumable"},{"id":"ok_id","kind":"weird"},7,null,{"kind":"consumable"}]'); },
      function () { B.iapQuery('{"id":"coins_small"}'); },
      function () { B.iapFinish(new Array(5000).join('t')); },
      function () { B.iapFinish(''); },
      function () { B.adShowRewarded(new Array(100).join('p')); },
      function () { B.iapBuy(42); },
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
    // Purchases and ads, end to end through the bridge. Where Google Play billing is not available
    // (an emulator without the Play Store) and no ad is ready, every request must still be answered:
    // an empty product list, purchase → unavailable/error, adResult → failed. Where products ARE on
    // sale or an ad IS ready, the buying and showing is left to the buttons of the store panel.
    const capsRaw = B.storeCaps();
    const caps = JSON.parse(capsRaw);
    assert(caps.billing === true, 'storeCaps(): billing is not true: ' + capsRaw);
    assert(typeof caps.ads === 'boolean', 'storeCaps(): ads is not a boolean: ' + capsRaw);
    if (storeCapsEl) storeCapsEl.textContent = 'storeCaps() = ' + capsRaw;
    await storeQuiet(1200);

    let from = storeEvents.length;
    storeActions.sync();
    const ads = await waitStore(from, function (e) { return e.type === 'ads'; }, 20000, "'ads' event after storeSync()");
    for (const key of ['canRequestAds', 'rewardedReady', 'interstitialReady', 'privacyOptionsRequired']) {
      assert(typeof ads[key] === 'boolean', "'ads' event: " + key + ' is not a boolean');
    }
    if (!caps.ads) assert(!ads.canRequestAds && !ads.rewardedReady && !ads.interstitialReady && !ads.privacyOptionsRequired, "a build without ads sent a positive 'ads' event");

    from = storeEvents.length;
    storeActions.query();
    const products = await waitStore(from, function (e) { return e.type === 'products'; }, 60000, "'products' event");
    assert(Array.isArray(products.products), "'products' event without a list");
    for (const item of products.products) {
      assert(PRODUCTS.some(function (p) { return p.id === item.id; }), 'unknown product in the answer: ' + item.id);
      assert(typeof item.price === 'string' && item.price.length > 0, 'product without a price text: ' + item.id);
    }

    from = storeEvents.length;
    storeActions.restore();
    const owned = await waitStore(from, function (e) { return e.type === 'owned'; }, 60000, "'owned' event");
    assert(Array.isArray(owned.ids), "'owned' event without a list");

    let bought = 'not tried (products are on sale: use the store panel)';
    if (products.products.length === 0) {
      from = storeEvents.length;
      storeActions.buy();
      const purchase = await waitStore(from, function (e) { return e.type === 'purchase' && e.id === PRODUCTS[0].id; }, 60000, "'purchase' event");
      assert(purchase.state === 'unavailable' || purchase.state === 'error', 'a purchase without billing ended as "' + purchase.state + '"');
      assert(purchase.token === undefined, 'a failed purchase carries a token');
      bought = purchase.state;
    }

    const adsNow = lastStoreEvent('ads') || ads;
    let rewarded = 'not tried (an ad is ready: use the store panel)';
    if (!adsNow.rewardedReady) {
      from = storeEvents.length;
      storeActions.rewarded();
      const result = await waitStore(from, function (e) { return e.type === 'adResult' && e.format === 'rewarded'; }, 30000, "rewarded 'adResult' event");
      assert(result.result === 'failed', 'a rewarded ad that was not ready ended as "' + result.result + '"');
      rewarded = result.result;
    }
    let interstitial = 'not tried (an ad is ready: use the store panel)';
    if (!adsNow.interstitialReady) {
      from = storeEvents.length;
      storeActions.interstitial();
      const result = await waitStore(from, function (e) { return e.type === 'adResult' && e.format === 'interstitial'; }, 30000, "interstitial 'adResult' event");
      assert(result.result === 'failed', 'an interstitial that was not ready ended as "' + result.result + '"');
      interstitial = result.result;
    }
    let privacy = 'not tried (a privacy form is required here: use the store panel)';
    if (!adsNow.privacyOptionsRequired) {
      from = storeEvents.length;
      storeActions.privacy();
      await waitStore(from, function (e) { return e.type === 'ads'; }, 60000, "'ads' event after adPrivacyOptions()");
      privacy = "'ads' event";
    }
    B.iapFinish('diag-no-such-token'); // unknown to the store: must be ignored quietly
    await sleep(300);

    return 'caps ' + capsRaw + '; products ' + products.products.length +
      (products.products.length ? ' with prices' : ' (billing not available here)') +
      '; owned [' + owned.ids.join(',') + ']' + (owned.complete ? ' complete' : '') +
      '; iapBuy → ' + bought + '; rewarded → ' + rewarded + '; interstitial → ' + interstitial + '; privacy → ' + privacy +
      '; ads ' + JSON.stringify({ can: adsNow.canRequestAds, rew: adsNow.rewardedReady, int: adsNow.interstitialReady, priv: adsNow.privacyOptionsRequired });
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
