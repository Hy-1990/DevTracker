<script setup lang="ts">
import { computed, watch, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import {
  NLayout, NLayoutSider, NLayoutContent, NButton, NModal,
  NForm, NFormItem, NInput, NDivider, NText, NDropdown,
} from 'naive-ui';
import { useBoardStore } from '@/stores/board';
import { useTaskStore } from '@/stores/task';
import { useThemeStore } from '@/stores/theme';
import type { ThemePref } from '@/theme';
import { useI18n } from 'vue-i18n';
import { setLocale } from '@/i18n';

const router = useRouter();
const route = useRoute();
const boardStore = useBoardStore();
const taskStore = useTaskStore();
const themeStore = useThemeStore();
const { t, locale } = useI18n();

const themeModes = computed<{ key: ThemePref; label: string }[]>(() => [
  { key: 'dark', label: t('theme.dark') },
  { key: 'light', label: t('theme.light') },
  { key: 'auto', label: t('theme.auto') },
]);
const siderWidth = computed(() => locale.value === 'en-US' ? 248 : 200);
const languageSwitchLabel = computed(() => locale.value === 'zh-CN' ? 'English' : '中文');

function toggleLocale() {
  setLocale(locale.value === 'zh-CN' ? 'en-US' : 'zh-CN');
}

const siderCollapsed = ref(false);

const showCreateBoard = ref(false);
const newBoardName = ref('');
const newBoardYearMonth = ref('');

const deletingBoardId = ref<number | null>(null);
const showDeleteConfirm = ref(false);

// ── Board right-click menu ──
const boardCtxShow = ref(false);
const boardCtxX = ref(0);
const boardCtxY = ref(0);
const boardCtxId = ref<number | null>(null);
const boardCtxOpts = computed(() => [
  { label: t('board.clone'), key: 'clone' },
  { label: t('common.delete'), key: 'delete' },
]);

function onBoardCtx(e: MouseEvent, id: number) {
  e.preventDefault();
  e.stopPropagation();
  boardCtxId.value = id;
  boardCtxX.value = e.clientX;
  boardCtxY.value = e.clientY;
  boardCtxShow.value = true;
}

function onBoardCtxSelect(key: string) {
  boardCtxShow.value = false;
  if (!boardCtxId.value) return;
  if (key === 'clone') {
    const b = boardStore.boards.find(b => b.id === boardCtxId.value);
    if (b) startClone(b);
  } else if (key === 'delete') {
    deletingBoardId.value = boardCtxId.value;
    showDeleteConfirm.value = true;
  }
}

function selectBoard(id: number) {
  boardStore.selectBoard(id);
  router.push(`/board/${id}/table`);
}

// ── Clone board ──
const showCloneBoard = ref(false);
const cloneSourceId = ref<number | null>(null);
const cloneBoardName = ref('');
const cloneBoardYearMonth = ref('');

function startClone(b: { id: number; name: string; year_month: string }) {
  cloneSourceId.value = b.id;
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  cloneBoardYearMonth.value = `${y}-${m}`;
  cloneBoardName.value = t('board.defaultName', { year: y, month: Number(m) });
  showCloneBoard.value = true;
}

async function handleCloneBoard() {
  if (!cloneSourceId.value || !cloneBoardName.value || !cloneBoardYearMonth.value) return;
  await boardStore.cloneBoard(cloneSourceId.value, cloneBoardName.value, cloneBoardYearMonth.value);
  showCloneBoard.value = false;
}

async function handleDeleteBoard() {
  if (deletingBoardId.value !== null) {
    await boardStore.deleteBoard(deletingBoardId.value);
    deletingBoardId.value = null;
  }
  showDeleteConfirm.value = false;
}


const viewTabs = computed(() => [
  { label: t('nav.table'), key: 'table' }, { label: t('nav.kanban'), key: 'kanban' },
  { label: t('nav.delay'), key: 'delay' }, { label: t('nav.release'), key: 'release' },
  { label: t('nav.stats'), key: 'stats' }, { label: t('nav.idle'), key: 'idle' },
  { label: t('nav.daily'), key: 'daily' }, { label: t('nav.weekly'), key: 'weekly' },
  { label: t('nav.monthly'), key: 'report' },
]);

const currentView = computed(() => {
  const name = route.name as string;
  if (name?.includes('table')) return 'table';
  if (name?.includes('kanban')) return 'kanban';
  if (name?.includes('delay')) return 'delay';
  if (name?.includes('release')) return 'release';
  if (name?.includes('stats')) return 'stats';
  if (name?.includes('idle')) return 'idle';
  if (name?.includes('weekly')) return 'weekly';
  if (name?.includes('daily')) return 'daily';
  if (name?.includes('report')) return 'report';
  return 'table';
});

function switchView(view: string) {
  if (boardStore.currentBoardId) {
    router.push(`/board/${boardStore.currentBoardId}/${view}`);
  }
}

watch(
  () => boardStore.currentBoardId,
  (id) => {
    if (id) {
      taskStore.fetchTasks(id);
      if (!route.params.boardId || Number(route.params.boardId) !== id) {
        router.push(`/board/${id}/table`);
      }
    }
  },
  { immediate: true }
);

watch(
  () => route.params.boardId,
  (id) => {
    if (id && Number(id) !== boardStore.currentBoardId) {
      boardStore.selectBoard(Number(id));
    }
  }
);

async function handleCreateBoard() {
  if (!newBoardName.value || !newBoardYearMonth.value) return;
  await boardStore.createBoard(newBoardName.value, newBoardYearMonth.value);
  showCreateBoard.value = false;
  newBoardName.value = '';
  newBoardYearMonth.value = '';
}

function generateDefaultBoardInfo() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  newBoardYearMonth.value = `${y}-${m}`;
  newBoardName.value = t('board.defaultName', { year: y, month: Number(m) });
  showCreateBoard.value = true;
}
</script>

