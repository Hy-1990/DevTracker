import { describe, expect, it } from 'vitest';
import { TASK_PRIORITIES, TASK_STATUSES, TASK_TYPES } from '@/types';
import {
  translateDelayReason,
  translatePriority,
  translateRole,
  translateStatus,
  translateTaskType,
} from './domain';

describe('persisted domain translations', () => {
  it('translates every persisted task enum without changing its value', () => {
    expect(TASK_STATUSES.map((value) => translateStatus(value, 'en-US'))).toEqual([
      'Stalled', 'Not Started', 'In Progress', 'Ready to Release', 'Completed',
    ]);
    expect(TASK_PRIORITIES.map((value) => translatePriority(value, 'en-US'))).toEqual([
      'Urgent', 'Important', 'Routine', 'Low Priority',
    ]);
    expect(TASK_TYPES.map((value) => translateTaskType(value, 'en-US'))).toEqual([
      'Product Request', 'Enhancement', 'Infrastructure', 'Bug Fix', 'Maintenance', 'Executive Request',
    ]);
  });

  it('returns Chinese source labels in Chinese', () => {
    expect(translateStatus('进行中', 'zh-CN')).toBe('进行中');
    expect(translatePriority('紧急', 'zh-CN')).toBe('紧急');
    expect(translateTaskType('产品需求', 'zh-CN')).toBe('产品需求');
  });

  it('translates roles and delay reasons and preserves unknown values', () => {
    expect(translateRole('dev', 'en-US')).toBe('Developer');
    expect(translateDelayReason('未提测', 'en-US')).toBe('Not Tested');
    expect(translateStatus('future-status' as never, 'en-US')).toBe('future-status');
  });
});
