import type { TaskWithRelations } from '@/types';

export type DelayReason = '未提测' | '提测延迟' | '延迟完成';

export interface DelayInfo {
  task: TaskWithRelations;
  delayDays: number;
  reason: DelayReason;
}

function daysBetween(from: string, to: string): number {
  return Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000);
}

/**
 * 延期任务计算（含子任务需调用方先展平）：
 * - 进行中 + 预估提测已过且未提测 → 未提测
 * - 进行中/已完成 + 实际提测晚于预估提测 → 提测延迟
 * - 已完成 + 完成日期晚于评估上线日期 → 延迟完成
 * today 可注入，便于测试。
 */
export function computeDelays(
  tasks: TaskWithRelations[],
  today: string = new Date().toISOString().slice(0, 10)
): DelayInfo[] {
  const result: DelayInfo[] = [];
  for (const t of tasks) {
    if (t.status === '进行中' && t.estimated_test_date && t.estimated_test_date < today && !t.actual_test_date) {
      result.push({ task: t, delayDays: daysBetween(t.estimated_test_date, today), reason: '未提测' });
    } else if (t.status === '进行中' && t.actual_test_date && t.estimated_test_date && t.actual_test_date > t.estimated_test_date) {
      result.push({ task: t, delayDays: daysBetween(t.estimated_test_date, t.actual_test_date), reason: '提测延迟' });
    } else if (t.status === '已完成' && t.completion_date && t.estimated_release_date && t.completion_date > t.estimated_release_date) {
      result.push({ task: t, delayDays: daysBetween(t.estimated_release_date, t.completion_date), reason: '延迟完成' });
    } else if (t.status === '已完成' && t.actual_test_date && t.estimated_test_date && t.actual_test_date > t.estimated_test_date) {
      result.push({ task: t, delayDays: daysBetween(t.estimated_test_date, t.actual_test_date), reason: '提测延迟' });
    }
  }
  return result.sort((a, b) => b.delayDays - a.delayDays);
}
