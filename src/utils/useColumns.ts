import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { SupportedLocale } from '@/i18n';
import { enUS } from '@/i18n/locales/en-US';
import { zhCN } from '@/i18n/locales/zh-CN';

export interface ColumnDef {
  key: string;
  label: string;
  width: number;
  minWidth: number;
  locked?: boolean;
}

const STORAGE_KEY = 'devtracker-columns-v2';

interface ColumnSpec {
  key: string;
  width: number;
  minWidthZh: number;
  minWidthEn: number;
  locked?: boolean;
}

const COLUMN_SPECS: ColumnSpec[] = [
  { key: 'name', width: 220, minWidthZh: 120, minWidthEn: 180, locked: true },
  { key: 'status', width: 90, minWidthZh: 80, minWidthEn: 130 },
  { key: 'priority', width: 90, minWidthZh: 80, minWidthEn: 110 },
  { key: 'type', width: 90, minWidthZh: 80, minWidthEn: 130 },
  { key: 'project', width: 100, minWidthZh: 80, minWidthEn: 100 },
  { key: 'assignees', width: 150, minWidthZh: 100, minWidthEn: 130 },
  { key: 'owner', width: 100, minWidthZh: 80, minWidthEn: 100 },
  { key: 'testers', width: 120, minWidthZh: 80, minWidthEn: 100 },
  { key: 'start_date', width: 150, minWidthZh: 140, minWidthEn: 150 },
  { key: 'estimated_test_date', width: 150, minWidthZh: 140, minWidthEn: 160 },
  { key: 'actual_test_date', width: 150, minWidthZh: 140, minWidthEn: 150 },
  { key: 'estimated_release_date', width: 150, minWidthZh: 140, minWidthEn: 170 },
  { key: 'completion_date', width: 150, minWidthZh: 140, minWidthEn: 170 },
  { key: 'story_points', width: 70, minWidthZh: 56, minWidthEn: 80 },
  { key: 'progress', width: 100, minWidthZh: 80, minWidthEn: 100 },
  { key: 'delay', width: 80, minWidthZh: 70, minWidthEn: 90 },
  { key: 'quality_rating', width: 180, minWidthZh: 120, minWidthEn: 120 },
  { key: 'latest_note', width: 180, minWidthZh: 100, minWidthEn: 150 },
];

export function getDefaultColumns(locale: SupportedLocale): ColumnDef[] {
  const labels = locale === 'en-US' ? enUS.table.column : zhCN.table.column;
  return COLUMN_SPECS.map((spec) => {
    const minWidth = locale === 'en-US' ? spec.minWidthEn : spec.minWidthZh;
    return {
      key: spec.key,
      label: labels[spec.key as keyof typeof labels],
      width: Math.max(spec.width, minWidth),
      minWidth,
      locked: spec.locked,
    };
  });
}

export function useColumns() {
  const { locale } = useI18n();
  const currentLocale = () => (locale.value === 'zh-CN' ? 'zh-CN' : 'en-US');
  const allColumns = ref<ColumnDef[]>(loadColumns(currentLocale()));
  const lockedColumns = computed(() => allColumns.value.filter((c) => c.locked));
  const draggableColumns = computed(() => allColumns.value.filter((c) => !c.locked));

  function loadColumns(activeLocale: SupportedLocale): ColumnDef[] {
    const defaults = getDefaultColumns(activeLocale);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { key: string; width: number }[];
        const result: ColumnDef[] = [];
        for (const sc of parsed) {
          const def = defaults.find((d) => d.key === sc.key);
          if (def) result.push({ ...def, width: Math.max(def.minWidth, sc.width) });
        }
        for (const def of defaults) {
          if (!result.find((r) => r.key === def.key)) result.push({ ...def });
        }
        return result;
      }
    } catch {}
    return defaults.map((c) => ({ ...c }));
  }

  function saveColumns() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(allColumns.value.map((c) => ({ key: c.key, width: c.width })))
    );
  }

  // ── Resize: only affects the single column being dragged ──
  let resizingCol: ColumnDef | null = null;
  let resizeStartX = 0;
  let resizeStartWidth = 0;

  function onResizeStart(e: MouseEvent, col: ColumnDef) {
    e.preventDefault();
    e.stopPropagation();
    resizingCol = col;
    resizeStartX = e.clientX;
    resizeStartWidth = col.width;
    document.addEventListener('mousemove', onResizeMove);
    document.addEventListener('mouseup', onResizeEnd);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  function onResizeMove(e: MouseEvent) {
    if (!resizingCol) return;
    const newWidth = Math.max(resizingCol.minWidth, resizeStartWidth + (e.clientX - resizeStartX));
    // Find the column in the array and update it reactively
    const idx = allColumns.value.findIndex((c) => c.key === resizingCol!.key);
    if (idx >= 0) {
      allColumns.value[idx] = { ...allColumns.value[idx], width: newWidth };
    }
  }

  function onResizeEnd() {
    resizingCol = null;
    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', onResizeEnd);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    saveColumns();
  }

  // ── Reorder by key array ──
  function reorderColumns(keys: string[]) {
    const locked = allColumns.value.filter((c) => c.locked);
    const reordered = keys
      .map((k) => allColumns.value.find((c) => c.key === k))
      .filter(Boolean) as ColumnDef[];
    allColumns.value = [...locked, ...reordered];
    saveColumns();
  }

  function resetColumns() {
    allColumns.value = getDefaultColumns(currentLocale());
    localStorage.removeItem(STORAGE_KEY);
  }

  watch(locale, () => {
    const defaults = getDefaultColumns(currentLocale());
    allColumns.value = allColumns.value.map((column) => {
      const translated = defaults.find((candidate) => candidate.key === column.key)!;
      return { ...column, label: translated.label, minWidth: translated.minWidth, width: Math.max(column.width, translated.minWidth) };
    });
  });

  return {
    allColumns,
    lockedColumns,
    draggableColumns,
    onResizeStart,
    resetColumns,
    reorderColumns,
  };
}
