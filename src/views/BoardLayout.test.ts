import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('BoardLayout language access', () => {
  it('keeps a visible language switch in the primary sidebar', () => {
    const source = readFileSync(new URL('./BoardLayout.vue', import.meta.url), 'utf8');

    expect(source).toContain('class="language-switch"');
    expect(source).toContain('@click="toggleLocale"');
  });
});
