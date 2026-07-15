<script setup lang="ts">
import { NDropdown, NButton } from 'naive-ui';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { useTaskStore } from '@/stores/task';
import { useBoardStore } from '@/stores/board';
import { exportToExcel, exportToCSV, exportToJSON } from '@/utils/export';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const taskStore = useTaskStore();
const boardStore = useBoardStore();
const { t } = useI18n();

const options = computed(() => [
  { label: `${t('common.export')} Excel (.xlsx)`, key: 'xlsx' },
  { label: `${t('common.export')} CSV`, key: 'csv' },
  { label: `${t('common.export')} JSON`, key: 'json' },
  { label: `${t('common.export')} SQLite`, key: 'db' },
]);

async function handleExport(key: string) {
  const board = boardStore.currentBoard();
  const prefix = board ? board.year_month : 'devtracker';

  if (key === 'xlsx') {
    exportToExcel(taskStore.tasks, `${prefix}-tasks.xlsx`);
  } else if (key === 'csv') {
    exportToCSV(taskStore.tasks, `${prefix}-tasks.csv`);
  } else if (key === 'json') {
    exportToJSON(taskStore.tasks, `${prefix}-tasks.json`);
  } else if (key === 'db') {
    const filePath = await save({
      defaultPath: `devtracker-${prefix}.db`,
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    });
    if (filePath) {
      await invoke('export_db_file', { destPath: filePath });
    }
  }
}
</script>

<template>
  <NDropdown :options="options" @select="handleExport" trigger="click">
    <NButton size="small">{{ $t('common.export') }} ▾</NButton>
  </NDropdown>
</template>
