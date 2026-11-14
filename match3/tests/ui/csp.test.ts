/**
 * index.html carries a Content-Security-Policy whose script-src allows exactly one inline script:
 * the compatibility guard, by its SHA-256. This test fails when the script is edited without
 * updating the hash (the guard would then be blocked silently), and pins the rest of the policy.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const html = readFileSync(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf8');

function policy(): Record<string, string[]> {
  const meta = /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(html);
  if (!meta) throw new Error('no CSP meta tag');
  const out: Record<string, string[]> = {};
  for (const part of meta[1]!.split(';')) {
    const words = part.trim().split(/\s+/);
    if (words[0]) out[words[0]] = words.slice(1);
  }
  return out;
}

describe('index.html', () => {
  it('has exactly one inline script (the guard) and one module script', () => {
    const inline = html.match(/<script>[\s\S]*?<\/script>/g) || [];
    expect(inline.length).toBe(1);
    expect((html.match(/<script type="module" src="\/src\/main\.ts"><\/script>/g) || []).length).toBe(1);
    expect((html.match(/<script/g) || []).length).toBe(2);
  });

  it("allows the guard by its hash, and the hash matches the script's text", () => {
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)![1]!;
    const hash = createHash('sha256').update(script, 'utf8').digest('base64');
    expect(policy()['script-src']).toEqual(["'self'", "'sha256-" + hash + "'"]);
  });

  it('the guard is plain ES5 (it must run where the game cannot)', () => {
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)![1]!;
    expect(/=>|\bconst\b|\blet\b|`|\?\.|\?\?|\.\.\./.test(script)).toBe(false);
    expect(script).toContain('window.__bootFail');
    expect(script).toContain('__bootStarted');
  });

  it('keeps the policy strict: own origin only, no eval, loopback-only connections', () => {
    const p = policy();
    expect(p['default-src']).toEqual(["'self'"]);
    expect(p['img-src']).toEqual(["'self'", 'data:', 'blob:']);
    expect(p['style-src']).toEqual(["'self'", "'unsafe-inline'"]);
    expect(p['font-src']).toEqual(["'self'", 'data:']);
    expect(p['connect-src']).toEqual(['ws://127.0.0.1:*', 'http://127.0.0.1:*']);
    expect(p['object-src']).toEqual(["'none'"]);
    expect(p['base-uri']).toEqual(["'none'"]);
    expect(p['form-action']).toEqual(["'none'"]);
    const all = Object.keys(p)
      .map((k) => p[k]!.join(' '))
      .join(' ');
    expect(all).not.toContain('unsafe-eval');
    expect(all).not.toContain('https:');
    expect(all).not.toContain('*.');
  });

  it('comes before anything that loads', () => {
    expect(html.indexOf('Content-Security-Policy')).toBeLessThan(html.indexOf('<style>'));
    expect(html.indexOf('Content-Security-Policy')).toBeLessThan(html.indexOf('<script'));
  });

  it('shows the update message in both languages', () => {
    expect(html).toContain('Android System WebView');
    expect(html).toContain("'rtl', 'ar'");
  });
});
