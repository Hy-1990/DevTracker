import { describe, expect, it } from 'vitest';
import { getDefaultColumns } from './useColumns';

describe('locale-aware table columns', () => {
  it('uses translated labels and wider English date columns', () => {
    const zh = getDefaultColumns('zh-CN');
    const en = getDefaultColumns('en-US');
    expect(zh.find((column) => column.key === 'name')?.label).toBe('任务描述');
    expect(en.find((column) => column.key === 'name')?.label).toBe('Task Description');
    expect(en.find((column) => column.key === 'estimated_release_date')!.minWidth)
      .toBeGreaterThan(zh.find((column) => column.key === 'estimated_release_date')!.minWidth);
  });
});
