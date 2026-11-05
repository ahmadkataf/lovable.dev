import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * After the bundle is written, inject the list of files to precache into
 * public/sw.js (copied to dist/sw.js). The service worker source keeps the
 * placeholders `__PRECACHE__` and `__BUILD__` so it also works unprocessed.
 */
function swPrecache(): Plugin {
  let outDir = 'dist';
  return {
    name: 'madar-sw-precache',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const swPath = join(outDir, 'sw.js');
      if (!existsSync(swPath)) return;
      const walk = (dir: string, prefix: string): string[] =>
        readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
          entry.isDirectory()
            ? walk(join(dir, entry.name), `${prefix}${entry.name}/`)
            : [`${prefix}${entry.name}`],
        );
      const files = walk(outDir, '/').filter(
        (f) => f !== '/sw.js' && f !== '/index.html' && !f.endsWith('.map'),
      );
      const precache = ['/', ...files.sort()];
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
  plugins: [react(), swPrecache()],
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
