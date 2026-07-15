<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { NTag, NText, NButton, NSpace, NProgress } from 'naive-ui';
import { useTaskStore } from '@/stores/task';
import {
  TASK_STATUSES, TASK_PRIORITIES, STATUS_COLORS, PRIORITY_COLORS,
} from '@/types';
import { useI18n } from 'vue-i18n';
import { translatePriority, translateStatus } from '@/i18n/domain';
import type { SupportedLocale } from '@/i18n';

const PRIORITY_ORDER: Record<string, number> = {};
TASK_PRIORITIES.forEach((p, i) => { PRIORITY_ORDER[p] = i; }); // 紧急0 重要1 日常2 不重要3

const route = useRoute();
const taskStore = useTaskStore();
const { locale } = useI18n();
const activeLocale = computed(() => locale.value as SupportedLocale);
const boardId = computed(() => Number(route.params.boardId));
watch(boardId, (id) => { if (id) taskStore.fetchTasks(id); }, { immediate: true });

const columns = computed(() =>
  TASK_STATUSES.map((status) => ({
    status,
    color: STATUS_COLORS[status],
    tasks: taskStore.tasks
      .filter((t) => t.status === status)
      .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)),
  }))
);

const dragTaskId = { value: null as number | null };

function onDragStart(e: DragEvent, taskId: number) {
  dragTaskId.value = taskId;
  if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(taskId)); }
}

async function onDrop(e: DragEvent, status: string) {
  e.preventDefault();
  if (dragTaskId.value !== null) {
    await taskStore.updateTask(dragTaskId.value, { status: status as any });
    if (boardId.value) await taskStore.fetchTasks(boardId.value);
    dragTaskId.value = null;
  }
}

async function addTask() {
  await taskStore.createTask({ board_id: boardId.value });
}
</script>

<template>
  <div class="kanban-view">
    <NSpace justify="end" style="margin-bottom:12px;flex-shrink:0">
      <NButton type="primary" size="small" @click="addTask">+ {{ $t('kanban.newTask') }}</NButton>
    </NSpace>
    <div class="kanban-board">
      <div v-for="col in columns" :key="col.status" class="kanban-column"
        @dragover.prevent @drop="onDrop($event, col.status)">
        <div class="column-header">
          <NTag :color="{ color: col.color, textColor: '#fff' }" size="small" round>{{ translateStatus(col.status, activeLocale) }}</NTag>
          <NText depth="3" style="font-size:12px;margin-left:6px">{{ col.tasks.length }}</NText>
        </div>
        <div class="column-body">
          <div v-if="col.tasks.length === 0" class="column-empty">{{ $t('kanban.empty') }}</div>
          <div v-for="task in col.tasks" :key="task.id" class="kanban-card" draggable="true" @dragstart="onDragStart($event, task.id)">
            <div class="card-title">{{ task.name || $t('common.unnamed') }}</div>
            <div class="card-meta">
              <NTag :color="{ color: PRIORITY_COLORS[task.priority], textColor: '#fff' }" size="tiny" round>{{ translatePriority(task.priority, activeLocale) }}</NTag>
              <NText depth="3" style="font-size:11px">{{ task.assignees.map(a => a.name).join(', ') || '-' }}</NText>
            </div>
            <div v-if="task.estimated_test_date" style="margin-top:2px">
              <NText depth="3" style="font-size:11px">{{ $t('kanban.testDate', { date: task.estimated_test_date }) }}</NText>
            </div>
            <NProgress type="line" :percentage="task.progress" :height="4" :show-indicator="false" style="margin-top:6px" />
            <div v-if="task.children.length > 0" style="margin-top:4px">
              <NText depth="3" style="font-size:11px">{{ $t('kanban.subtasks', { done: task.children.filter(c => c.status === '已完成').length, total: task.children.length }) }}</NText>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.kanban-view { display:flex; flex-direction:column; height:100%; overflow:hidden; }
.kanban-board { display:flex; gap:12px; overflow:auto; flex:1; }
.kanban-column { flex:1; min-width:220px; max-width:300px; background:var(--bg-card); border-radius:8px; padding:8px; display:flex; flex-direction:column; }
.column-header { display:flex; align-items:center; padding:4px 4px 8px; flex-shrink:0; }
.column-body { display:flex; flex-direction:column; gap:8px; overflow-y:auto; flex:1; }
.column-empty {
  padding:20px 0; text-align:center; font-size:12px; color:var(--text-faint);
  border:1px dashed var(--border-soft); border-radius:6px;
}
.kanban-card {
  background:var(--bg-card-strong); border:1px solid var(--border-soft); border-radius:8px;
  padding:10px; cursor:grab;
  transition: border-color .15s ease, transform .15s ease, box-shadow .15s ease;
}
.kanban-card:hover {
  border-color: var(--accent-dim);
  transform: translateY(-1px);
  box-shadow: 0 3px 10px rgba(0,0,0,0.25);
}
.kanban-card:active { cursor:grabbing; }
.card-title { font-size:13px; font-weight:500; margin-bottom:6px; color:var(--text-strong); }
.card-meta { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
</style>
