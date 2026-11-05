import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Build-time shell work:
 * 1. Inline the app stylesheet into index.html. The splash in #root then paints as soon as the HTML arrives
 *    instead of waiting for a render-blocking CSS request (≈ one extra round trip plus the transfer on slow
 *    connections). The CSS asset is dropped from the bundle afterwards.
 * 2. After the bundle is written, inject the list of files to precache into public/sw.js (copied to
 *    dist/sw.js): the shell first, then the fonts, then the hashed assets. The service worker source keeps the
 *    placeholders `__PRECACHE__` and `__BUILD__` so it also works unprocessed.
 */
function shellPlugin(): Plugin {
  let outDir = 'dist';
  let base = '/';
  const inlined = new Set<string>();
  return {
    name: 'madar-shell',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      outDir = config.build.outDir;
      base = config.base;
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const bundle = ctx.bundle;
        if (!bundle) return html;
        return html.replace(/<link rel="stylesheet"[^>]*href="([^"]+\.css)"[^>]*>/g, (tag, href: string) => {
          const name = href.startsWith(base) ? href.slice(base.length) : href.replace(/^\//, '');
          const asset = bundle[name];
          if (!asset || asset.type !== 'asset') return tag;
          const css = typeof asset.source === 'string' ? asset.source : Buffer.from(asset.source).toString('utf8');
          inlined.add(name);
          return `<style>${css}</style>`;
        });
      },
    },
    generateBundle(_opts, bundle) {
      for (const name of inlined) delete bundle[name];
    },
    closeBundle() {
      for (const name of inlined) {
        const p = join(outDir, name);
        if (existsSync(p)) rmSync(p);
      }
      const swPath = join(outDir, 'sw.js');
      if (!existsSync(swPath)) return;
      const walk = (dir: string, prefix: string): string[] =>
        readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
          entry.isDirectory()
            ? walk(join(dir, entry.name), `${prefix}${entry.name}/`)
            : [`${prefix}${entry.name}`],
        );
      const files = walk(outDir, '/').filter(
        (f) => f !== '/sw.js' && f !== '/index.html' && !f.endsWith('.map') && !f.endsWith('.gz') && !f.endsWith('.br'),
      );
      const rank = (f: string) => (f.startsWith('/fonts/') ? 1 : f.startsWith('/assets/') ? 2 : 3);
      const precache = ['/', ...files.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))];
      const build = Date.now().toString(36);
      const src = readFileSync(swPath, 'utf8')
        .replace('__PRECACHE__', JSON.stringify(precache))
        .replace('__BUILD__', build);
      writeFileSync(swPath, src);
    },
  };
}

export default defineConfig({
  base: '/',
  plugins: [react(), shellPlugin()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
  },
});
