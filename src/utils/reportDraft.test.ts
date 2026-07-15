import { describe, expect, it } from 'vitest';
import { reportDraftKey } from './reportDraft';

describe('reportDraftKey', () => {
  it('isolates saved AI reports by report type, scope, and language', () => {
    expect(reportDraftKey('daily', '2026-07-15', 'zh-CN')).toBe('devtracker-daily-2026-07-15-zh-CN');
    expect(reportDraftKey('daily', '2026-07-15', 'en-US')).not.toBe(reportDraftKey('daily', '2026-07-15', 'zh-CN'));
    expect(reportDraftKey('weekly', '2026-W29', 'zh-CN')).toBe('devtracker-weekly-2026-W29-zh-CN');
    expect(reportDraftKey('monthly', '7', 'en-US')).toBe('devtracker-monthly-7-en-US');
  });
});