<template>
  <NLayout has-sider style="height: 100vh; background: var(--bg-base)">
    <NLayoutSider
      bordered
      collapse-mode="width"
      :collapsed="siderCollapsed"
      :collapsed-width="48"
      :width="siderWidth"
      content-style="display: flex; flex-direction: column; background: var(--bg-sider); height: 100%;"
    >
      <div v-if="siderCollapsed" style="padding:14px 0;text-align:center">
        <NButton text size="small" @click="siderCollapsed = false" style="font-size:18px;color:var(--text-secondary)">☰</NButton>
      </div>
      <div v-else style="padding:12px;flex:1;display:flex;flex-direction:column;overflow:hidden">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0 14px">
          <span class="brand">DevTracker</span>
          <NButton text size="tiny" @click="siderCollapsed = true" style="color:var(--text-muted);font-size:14px">✕</NButton>
        </div>
        <div class="board-list">
          <div
            v-for="b in boardStore.boards"
            :key="b.id"
            class="board-item"
            :class="{ active: boardStore.currentBoardId === b.id }"
            @click="selectBoard(b.id)"
            @contextmenu="onBoardCtx($event, b.id)"
          >
            <span class="board-name">{{ b.name }}</span>
          </div>
        </div>
        <NButton dashed block size="small" class="new-board-btn" @click="generateDefaultBoardInfo">+ {{ $t('board.new') }}</NButton>
        <div style="flex:1"></div>
        <NDivider style="margin:12px 0 8px" />
        <NButton
          quaternary
          block
          size="small"
          class="language-switch"
          :title="$t('language.switchHint')"
          @click="toggleLocale"
        >🌐 {{ languageSwitchLabel }}</NButton>
        <div class="theme-switch">
          <button
            v-for="m in themeModes"
            :key="m.key"
            :class="['theme-btn', { active: themeStore.pref === m.key }]"
            @click="themeStore.setPref(m.key)"
          >{{ m.label }}</button>
        </div>
        <NButton quaternary block size="small" class="settings-btn" @click="router.push('/settings')">{{ $t('nav.settings') }}</NButton>
      </div>
    </NLayoutSider>

    <NLayoutContent content-style="padding: 16px 20px; display: flex; flex-direction: column; background: var(--bg-base);">
      <!-- View tabs -->
      <div class="view-tabs">
        <button
          v-for="tab in viewTabs"
          :key="tab.key"
          :class="['tab-btn', { active: currentView === tab.key }]"
          @click="switchView(tab.key)"
        >{{ tab.label }}</button>
      </div>

      <div style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
        <router-view />
      </div>
    </NLayoutContent>
  </NLayout>

  <!-- Create board modal -->
  <NModal
    v-model:show="showCreateBoard"
    preset="dialog"
    :title="$t('board.newTitle')"
    :positive-text="$t('common.create')"
    :negative-text="$t('common.cancel')"
    @positive-click="handleCreateBoard"
  >
    <NForm>
      <NFormItem :label="$t('board.yearMonth')">
        <NInput v-model:value="newBoardYearMonth" placeholder="2026-05" />
      </NFormItem>
      <NFormItem :label="$t('board.name')">
        <NInput v-model:value="newBoardName" :placeholder="$t('board.defaultName', { year: 2026, month: 5 })" />
      </NFormItem>
    </NForm>
  </NModal>

  <!-- Delete board confirm -->
  <NModal
    v-model:show="showDeleteConfirm"
    preset="dialog"
    :title="$t('board.deleteTitle')"
    type="error"
    :positive-text="$t('common.confirmDelete')"
    :negative-text="$t('common.cancel')"
    @positive-click="handleDeleteBoard"
  >
    <NText>{{ $t('board.deleteMessage') }}</NText>
  </NModal>

  <!-- Clone board modal -->
  <NModal
    v-model:show="showCloneBoard"
    preset="dialog"
    :title="$t('board.cloneTitle')"
    :positive-text="$t('common.copy')"
    :negative-text="$t('common.cancel')"
    @positive-click="handleCloneBoard"
  >
    <NText depth="3" style="display:block;margin-bottom:12px;font-size:13px">
      {{ $t('board.cloneHint') }}
    </NText>
    <NForm>
      <NFormItem :label="$t('board.newYearMonth')">
        <NInput v-model:value="cloneBoardYearMonth" placeholder="2026-07" />
      </NFormItem>
      <NFormItem :label="$t('board.newName')">
        <NInput v-model:value="cloneBoardName" :placeholder="$t('board.defaultName', { year: 2026, month: 7 })" />
      </NFormItem>
    </NForm>
  </NModal>

  <!-- Board right-click menu -->
  <NDropdown
    :show="boardCtxShow"
    :x="boardCtxX"
    :y="boardCtxY"
    :options="boardCtxOpts"
    placement="bottom-start"
    trigger="manual"
    @select="onBoardCtxSelect"
    @clickoutside="boardCtxShow = false"
  />
