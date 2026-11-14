import { describe, expect, it } from 'vitest';
import { COLOR_COUNT } from '../src/engine/types.ts';

describe('toolchain', () => {
  it('runs TypeScript sources', () => {
    expect(COLOR_COUNT).toBe(6);
  });
});
