<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import {
  NButton, NSpace, NTag, NPopconfirm, NDropdown, NModal,
} from 'naive-ui';
import { useTaskStore } from '@/stores/task';
import ExportButton from '@/components/ExportButton.vue';
import CellRenderer from '@/components/CellRenderer.vue';
import { useColumns } from '@/utils/useColumns';
import {
  TASK_STATUSES, TASK_TYPES, STATUS_COLORS,
  type TaskWithRelations, type TaskStatus, type UpdateTaskInput,
} from '@/types';
import { useI18n } from 'vue-i18n';
import { translateStatus } from '@/i18n/domain';
import type { SupportedLocale } from '@/i18n';

const route = useRoute();
const taskStore = useTaskStore();
const { t, locale } = useI18n();
const activeLocale = computed(() => locale.value as SupportedLocale);
const {
  allColumns, lockedColumns, draggableColumns, onResizeStart,
  reorderColumns,
} = useColumns();

const boardId = computed(() => Number(route.params.boardId));
watch(boardId, (id) => { if (id) taskStore.fetchTasks(id); }, { immediate: true });

// ── Column sort modal (mouse-based drag) ──
const showColSort = ref(false);
const dragIdx = ref(-1);
const dragOverIdx = ref(-1);
const sortListRef = ref<HTMLElement | null>(null);

