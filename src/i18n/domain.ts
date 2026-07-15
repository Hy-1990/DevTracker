import type { DelayReason } from '@/utils/delay';
import type { TaskPriority, TaskStatus, TaskType } from '@/types';
import type { SupportedLocale } from './index';
import { enUS } from './locales/en-US';
import { zhCN } from './locales/zh-CN';

const STATUS_KEYS: Record<TaskStatus, keyof typeof zhCN.domain.status> = {
  已停滞: 'stalled', 待开始: 'todo', 进行中: 'progress', 待上线: 'release', 已完成: 'done',
};
const PRIORITY_KEYS: Record<TaskPriority, keyof typeof zhCN.domain.priority> = {
  紧急: 'urgent', 重要: 'important', 日常: 'routine', 不重要: 'low',
};
const TYPE_KEYS: Record<TaskType, keyof typeof zhCN.domain.type> = {
  产品需求: 'product', 功能优化: 'improvement', 基建: 'infrastructure', bug修复: 'bug', 日常维护: 'maintenance', toboss: 'toboss',
};
type DisplayDelayReason = DelayReason | '提测延期' | '正常';
const DELAY_KEYS: Record<DisplayDelayReason, keyof typeof zhCN.domain.delay> = {
  未提测: 'untested', 提测延迟: 'testDelayed', 提测延期: 'testDelayed', 延迟完成: 'completionDelayed', 正常: 'normal',
};
const ROLE_KEYS = { dev: 'dev', test: 'test' } as const;

function messages(locale: SupportedLocale) {
  return locale === 'en-US' ? enUS : zhCN;
}

export function translateStatus(value: TaskStatus, locale: SupportedLocale): string {
  const key = STATUS_KEYS[value];
  return key ? messages(locale).domain.status[key] : value;
}

export function translatePriority(value: TaskPriority, locale: SupportedLocale): string {
  const key = PRIORITY_KEYS[value];
  return key ? messages(locale).domain.priority[key] : value;
}

export function translateTaskType(value: TaskType, locale: SupportedLocale): string {
  const key = TYPE_KEYS[value];
  return key ? messages(locale).domain.type[key] : value;
}

export function translateDelayReason(value: DisplayDelayReason, locale: SupportedLocale): string {
  const key = DELAY_KEYS[value];
  return key ? messages(locale).domain.delay[key] : value;
}

export function translateRole(value: 'dev' | 'test', locale: SupportedLocale): string {
  const key = ROLE_KEYS[value];
  return key ? messages(locale).domain.role[key] : value;
}
