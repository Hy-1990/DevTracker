import { describe, expect, it } from 'vitest';
import source from './BoardLayout.vue?raw';

describe('BoardLayout language access', () => {
  it('keeps a visible language switch in the primary sidebar', () => {
    expect(source).toContain('class="language-switch"');
    expect(source).toContain('@click="toggleLocale"');
  });
});