function onItemMouseDown(e: MouseEvent, idx: number) {
  e.preventDefault();
  dragIdx.value = idx;
  const onMove = (me: MouseEvent) => {
    if (!sortListRef.value) return;
    const items = sortListRef.value.querySelectorAll('.col-sort-item.draggable');
    let target = -1;
    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect();
      if (me.clientY >= rect.top && me.clientY <= rect.bottom) { target = i; break; }
    }
    dragOverIdx.value = target;
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    if (dragIdx.value >= 0 && dragOverIdx.value >= 0 && dragIdx.value !== dragOverIdx.value) {
      const keys = draggableColumns.value.map((c) => c.key);
      const [moved] = keys.splice(dragIdx.value, 1);
      keys.splice(dragOverIdx.value, 0, moved);
      reorderColumns(keys);
    }
    dragIdx.value = -1;
    dragOverIdx.value = -1;
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

// ── Sort: 5-level cascade (与飞书一致) ──
// 类型选项顺序映射
const TYPE_ORDER: Record<string, number> = {};
TASK_TYPES.forEach((t, i) => { TYPE_ORDER[t] = i; });

function sortTasks(tasks: TaskWithRelations[]): TaskWithRelations[] {
  return [...tasks].sort((a, b) => {
    // 空名称排最后（新建记录留在底部，填完失焦后正常排序）
    const aEmpty = !a.name.trim();
    const bEmpty = !b.name.trim();
    if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;

    const pa = a.project_id ?? 999999;
    const pb = b.project_id ?? 999999;
    if (pa !== pb) return pa - pb;
    const ca = a.completion_date || 'zzzz';
    const cb = b.completion_date || 'zzzz';
    let r = ca.localeCompare(cb); if (r) return r;
    r = a.name.localeCompare(b.name); if (r) return r;
    const ea = a.estimated_test_date || 'zzzz';
    const eb = b.estimated_test_date || 'zzzz';
    r = ea.localeCompare(eb); if (r) return r;
    return (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99);
  });
}

// ── Display rows ──
const collapsedGroups = ref<Set<string>>(new Set());
function toggleGroup(s: string) {
  collapsedGroups.value.has(s) ? collapsedGroups.value.delete(s) : collapsedGroups.value.add(s);
}
const expandedRows = ref<Set<number>>(new Set());
function toggleExpand(id: number) {
  expandedRows.value.has(id) ? expandedRows.value.delete(id) : expandedRows.value.add(id);
}
watch(() => taskStore.tasks, (tasks) => {
  for (const t of tasks) { if (t.children.length > 0) expandedRows.value.add(t.id); }
}, { immediate: true });

interface DisplayRow {
  kind: 'group-header' | 'task' | 'subtask' | 'add-row';
  status: TaskStatus;
  task?: TaskWithRelations;
  count?: number;
  seq?: number; // 主任务在分组内的序号
}
const displayRows = computed<DisplayRow[]>(() => {
  const rows: DisplayRow[] = [];
  for (const status of TASK_STATUSES) {
    const tasks = taskStore.tasks.filter((t) => t.status === status);
    rows.push({ kind: 'group-header', status, count: tasks.length });
    if (!collapsedGroups.value.has(status)) {
      let seq = 1;
      for (const task of sortTasks(tasks)) {
        rows.push({ kind: 'task', task, status, seq: seq++ });
        if (expandedRows.value.has(task.id)) {
          for (const child of task.children) rows.push({ kind: 'subtask', task: child, status });
        }
      }
      rows.push({ kind: 'add-row', status });
    }
  }
  return rows;
});

// ── Edit ──
function formatDate(ts: number | null): string | null {
  if (!ts) return null;
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
async function onCellUpdate(taskId: number, field: string, value: any) {
  await taskStore.updateTask(taskId, { [field]: value } as UpdateTaskInput);
}
async function onCellDate(taskId: number, field: string, ts: number | null) {
  await taskStore.updateTask(taskId, { [field]: formatDate(ts) } as UpdateTaskInput);
}
async function addTask(parentId?: number, status?: TaskStatus) {
  await taskStore.createTask({ board_id: boardId.value, parent_id: parentId ?? null, status });
}
async function handleDelete(id: number) { await taskStore.deleteTask(id); }

// ── Multi-select ──
const selectedIds = ref<Set<number>>(new Set());
let lastClickedId: number | null = null;

function onRowClick(e: MouseEvent, id: number) {
  if (e.metaKey || e.ctrlKey) {
    // Toggle single
    selectedIds.value.has(id) ? selectedIds.value.delete(id) : selectedIds.value.add(id);
  } else if (e.shiftKey && lastClickedId !== null) {
    // Range select
    const taskIds = displayRows.value.filter(r => r.kind === 'task' || r.kind === 'subtask').map(r => r.task!.id);
    const fromIdx = taskIds.indexOf(lastClickedId);
    const toIdx = taskIds.indexOf(id);
    if (fromIdx >= 0 && toIdx >= 0) {
      const [start, end] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
      for (let i = start; i <= end; i++) selectedIds.value.add(taskIds[i]);
    }
  } else {
    selectedIds.value.clear();
    selectedIds.value.add(id);
  }
  lastClickedId = id;
}

async function handleBatchDelete() {
  const ids = Array.from(selectedIds.value);
  for (const id of ids) await taskStore.deleteTask(id);
  selectedIds.value.clear();
}

// ── Checkbox multi-select ──
function toggleSelect(id: number) {
  selectedIds.value.has(id) ? selectedIds.value.delete(id) : selectedIds.value.add(id);
  lastClickedId = id;
}
const selectableIds = computed(() =>
  displayRows.value.filter(r => r.kind === 'task' || r.kind === 'subtask').map(r => r.task!.id));
const allSelected = computed(() =>
  selectableIds.value.length > 0 && selectableIds.value.every(id => selectedIds.value.has(id)));
const someSelected = computed(() =>
  selectableIds.value.some(id => selectedIds.value.has(id)) && !allSelected.value);
function toggleSelectAll() {
  if (allSelected.value) selectedIds.value.clear();
  else selectedIds.value = new Set(selectableIds.value);
}

// ── Context menu ──
const ctxShow = ref(false); const ctxX = ref(0); const ctxY = ref(0);
const ctxTaskId = ref<number | null>(null); const ctxIsChild = ref(false);
const ctxOpts = computed(() => {
  const o: { label: string; key: string }[] = [];
  if (selectedIds.value.size > 1) {
    o.push({ label: t('table.batchDelete', { count: selectedIds.value.size }), key: 'batch_delete' });
  } else {
    if (!ctxIsChild.value) o.push({ label: t('table.addChild'), key: 'add_child' });
    o.push({ label: t('common.delete'), key: 'delete' });
  }
  return o;
});
function onCtx(e: MouseEvent, id: number, isChild: boolean) {
  e.preventDefault();
  // If right-clicked row not in selection, reset selection to this row
  if (!selectedIds.value.has(id)) {
    selectedIds.value.clear();
    selectedIds.value.add(id);
  }
  ctxTaskId.value = id; ctxIsChild.value = isChild;
  ctxX.value = e.clientX; ctxY.value = e.clientY; ctxShow.value = true;
}
async function onCtxSelect(key: string) {
  ctxShow.value = false;
  if (key === 'batch_delete') { await handleBatchDelete(); return; }
  if (!ctxTaskId.value) return;
  if (key === 'delete') await handleDelete(ctxTaskId.value);
  else if (key === 'add_child') await addTask(ctxTaskId.value);
}

// ── Text expand ──
const expandText = ref(''); const expandTitle = ref(''); const showExpand = ref(false);
function openExpand(t: string, s: string) { expandTitle.value = t; expandText.value = s; showExpand.value = true; }

// 精确宽度而非minWidth，防止浏览器按比例分配
const tableWidth = computed(() => 58 + allColumns.value.reduce((s, c) => s + c.width, 0) + 70);
const nameCol = computed(() => allColumns.value.find(c => c.key === 'name'));
const nameColWidth = computed(() => nameCol.value?.width ?? 220);
const restColumns = computed(() => allColumns.value.filter(c => c.key !== 'name'));
</script>

<template>
  <div class="table-view">
    <div class="toolbar">
      <div class="toolbar-left">
        <NButton size="small" quaternary class="tool-btn" @click="showColSort = true">⇅ {{ $t('table.columns') }}</NButton>
        <span class="sort-hint">{{ $t('table.sortHint') }}</span>
      </div>
      <div class="toolbar-right">
        <ExportButton />
        <NButton type="primary" size="small" class="add-btn" @click="addTask()">+ {{ $t('table.newTask') }}</NButton>
      </div>
    </div>

    <div class="table-scroll-wrapper">
      <!-- 用精确width，不用minWidth，确保每列宽度独立 -->
      <table class="task-table" :style="{ width: tableWidth + 'px' }">
        <colgroup>
          <col style="width:58px" />
          <col v-for="col in allColumns" :key="col.key" :style="{ width: col.width + 'px' }" />
          <col style="width:70px" />
        </colgroup>
        <thead>
          <tr>
            <th class="th-fixed sticky-expand" style="text-align:left;padding-left:12px">
              <input type="checkbox" class="hdr-check" :checked="allSelected"
                :indeterminate.prop="someSelected" @change="toggleSelectAll" :title="$t('table.selectAll')" />
            </th>
            <th class="th-cell sticky-name" :style="{ left: '58px', width: nameColWidth + 'px' }">
              <span class="th-label">{{ nameCol?.label }}</span>
              <span class="resize-handle" @mousedown.stop="nameCol && onResizeStart($event, nameCol)"></span>
            </th>
            <th v-for="col in restColumns" :key="col.key" class="th-cell">
              <span class="th-label">{{ col.label }}</span>
              <span class="resize-handle" @mousedown.stop="onResizeStart($event, col)"></span>
            </th>
            <th class="th-fixed">{{ $t('table.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="(row, ri) in displayRows" :key="ri">
            <tr v-if="row.kind === 'group-header'" class="group-header-row" @click="toggleGroup(row.status)">
              <td class="group-header-cell sticky-expand" style="border-right:none"></td>
              <td class="group-header-cell sticky-name" :style="{ left: '58px', borderRight: 'none' }">
                <span class="group-arrow">{{ collapsedGroups.has(row.status) ? '▶' : '▼' }}</span>
                <NTag :color="{ color: STATUS_COLORS[row.status], textColor: '#fff' }" size="small" round>{{ translateStatus(row.status, activeLocale) }}</NTag>
                <span class="group-count">{{ $t('common.records', { count: row.count }) }}</span>
              </td>
              <td v-for="col in restColumns" :key="col.key" class="group-header-cell"></td>
              <td class="group-header-cell"></td>
            </tr>
            <tr v-else-if="row.kind === 'task'" class="data-row" :class="{ selected: selectedIds.has(row.task!.id) }" @click="onRowClick($event, row.task!.id)" @contextmenu="onCtx($event, row.task!.id, false)">
              <td class="sticky-expand cell-first">
                <input type="checkbox" class="row-check" :checked="selectedIds.has(row.task!.id)" @click.stop="toggleSelect(row.task!.id)" />
                <span class="row-seq">{{ row.seq }}</span>
                <span v-if="row.task!.children.length > 0" class="expand-btn" @click.stop="toggleExpand(row.task!.id)">
                  {{ expandedRows.has(row.task!.id) ? '▼' : '▶' }}
                </span>
              </td>
              <td class="sticky-name" :style="{ left: '58px' }">
                <CellRenderer col-key="name" :task="row.task!"
                  @update="(f: string, v: any) => onCellUpdate(row.task!.id, f, v)"
                  @date="(f: string, v: number | null) => onCellDate(row.task!.id, f, v)"
                  @expand="openExpand" />
              </td>
              <td v-for="col in restColumns" :key="col.key">
                <CellRenderer :col-key="col.key" :task="row.task!"
                  @update="(f: string, v: any) => onCellUpdate(row.task!.id, f, v)"
                  @date="(f: string, v: number | null) => onCellDate(row.task!.id, f, v)"
                  @expand="openExpand" />
              </td>
              <td>
                <NSpace :size="2">
                  <NButton text size="tiny" class="action-link" @click="addTask(row.task!.id)">{{ $t('table.childShort') }}</NButton>
                  <NPopconfirm @positive-click="handleDelete(row.task!.id)">
                    <template #trigger><NButton text size="tiny" type="error" class="action-link">{{ $t('table.deleteShort') }}</NButton></template>
                    {{ $t('table.deleteConfirm') }}
                  </NPopconfirm>
                </NSpace>
              </td>
            </tr>
            <tr v-else-if="row.kind === 'subtask'" class="data-row subtask-row" :class="{ selected: selectedIds.has(row.task!.id) }" @click="onRowClick($event, row.task!.id)" @contextmenu="onCtx($event, row.task!.id, true)">
              <td class="sticky-expand cell-first cell-first-sub">
                <input type="checkbox" class="row-check" :checked="selectedIds.has(row.task!.id)" @click.stop="toggleSelect(row.task!.id)" />
              </td>
              <td class="sticky-name" :style="{ left: '58px' }">
                <div style="display:flex;align-items:center">
                  <span class="subtask-indent">└</span>
                  <div style="flex:1">
                    <CellRenderer col-key="name" :task="row.task!"
                      @update="(f: string, v: any) => onCellUpdate(row.task!.id, f, v)"
                      @date="(f: string, v: number | null) => onCellDate(row.task!.id, f, v)"
                      @expand="openExpand" />
                  </div>
                </div>
              </td>
              <td v-for="col in restColumns" :key="col.key">
                <CellRenderer :col-key="col.key" :task="row.task!"
                  @update="(f: string, v: any) => onCellUpdate(row.task!.id, f, v)"
                  @date="(f: string, v: number | null) => onCellDate(row.task!.id, f, v)"
                  @expand="openExpand" />
              </td>
              <td>
                <NPopconfirm @positive-click="handleDelete(row.task!.id)">
                  <template #trigger><NButton text size="tiny" type="error" class="action-link">{{ $t('table.deleteShort') }}</NButton></template>
                  {{ $t('table.deleteConfirm') }}
                </NPopconfirm>
              </td>
            </tr>
            <tr v-else-if="row.kind === 'add-row'" class="add-row">
              <td class="add-row-cell sticky-expand"></td>
              <td class="add-row-cell sticky-name" :style="{ left: '58px' }">
                <NButton text size="tiny" class="add-row-btn" @click="addTask(undefined, row.status)">+ {{ $t('table.addRecord') }}</NButton>
              </td>
              <td v-for="col in restColumns" :key="col.key" class="add-row-cell"></td>
              <td class="add-row-cell"></td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- Column sort modal -->
    <NModal v-model:show="showColSort" preset="card" :title="$t('table.columns')" style="width:min(380px, 90vw)" :bordered="false">
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px">{{ $t('table.reorderHint') }}</p>
      <div ref="sortListRef" class="col-sort-list">
        <div class="col-sort-item locked">
          <span class="col-sort-icon">🔒</span>
          <span>{{ lockedColumns[0]?.label }} ({{ $t('table.fixed') }})</span>
        </div>
        <div
          v-for="(col, idx) in draggableColumns"
          :key="col.key"
          class="col-sort-item draggable"
          :class="{
            'is-dragging': dragIdx === idx,
            'drag-indicator': dragOverIdx === idx && dragIdx !== idx,
          }"
          @mousedown="onItemMouseDown($event, idx)"
        >
          <span class="col-sort-grip">⠿</span>
          <span class="col-sort-num">{{ idx + 2 }}</span>
          <span class="col-sort-label">{{ col.label }}</span>
        </div>
      </div>
    </NModal>

    <NDropdown :show="ctxShow" :x="ctxX" :y="ctxY" :options="ctxOpts"
      placement="bottom-start" trigger="manual" @select="onCtxSelect" @clickoutside="ctxShow = false" />

    <NModal v-model:show="showExpand" preset="card" :title="expandTitle" style="width:600px;max-height:80vh" :bordered="false">
      <div class="expand-content">{{ expandText || $t('table.emptyValue') }}</div>
    </NModal>
  </div>
</template>

<style scoped>
.table-view { display: flex; flex-direction: column; height: 100%; }

/* ── Multi-select checkboxes ── */
.task-table td.cell-first { text-align: left; padding: 4px 3px 4px 10px; white-space: nowrap; }
.row-check, .hdr-check {
  appearance: none; -webkit-appearance: none;
  width: 15px; height: 15px; border-radius: 4px; box-sizing: border-box;
  border: 1.5px solid var(--border-strong); background: transparent;
  cursor: pointer; vertical-align: middle; margin: 0;
  position: relative; transition: background .12s ease, border-color .12s ease;
}
.row-check:hover, .hdr-check:hover { border-color: var(--accent-strong); }
.row-check:checked, .hdr-check:checked { background: var(--accent); border-color: var(--accent); }
.row-check:checked::after, .hdr-check:checked::after {
  content: ''; position: absolute; left: 4.5px; top: 1.5px;
  width: 4px; height: 8px; border: solid #fff; border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
.hdr-check:indeterminate { background: var(--accent); border-color: var(--accent); }
.hdr-check:indeterminate::after {
  content: ''; position: absolute; left: 3px; top: 6px; width: 9px; height: 2px;
  background: #fff; border-radius: 1px;
}
.expand-btn { margin-left: 3px; }
/* selected-row left accent */
.data-row.selected td.sticky-expand { box-shadow: inset 3px 0 0 0 var(--accent); }

.toolbar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 4px 12px; gap: 12px; flex-wrap: wrap;
}
.toolbar-left, .toolbar-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0; }
.tool-btn {
  font-size: 13px; color: var(--text-secondary) !important;
  border: 1px solid var(--border-soft) !important; border-radius: 6px !important;
}
.tool-btn:hover { background: var(--hover-overlay) !important; color: var(--text-body) !important; }
.sort-hint { font-size: 12px; color: var(--text-faint); margin-left: 4px; }
.add-btn { border-radius: 6px !important; font-weight: 500; }

.table-scroll-wrapper {
  flex: 1; overflow: auto;
  border-radius: 8px; border: 1px solid var(--border-soft);
  background: var(--bg-base); scrollbar-width: thin;
  contain: layout style;
}
.table-scroll-wrapper::-webkit-scrollbar { height: 8px; width: 8px; }
.table-scroll-wrapper::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 4px; }

/* 关键：table-layout: fixed + colgroup 确保每列宽度独立 */
.task-table { border-collapse: collapse; font-size: 14px; line-height: 1.7; table-layout: fixed; }
.task-table thead { position: sticky; top: 0; z-index: 10; background: var(--bg-base); }

.th-cell {
  position: relative; padding: 10px 8px; font-weight: 600; color: var(--text-secondary);
  border-bottom: 1px solid var(--border-strong); font-size: 13px;
  border-right: 1px solid var(--border-faint);
  white-space: nowrap; user-select: none; letter-spacing: 0.4px;
  overflow: hidden; text-overflow: ellipsis;
}
.th-cell:last-of-type { border-right: none; }
.th-fixed {
  padding: 8px 6px; font-weight: 600; color: var(--text-secondary);
  border-bottom: 1px solid var(--border-strong); font-size: 12px;
}
.th-label { overflow: hidden; text-overflow: ellipsis; }

/* ── Sticky columns: expand btn + name ── */
.sticky-expand,
.sticky-name {
  position: sticky; z-index: 3; background: var(--bg-base) !important;
}
.sticky-expand {
  left: 0; border-right: none !important;
}
.sticky-name {
  border-right: 2px solid var(--table-divider) !important;
}
thead .sticky-expand, thead .sticky-name { z-index: 12; }
.data-row:hover .sticky-expand,
.data-row:hover .sticky-name { background: var(--bg-hover) !important; }
.data-row.selected .sticky-expand,
.data-row.selected .sticky-name { background: var(--bg-selected) !important; }
.data-row.selected:hover .sticky-expand,
.data-row.selected:hover .sticky-name { background: var(--bg-selected-hover) !important; }
.group-header-row .sticky-expand,
.group-header-row .sticky-name,
.add-row .sticky-expand,
.add-row .sticky-name { border-right-color: transparent !important; }

/* 列宽拖拽手柄：只在右边缘，hover时蓝色高亮 */
.resize-handle {
  position: absolute; right: -2px; top: 0; bottom: 0; width: 6px;
  cursor: col-resize; z-index: 1;
}
.resize-handle:hover { background: var(--accent-dim); }

.task-table td {
  padding: 5px 4px; border-bottom: 1px solid var(--border-faint);
  border-right: 1px solid var(--border-faint);
  vertical-align: middle; overflow: hidden;
}
.task-table td:last-child { border-right: none; }

.data-row { background: var(--bg-base); cursor: default; }
.data-row:hover { background: var(--bg-hover); }
.data-row.selected { background: var(--bg-selected); }
.data-row.selected:hover { background: var(--bg-selected-hover); }
.data-row.selected .sticky-expand,
.data-row.selected .sticky-name { background: var(--bg-selected) !important; }
.data-row.selected:hover .sticky-expand,
.data-row.selected:hover .sticky-name { background: var(--bg-selected-hover) !important; }
.subtask-row { background: var(--bg-base); }
.subtask-row:hover { background: var(--bg-hover); }
.subtask-indent { color: var(--text-faint); margin-right: 4px; flex-shrink: 0; font-size: 12px; }
.td-center { text-align: center; }
.row-seq { font-size: 11px; color: var(--text-muted); font-weight: 500; margin: 0 0 0 3px; }
.expand-btn { cursor: pointer; font-size: 9px; color: var(--text-muted); }
.expand-btn:hover { color: var(--text-secondary); }
.action-link { opacity: 0.5; }
.data-row:hover .action-link { opacity: 1; }

.group-header-row { cursor: pointer; }
.group-header-row:hover { background: var(--bg-hover); }
.group-header-cell {
  padding: 10px 8px !important; background: var(--bg-base);
  border-bottom: 1px solid var(--border-soft) !important;
  border-top: 1px solid var(--border-soft);
}
.group-header-row .sticky-expand,
.group-header-row .sticky-name,
.add-row .sticky-expand,
.add-row .sticky-name { background: var(--bg-base); }
.group-arrow { font-size: 11px; margin-right: 8px; color: var(--text-muted); }
.group-count { font-size: 13px; color: var(--text-faint); margin-left: 8px; }

.add-row-cell { padding: 6px 12px !important; }
.add-row-btn { color: var(--text-faint) !important; font-size: 13px; }
.add-row-btn:hover { color: var(--text-secondary) !important; }

/* ── Column sort modal ── */
.col-sort-list { display: flex; flex-direction: column; gap: 2px; }
.col-sort-item {
  display: flex; align-items: center;
  padding: 10px 12px; border-radius: 6px; background: var(--bg-card-strong);
  font-size: 13px; color: var(--text-body); transition: all 0.12s;
  border: 2px solid transparent;
}
.col-sort-item.locked { opacity: 0.4; cursor: not-allowed; }
.col-sort-item.draggable { cursor: grab; }
.col-sort-item.draggable:active { cursor: grabbing; }
.col-sort-item.is-dragging { opacity: 0.4; background: var(--accent-faint); }
.col-sort-item.drag-indicator { border-top: 2px solid var(--accent); }
.col-sort-grip {
  margin-right: 10px; font-size: 16px; color: var(--text-faint); cursor: grab;
  letter-spacing: -1px; user-select: none;
}
.col-sort-icon { margin-right: 8px; font-size: 12px; }
.col-sort-num {
  width: 22px; height: 22px; border-radius: 50%; background: var(--border-soft);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; color: var(--text-muted); margin-right: 10px; flex-shrink: 0;
}
.col-sort-label { flex: 1; }

.expand-content {
  white-space: pre-wrap; word-break: break-word; max-height: 60vh;
  overflow: auto; font-size: 14px; line-height: 1.7; color: var(--text-body);
}
</style>
