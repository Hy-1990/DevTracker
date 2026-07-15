import type { SupportedLocale } from '@/i18n';

export type ReportDraftKind = 'daily' | 'weekly' | 'monthly';

export function reportDraftKey(kind: ReportDraftKind, scope: string, locale: SupportedLocale): string {
  return `devtracker-${kind}-${scope}-${locale}`;
}