</template>

<style scoped>
.brand {
  font-size: 16px; font-weight: 700; letter-spacing: 1px;
  background: linear-gradient(135deg, var(--accent-strong), var(--text-strong));
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent;
}

.view-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin-bottom: 14px;
  background: var(--bg-card-strong);
  border-radius: 8px;
  padding: 3px;
  width: fit-content;
  max-width: 100%;
}
.tab-btn {
  white-space: nowrap;
  padding: 5px 16px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}
.tab-btn:hover { color: var(--text-secondary); background: var(--hover-overlay); }
.tab-btn.active {
  color: #fff;
  background: var(--accent-dim);
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
}

/* ── Board list ── */
.board-list {
  display: flex; flex-direction: column; gap: 2px;
  overflow-y: auto; flex-shrink: 1;
}
.board-item {
  padding: 8px 12px; border-radius: 6px; cursor: pointer;
  transition: all 0.12s; user-select: none;
  border-left: 2px solid transparent;
}
.board-item:hover { background: var(--hover-overlay); }
.board-item.active {
  background: var(--accent-faint);
  border-left-color: var(--accent);
}
.board-name {
  font-size: 13px; color: var(--text-secondary); font-weight: 500;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block;
}
.board-item.active .board-name { color: var(--text-strong); font-weight: 600; }
.board-item:hover .board-name { color: var(--text-body); }

.new-board-btn {
  margin-top: 8px; font-size: 12px; flex-shrink: 0;
}
.settings-btn { font-size: 12px; flex-shrink: 0; }
.language-switch {
  margin-bottom: 6px; font-size: 12px; font-weight: 600; flex-shrink: 0;
}

/* ── 主题切换 ── */
.theme-switch {
  display: flex; gap: 2px; padding: 3px; margin-bottom: 8px;
  background: var(--bg-card-strong); border-radius: 7px; flex-shrink: 0;
}
.theme-btn {
  flex: 1; padding: 4px 0; font-size: 11px; font-weight: 500;
  color: var(--text-muted); background: transparent; border: none;
  border-radius: 5px; cursor: pointer; transition: all 0.15s;
}
.theme-btn:hover { color: var(--text-secondary); }
.theme-btn.active { color: #fff; background: var(--accent-dim); }
</style>
