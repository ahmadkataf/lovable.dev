/**
 * ONE command that makes every picture of the Google Play kit again from the game as it is now,
 * and checks the result:
 *
 *   node tools/store/make-visuals.cjs
 *
 * It runs, one after the other (and stops at the first one that fails):
 *   1. node tools/store/make-screenshots.cjs     captures of the real game + the upload files + manifest
 *   2. node tools/store/make-graphics.cjs        feature graphics (English, Arabic); checks the icon
 *   3. node tools/store/check-kit.cjs graphics screenshots     the mechanical checks
 *
 * Arguments are passed on to step 1 (e.g. `--layout` to lay the upload files out again without
 * capturing, after a caption change). About 15 minutes on a quiet machine; needs port 5189 (STORE_PORT).
 * Afterwards LOOK at store/screenshots/contact-en.png and contact-ar.png.
 */
const path = require('path');
const { spawnSync } = require('child_process');

const here = __dirname;
const steps = [
  ['make-screenshots.cjs', process.argv.slice(2)],
  ['make-graphics.cjs', []],
  ['check-kit.cjs', ['graphics', 'screenshots']],
];

for (const [script, args] of steps) {
  console.log('\n── node tools/store/' + script + (args.length ? ' ' + args.join(' ') : '') + ' ──');
  const run = spawnSync(process.execPath, [path.join(here, script), ...args], { stdio: 'inherit', cwd: path.join(here, '..', '..') });
  if (run.status !== 0) {
    console.error('\nmake-visuals: tools/store/' + script + ' failed (exit code ' + run.status + ') — nothing after it was run.');
    process.exit(run.status || 1);
  }
}
console.log('\nmake-visuals: done. Look at store/screenshots/contact-en.png and contact-ar.png before uploading.');
