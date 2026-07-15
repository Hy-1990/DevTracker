import { describe, expect, it } from 'vitest';
import { detectSystemLocale, loadLocale, type SupportedLocale } from './index';
import { enUS } from './locales/en-US';
import { zhCN } from './locales/zh-CN';

function flatten(value: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === 'object'
      ? flatten(child as Record<string, unknown>, path)
      : [path];
  });
}

function storageWith(value: string | null): Storage {
  return {
    getItem: () => value,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
    key: () => null,
    length: value === null ? 0 : 1,
  };
}

describe('locale contract', () => {
  it.each<[string, SupportedLocale]>([
    ['zh-CN', 'zh-CN'],
    ['zh-TW', 'zh-CN'],
    ['en-GB', 'en-US'],
    ['fr-FR', 'en-US'],
  ])('maps system language %s to %s', (language, expected) => {
    expect(detectSystemLocale(language)).toBe(expected);
  });

  it('prefers a valid saved locale and rejects invalid values', () => {
    expect(loadLocale(storageWith('en-US'), 'zh-CN')).toBe('en-US');
    expect(loadLocale(storageWith('invalid'), 'zh-CN')).toBe('zh-CN');
  });

  it('keeps Chinese and English translation keys identical', () => {
    expect(flatten(enUS).sort()).toEqual(flatten(zhCN).sort());
  });
});
