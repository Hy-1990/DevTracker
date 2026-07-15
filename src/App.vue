<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { NConfigProvider, darkTheme, lightTheme, zhCN, dateZhCN, enUS, dateEnUS } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { getOverrides } from '@/theme';
import { useThemeStore } from '@/stores/theme';
import { useBoardStore } from '@/stores/board';
import { useMemberStore } from '@/stores/member';
import { useProjectStore } from '@/stores/project';

const themeStore = useThemeStore();
const naiveTheme = computed(() => (themeStore.resolved === 'dark' ? darkTheme : lightTheme));
const overrides = computed(() => getOverrides(themeStore.resolved));
const { locale } = useI18n();
const naiveLocale = computed(() => locale.value === 'zh-CN' ? zhCN : enUS);
const naiveDateLocale = computed(() => locale.value === 'zh-CN' ? dateZhCN : dateEnUS);

const boardStore = useBoardStore();
const memberStore = useMemberStore();
const projectStore = useProjectStore();

onMounted(async () => {
  document.addEventListener('contextmenu', (e) => { e.preventDefault(); });
  await Promise.all([
    boardStore.fetchBoards(),
    memberStore.fetchMembers(),
    projectStore.fetchProjects(),
  ]);
});
</script>

<template>
  <NConfigProvider :theme="naiveTheme" :theme-overrides="overrides" :locale="naiveLocale" :date-locale="naiveDateLocale">
    <router-view />
  </NConfigProvider>
</template>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }

html, body, #app {
  height: 100%;
  background: var(--bg-base);
  color: var(--text-body);
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
  font-size: 14px;
  -webkit-font-smoothing: antialiased;
}

.n-input .n-input__input-el,
.n-input .n-input__textarea-el {
  font-size: 14px !important;
  line-height: 1.7 !important;
}
.n-tag { font-weight: 500 !important; }

/* ── 表格内嵌输入组件的结构性布局（撑满单元格、垂直居中），主题色由 themeOverrides 管 ── */
.task-table td .n-input,
.task-table td .n-select,
.task-table td .n-date-picker {
  width: 100% !important;
}
.task-table td .n-input .n-input-wrapper {
  padding: 0 4px !important; min-height: 34px !important;
  display: flex !important; align-items: center !important;
}
.task-table td .n-base-selection {
  --n-height: 34px !important;
}
.task-table td .n-base-selection .n-base-selection-label {
  display: flex !important; align-items: center !important; min-height: 34px !important;
  font-size: 14px !important;
}
.task-table td .n-base-selection .n-base-selection-placeholder {
  display: flex !important; align-items: center !important;
  color: transparent !important;
}
.task-table td .n-input .n-input__placeholder {
  color: transparent !important;
}
.task-table td .n-base-selection .n-base-selection-tags {
  min-height: 34px !important; align-items: center !important;
}
.task-table td .n-date-picker {
  display: flex !important; align-items: center !important;
}
.task-table td .n-date-picker .n-input .n-input-wrapper {
  padding: 0 8px !important; min-height: 34px !important;
  display: flex !important; align-items: center !important;
}
.task-table td .n-input-number {
  --n-height: 34px !important;
}
.task-table td .n-input-number .n-input .n-input-wrapper {
  min-height: 34px !important;
  display: flex !important; align-items: center !important;
}
.n-date-picker-input,
.n-input--pair,
.n-date-picker .n-input {
  --n-color: transparent !important;
  --n-color-focus: transparent !important;
}

/* Scrollbar global */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-thumb-hover); }
::-webkit-scrollbar-track { background: transparent; }

/* Selection color */
::selection { background: var(--accent-faint); }
</style>
