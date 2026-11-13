// PLACEHOLDER — replaced by the play-screen module.
import type { AppContext, PlayScreen } from '../app/types.ts';

export function createPlayScreen(ctx: AppContext): PlayScreen {
  const el = document.createElement('div');
  el.textContent = 'play screen placeholder';
  return {
    el,
    start(level) {
      el.textContent = `play screen placeholder — level ${level.id}`;
    },
    stop() {},
    handleBack() {
      ctx.nav.toMap();
      return true;
    },
    setPaused() {},
  };
}
