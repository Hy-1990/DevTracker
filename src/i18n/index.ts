import { createI18n } from 'vue-i18n';
import { enUS } from './locales/en-US';
import { zhCN } from './locales/zh-CN';

export type SupportedLocale = 'zh-CN' | 'en-US';
export const LOCALE_STORAGE_KEY = 'devtracker-locale';

export function detectSystemLocale(language = 'en-US'): SupportedLocale {
  return language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
}

export function loadLocale(
  storage: Pick<Storage, 'getItem'> | undefined = typeof localStorage === 'undefined' ? undefined : localStorage,
  language = typeof navigator === 'undefined' ? 'en-US' : navigator.language,
): SupportedLocale {
  try {
    const saved = storage?.getItem(LOCALE_STORAGE_KEY);
    if (saved === 'zh-CN' || saved === 'en-US') return saved;
  } catch {
    // Storage may be unavailable in a restricted WebView; system locale remains a safe fallback.
  }
  return detectSystemLocale(language);
}

const initialLocale = loadLocale();

export const i18n = createI18n({
  legacy: false,
  locale: initialLocale,
  fallbackLocale: 'zh-CN',
  missingWarn: false,
  fallbackWarn: false,
  messages: { 'zh-CN': zhCN, 'en-US': enUS },
});

export function setLocale(locale: SupportedLocale): void {
  i18n.global.locale.value = locale;
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Keep the live locale even when persistence is unavailable.
  }
}

if (typeof document !== 'undefined') document.documentElement.lang = initialLocale;
