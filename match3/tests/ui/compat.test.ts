/**
 * Static audit of the shell's own sources against the runtime floor (docs/DESIGN.md §1: Chrome /
 * Android WebView 80): CSS features and JS APIs that arrived later must not be used, nothing may
 * talk to the network, and offsets that depend on the reading direction must be mirrored.
 * (src/ui/kit has its own, stricter audit: `node tools/kit-shots.cjs check`. The production
 * bundle as a whole is checked by tests/e2e/meta.cjs --prod.)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel: string): string => readFileSync(join(root, rel), 'utf8');

function tsFiles(dir: string, skip: (rel: string) => boolean): string[] {
  const out: string[] = [];
  const walk = (rel: string): void => {
    for (const name of readdirSync(join(root, rel))) {
      const child = rel + '/' + name;
      if (skip(child)) continue;
      if (statSync(join(root, child)).isDirectory()) walk(child);
      else if (/\.ts$/.test(name)) out.push(child);
    }
  };
  walk(dir);
  return out;
}

/** CSS with comments removed. */
function stripCss(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ');
}

/** TypeScript with comments removed (string contents stay: an API name in a string is harmless). */
function stripTs(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

interface Rule {
  selector: string;
  body: string;
}

/** Flat list of style rules (at-rule wrappers are stepped into; keyframe steps are rules too). */
function cssRules(css: string): Rule[] {
  const out: Rule[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) out.push({ selector: m[1]!.trim(), body: m[2]! });
  return out;
}

const CSS_TOO_NEW: [string, RegExp][] = [
  ['aspect-ratio (Chrome 88)', /(^|[;{\s])aspect-ratio\s*:/],
  ['inset shorthand (Chrome 87)', /(^|[;{\s])inset(-inline|-block)?(-start|-end)?\s*:/],
  [':is() / :where() (Chrome 88) / :has() (Chrome 105)', /:(is|where|has)\(/],
  ['container queries', /@container\b/],
  ['color-mix()', /color-mix\(/],
  ['dynamic viewport units', /\d(dvh|svh|lvh|dvw|svw|lvw)\b/],
  [':focus-visible (Chrome 86)', /:focus-visible/],
  ['margin-inline / padding-inline / *-block shorthands (Chrome 87)', /(^|[;{\s])(margin|padding)-(inline|block)\s*:/],
  ['@layer', /@layer\b/],
  ['individual transform properties (Chrome 104)', /(^|[;{\s])(translate|scale|rotate)\s*:/],
  ['overflow: clip (Chrome 90)', /overflow(-[xy])?\s*:\s*clip/],
  ['@property', /@property\b/],
  ['range syntax in media queries', /@media[^{]*[<>]/],
  ['accent-color', /accent-color\s*:/],
  ['nesting', /(^|[;{}\s])&/],
  ['env() outside the kit (use var(--safe-*))', /env\(/],
  ['remote url()', /url\(\s*["']?(https?:)?\/\//],
];

const JS_TOO_NEW: [string, RegExp][] = [
  ['Array / String .at() (Chrome 92)', /\.at\(/],
  ['String.replaceAll (Chrome 85)', /\.replaceAll\(/],
  ['structuredClone', /\bstructuredClone\b/],
  ['Object.hasOwn (Chrome 93)', /Object\.hasOwn\b/],
  ['Promise.any / withResolvers', /Promise\.(any|withResolvers)\b/],
  ['findLast / findLastIndex', /\.findLast(Index)?\(/],
  ['toSorted / toReversed / toSpliced', /\.to(Sorted|Reversed|Spliced)\(/],
  ['WeakRef / FinalizationRegistry', /\b(WeakRef|FinalizationRegistry)\b/],
  ['replaceChildren (Chrome 86)', /\.replaceChildren\(/],
  ['Web Animations beyond Chrome 80', /\.(animate|getAnimations)\(/],
  ['the inert property', /\.inert\s*=/],
  ['crypto.randomUUID', /randomUUID\(/],
  ['AbortSignal.timeout / any', /AbortSignal\.(timeout|any)\b/],
  ['top-level await', /^\s*(export\s+)?(const|let|var)\s+[\w{},\s]+=\s*await\b|^await\b/m],
  ['network access', /\b(fetch\(|XMLHttpRequest|new\s+WebSocket\(|navigator\.sendBeacon|new\s+EventSource)/],
  ['eval', /\beval\(|new\s+Function\(/],
  ['CSS forbidden in inline styles (gap / inset / aspect-ratio)', /\b(gap|rowGap|columnGap|inset|insetInline|insetBlock|aspectRatio)\s*:\s*['"`]/],
  ['erasable syntax only: no enum / namespace', /^\s*(export\s+)?(declare\s+)?(const\s+)?(enum|namespace)\s+\w/m],
  ['a relative import without the .ts extension', /from\s+'\.{1,2}\/[^']*(?<!\.ts|\.css|\?raw)'/],
];

describe('src/ui/meta.css against the Chrome 80 floor', () => {
  const css = stripCss(read('src/ui/meta.css'));
  const rules = cssRules(css);

  it('is parsed (the audit sees the rules)', () => {
    expect(rules.length).toBeGreaterThan(250);
  });

  it('uses nothing newer than Chrome 80', () => {
    const found: string[] = [];
    for (const [what, re] of CSS_TOO_NEW) {
      const m = re.exec(css);
      if (m) found.push(what + '  →  …' + css.slice(Math.max(0, m.index - 30), m.index + 40).replace(/\s+/g, ' ') + '…');
    }
    expect(found).toEqual([]);
  });

  it('has no `gap` on flex containers (Chrome 84) — only on grids', () => {
    const grids = new Set(rules.filter((r) => /display\s*:\s*(inline-)?grid/.test(r.body)).map((r) => r.selector));
    const bad = rules.filter((r) => /(^|;)\s*(gap|row-gap|column-gap|grid-gap)\s*:/.test(r.body) && !grids.has(r.selector)).map((r) => r.selector);
    expect(bad).toEqual([]);
  });

  it('animates transform and opacity only', () => {
    const bad: string[] = [];
    const re = /@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = re.exec(css))) {
      count++;
      for (const step of cssRules(m[2]!)) {
        for (const decl of step.body.split(';')) {
          const prop = decl.split(':')[0]!.trim();
          if (prop && prop !== 'transform' && prop !== 'opacity') bad.push(m[1] + ': ' + prop);
        }
      }
    }
    expect(count).toBeGreaterThan(8);
    expect(bad).toEqual([]);
  });

  it('mirrors every left / right offset that follows the reading direction', () => {
    // A rule that pins something to the left or right edge with a non-zero offset needs either a
    // [dir] counterpart for the same class, or to be direction-free by design (centred with a
    // negative margin, a full-width layer, an element that is forced to LTR).
    const free = new Set([
      // centred on their anchor: left 50% + negative margin
      '.m-trail',
      '.m-node__stars',
      '.m-banner',
      '.m-cap',
      // symmetric pairs / decorative, identical in both directions
      '.m-banner__orn--a',
      '.m-banner__orn--b',
      '.m-node__halo',
      '.m-marker__bob',
      '.m-burst i',
      // counts on icons that are themselves direction-free (LTR numbers on a reward picture)
      '.m-reward__n',
      '.m-unlock__qty',
    ]);
    const mirrored = new Set<string>();
    for (const r of rules) {
      for (const sel of r.selector.split(',')) {
        const m = /\[dir='(rtl|ltr)'\]\s+(.+)/.exec(sel.trim());
        if (m) mirrored.add(m[2]!.trim());
      }
    }
    const bad: string[] = [];
    for (const r of rules) {
      if (/\[dir=/.test(r.selector) || /^(from|to|\d+%)/.test(r.selector)) continue;
      const m = /(^|;)\s*(left|right)\s*:\s*([^;]+)/.exec(r.body);
      if (!m) continue;
      const value = m[3]!.trim();
      if (value === '0' || value === '50%' || value === 'auto') continue;
      for (const sel of r.selector.split(',').map((x) => x.trim())) {
        if (!mirrored.has(sel) && !free.has(sel)) bad.push(sel + ' { ' + m[2] + ': ' + value + ' }');
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('the shell sources (src/ui outside the kit, src/main.ts, src/app) against the Chrome 80 floor', () => {
  const files = tsFiles('src/ui', (rel) => rel === 'src/ui/kit').concat(['src/main.ts', 'src/app/types.ts', 'src/app/brand.ts']);

  it('finds the sources', () => {
    expect(files.length).toBeGreaterThan(15);
    expect(files).toContain('src/ui/index.ts');
    expect(files).toContain('src/ui/dialogs/shop.ts');
  });

  it('uses no API newer than Chrome 80, no network, no eval', () => {
    const found: string[] = [];
    for (const file of files) {
      const code = stripTs(read(file));
      for (const [what, re] of JS_TOO_NEW) {
        const m = re.exec(code);
        if (m) found.push(file + ': ' + what + '  →  ' + m[0].trim().slice(0, 60));
      }
    }
    expect(found).toEqual([]);
  });

  it('the audit catches what it is there for', () => {
    const probeCss = '.a{display:flex;inset:0;aspect-ratio:1;margin-inline:2px;translate:1px;height:100dvh;color:color-mix(in srgb,red,blue);overflow:clip}.b:is(.c),.g:focus-visible{top:0}@layer x{.h{top:0}}';
    expect(CSS_TOO_NEW.filter(([, re]) => re.test(probeCss)).length).toBeGreaterThanOrEqual(10);
    const probeJs = "const a = [1].at(-1); el.replaceChildren(); x.replaceAll('a','b'); structuredClone(y); fetch('/x'); Object.hasOwn(a, 'b'); import { z } from './z';";
    expect(JS_TOO_NEW.filter(([, re]) => re.test(probeJs)).length).toBeGreaterThanOrEqual(7);
  });
});

describe('index.html', () => {
  const html = read('index.html');

  it('its inline styles stay within the Chrome 80 floor too', () => {
    const style = stripCss((/<style>([\s\S]*?)<\/style>/.exec(html) || ['', ''])[1]!);
    expect(style.length).toBeGreaterThan(100);
    const found = CSS_TOO_NEW.filter(([what, re]) => what.indexOf('env()') < 0 && re.test(style)).map(([what]) => what);
    expect(found).toEqual([]);
  });

  it('loads nothing from another origin', () => {
    expect(/(src|href)=["']https?:/.test(html)).toBe(false);
  });
});
