/**
 * Does the listing icon show the same emblem as another rendering of it (the Android launcher icon,
 * or the emblem the game draws today)? Used by make-graphics.cjs and check-kit.cjs.
 *
 * The renderings differ in size, in how far the emblem is zoomed and in what lies around it, so they
 * are compared where they must agree: the emerald and the body of the gold star around it. In each
 * image the emerald is found by its colour, the square around it (twice the jewel's width — the
 * star's tips reach its edge) is scaled to 64×64, and the two are compared inside the circle that
 * the star's body fills.
 *
 *   emblemDifference(a, b)  → mean absolute difference per colour channel, 0..255 (null when no
 *                             emerald is found in one of them). a, b: decoded images
 *                             ({ width, height, channels, data }).
 *   ICON_MATCH_LIMIT        the difference up to which two renderings count as the same emblem
 *                             (see the numbers printed by the tools: the same art measures a
 *                             few units, a recoloured or different emblem several times the limit).
 */
const { resizeImage } = require('./lib.cjs');

const ICON_MATCH_LIMIT = 10;
const NIGHT = [0x14, 0x12, 0x3a];

/** Centre and width of the emerald: the box of the strongly green pixels (2nd..98th percentile). */
function jewelBox(img) {
  const xs = [];
  const ys = [];
  const ch = img.channels;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * ch;
      if (ch === 4 && img.data[i + 3] < 250) continue;
      const r = img.data[i];
      const g = img.data[i + 1];
      const b = img.data[i + 2];
      if (g > 120 && g - r > 45 && g - b > 12) {
        xs.push(x);
        ys.push(y);
      }
    }
  }
  if (xs.length < 0.01 * img.width * img.height) return null;
  xs.sort((a, b) => a - b);
  ys.sort((a, b) => a - b);
  const lo = Math.floor(xs.length * 0.02);
  const hi = Math.ceil(xs.length * 0.98) - 1;
  const w = xs[hi] - xs[lo] + 1;
  const h = ys[hi] - ys[lo] + 1;
  return { cx: (xs[lo] + xs[hi] + 1) / 2, cy: (ys[lo] + ys[hi] + 1) / 2, size: Math.max(w, h) };
}

/** The square of side 2 × jewel width around the jewel, on the night colour, scaled to n×n RGB. */
function jewelWindow(img, box, n) {
  const side = Math.round(box.size * 2);
  const x0 = Math.round(box.cx - side / 2);
  const y0 = Math.round(box.cy - side / 2);
  const ch = img.channels;
  const data = Buffer.alloc(side * side * 3);
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const sx = x0 + x;
      const sy = y0 + y;
      const o = (y * side + x) * 3;
      if (sx < 0 || sy < 0 || sx >= img.width || sy >= img.height) {
        data[o] = NIGHT[0];
        data[o + 1] = NIGHT[1];
        data[o + 2] = NIGHT[2];
        continue;
      }
      const i = (sy * img.width + sx) * ch;
      const a = ch === 4 ? img.data[i + 3] / 255 : 1;
      data[o] = Math.round(img.data[i] * a + NIGHT[0] * (1 - a));
      data[o + 1] = Math.round(img.data[i + 1] * a + NIGHT[1] * (1 - a));
      data[o + 2] = Math.round(img.data[i + 2] * a + NIGHT[2] * (1 - a));
    }
  }
  return resizeImage({ width: side, height: side, channels: 3, data }, n, n);
}

function emblemDifference(a, b) {
  const boxA = jewelBox(a);
  const boxB = jewelBox(b);
  if (!boxA || !boxB) return null;
  const n = 48;
  const wa = jewelWindow(a, boxA, n);
  // inside the star's body: radius 0.6 × jewel width = 0.3 × window side
  const radius = n * 0.3;
  // the jewel's box is found to about a pixel: try slightly larger and smaller windows and small
  // shifts, and keep the best fit
  let best = null;
  for (let zoom = 0.92; zoom <= 1.081; zoom += 0.02) {
    const wb = jewelWindow(b, { cx: boxB.cx, cy: boxB.cy, size: boxB.size * zoom }, n);
    for (let sy = -2; sy <= 2; sy++) {
      for (let sx = -2; sx <= 2; sx++) {
        let sum = 0;
        let count = 0;
        for (let y = 0; y < n; y++) {
          for (let x = 0; x < n; x++) {
            const dx = x + 0.5 - n / 2;
            const dy = y + 0.5 - n / 2;
            if (dx * dx + dy * dy > radius * radius) continue;
            const i = (y * n + x) * 3;
            const j = ((y + sy) * n + (x + sx)) * 3;
            sum += Math.abs(wa.data[i] - wb.data[j]) + Math.abs(wa.data[i + 1] - wb.data[j + 1]) + Math.abs(wa.data[i + 2] - wb.data[j + 2]);
            count += 3;
          }
        }
        const v = sum / count;
        if (best === null || v < best) best = v;
      }
    }
  }
  return best;
}

module.exports = { emblemDifference, jewelBox, ICON_MATCH_LIMIT };
