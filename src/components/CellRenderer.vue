<script setup lang="ts">
import { ref, watch, h, computed, nextTick } from 'vue';
import {
  NSelect, NInput, NInputNumber, NDatePicker, NSlider, NTag,
} from 'naive-ui';
import { useMemberStore } from '@/stores/member';
import { useProjectStore } from '@/stores/project';
import {
  TASK_STATUSES, TASK_PRIORITIES, TASK_TYPES,
  STATUS_COLORS, PRIORITY_COLORS, DELAY_COLORS, getDelayStatus,
  type TaskWithRelations, type TaskStatus,
} from '@/types';
import { useI18n } from 'vue-i18n';
import { translateDelayReason, translatePriority, translateStatus, translateTaskType } from '@/i18n/domain';
import type { SupportedLocale } from '@/i18n';

const props = defineProps<{
  colKey: string;
  task: TaskWithRelations;
}>();

const emit = defineEmits<{
  (e: 'update', field: string, value: any): void;
  (e: 'date', field: string, value: number | null): void;
  (e: 'expand', title: string, text: string): void;
}>();

const memberStore = useMemberStore();
const projectStore = useProjectStore();
const { t, locale } = useI18n();
const activeLocale = computed(() => locale.value as SupportedLocale);

// Local state with edit guards — 编辑中不被 store 回写覆盖
const nameEditing = ref(false);
const localName = ref(props.task.name);
const localNote = ref(props.task.latest_note);
let noteDirty = false;
let noteTimer: ReturnType<typeof setTimeout>;

watch(() => props.task.name, (v) => { if (!nameEditing.value) localName.value = v; });
watch(() => props.task.latest_note, (v) => { if (!noteDirty) localNote.value = v; });

function onNameInput(v: string) {
  localName.value = v;
}
function onNoteInput(v: string) {
  localNote.value = v;
  noteDirty = true;
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => {
    emit('update', 'latest_note', v);
    noteDirty = false;
  }, 800);
}

// Options
const statusOpts = computed(() => TASK_STATUSES.map((s) => ({ label: translateStatus(s, activeLocale.value), value: s })));
const priorityOpts = computed(() => TASK_PRIORITIES.map((p) => ({ label: translatePriority(p, activeLocale.value), value: p })));
const typeOpts = computed(() => TASK_TYPES.map((value) => ({ label: translateTaskType(value, activeLocale.value), value })));
const devOpts = computed(() => memberStore.devMembers.map((m) => ({ label: m.name, value: m.id })));
const testOpts = computed(() => memberStore.testMembers.map((m) => ({ label: m.name, value: m.id })));
const allMemberOpts = computed(() => memberStore.members.map((m) => ({ label: m.name, value: m.id })));
const projectOpts = computed(() => projectStore.projects.map((p) => ({ label: p.name, value: p.id })));

// 人员标签：同一人固定色相，CSS 变量随主题翻转明度（--tag-N-bg/text/border）
const TAG_COLOR_COUNT = 8;
function renderMemberTag({ option, handleClose }: any) {
  const i = option.value % TAG_COLOR_COUNT;
  return h('span', {
    style: `display:inline-flex;align-items:center;gap:2px;padding:1px 8px;border-radius:10px;font-size:12px;margin:1px 2px;background:var(--tag-${i}-bg);color:var(--tag-${i}-text);border:1px solid var(--tag-${i}-border);line-height:1.5`,
  }, [
    h('span', {}, option.label),
    h('span', {
      style: 'cursor:pointer;margin-left:2px;font-size:10px;opacity:0.7',
      onClick: (e: Event) => { e.stopPropagation(); handleClose(); },
    }, '×'),
  ]);
}

function renderStatusLabel(opt: any) {
  return h('span', { style: { color: STATUS_COLORS[opt.value as TaskStatus] ?? 'var(--text-muted)', fontWeight: '600' } }, opt.label);
}
function renderPriorityLabel(opt: any) {
  return h('span', { style: { color: PRIORITY_COLORS[opt.value as keyof typeof PRIORITY_COLORS] ?? 'var(--text-muted)', fontWeight: '600' } }, opt.label);
}

function parseDate(s: string | null): number | null { return s ? new Date(s).getTime() : null; }

// Debounced progress — 拖动中不被 store 覆盖
const localProgress = ref(props.task.progress);
let progressDirty = false;
let progressTimer: ReturnType<typeof setTimeout>;
watch(() => props.task.progress, (v) => { if (!progressDirty) localProgress.value = v; });

function onProgressUpdate(v: number) {
  localProgress.value = v;
  progressDirty = true;
  clearTimeout(progressTimer);
  progressTimer = setTimeout(() => {
    emit('update', 'progress', v);
    progressDirty = false;
  }, 500);
}

// Debounced story_points
const localStoryPoints = ref(props.task.story_points);
let spDirty = false;
let spTimer: ReturnType<typeof setTimeout>;
watch(() => props.task.story_points, (v) => { if (!spDirty) localStoryPoints.value = v; });

function onStoryPointsUpdate(v: number | null) {
  localStoryPoints.value = v ?? 1;
  spDirty = true;
  clearTimeout(spTimer);
  spTimer = setTimeout(() => {
    emit('update', 'story_points', v ?? 1);
    spDirty = false;
  }, 500);
}

const delayStatus = computed(() => getDelayStatus(props.task));
const delayColor = computed(() => DELAY_COLORS[delayStatus.value]);

const nameInputRef = ref<InstanceType<typeof NInput> | null>(null);

function startEditName() {
  nameEditing.value = true;
  nextTick(() => {
    nameInputRef.value?.focus();
  });
}
function stopEditName() {
  nameEditing.value = false;
  // 失焦时才提交，避免输入过程中排序跳走
  if (localName.value !== props.task.name) {
    emit('update', 'name', localName.value);
  }
}
</script>

<template>
  <!-- name: 点击展开编辑，失焦收起 -->
  <div v-if="colKey === 'name'" class="cell-name">
    <div v-if="!nameEditing" class="name-display" @click="startEditName">
      {{ localName || $t('table.taskInput') }}
    </div>
    <NInput
      v-else
      ref="nameInputRef"
      :value="localName"
      type="textarea"
      :autosize="{ minRows: 2, maxRows: 8 }"
      size="tiny"
      placeholder=" "
      @update:value="onNameInput"
      @blur="stopEditName"
    />
  </div>
  <!-- status -->
  <NSelect v-else-if="colKey === 'status'" :value="task.status" :options="statusOpts"
    size="tiny" :render-label="renderStatusLabel"
    @update:value="(v: string) => emit('update', 'status', v)" />
  <!-- priority -->
  <NSelect v-else-if="colKey === 'priority'" :value="task.priority" :options="priorityOpts"
    size="tiny" :render-label="renderPriorityLabel"
    @update:value="(v: string) => emit('update', 'priority', v)" />
  <!-- type -->
  <NSelect v-else-if="colKey === 'type'" :value="task.type" :options="typeOpts"
    size="tiny" @update:value="(v: string) => emit('update', 'task_type', v)" />
  <!-- project -->
  <NSelect v-else-if="colKey === 'project'" :value="task.project_id" :options="projectOpts"
    size="tiny" clearable @update:value="(v: number | null) => emit('update', 'project_id', v)" />
  <!-- assignees -->
  <NSelect v-else-if="colKey === 'assignees'" :value="task.assignees.map(a => a.id)" :options="devOpts"
    size="tiny" multiple :max-tag-count="'responsive'" :render-tag="renderMemberTag"
    @update:value="(v: number[]) => emit('update', 'assignee_ids', v)" />
  <!-- owner -->
  <NSelect v-else-if="colKey === 'owner'" :value="task.owner_id" :options="allMemberOpts"
    size="tiny" clearable @update:value="(v: number | null) => emit('update', 'owner_id', v)" />
  <!-- testers -->
  <NSelect v-else-if="colKey === 'testers'" :value="task.testers.map(t => t.id)" :options="testOpts"
    size="tiny" multiple :max-tag-count="'responsive'" :render-tag="renderMemberTag"
    @update:value="(v: number[]) => emit('update', 'tester_ids', v)" />
  <!-- dates -->
  <NDatePicker v-else-if="colKey === 'start_date'" :value="parseDate(task.start_date)" type="date" size="small" clearable
    @update:value="(v: number | null) => emit('date', 'start_date', v)" />
  <NDatePicker v-else-if="colKey === 'estimated_test_date'" :value="parseDate(task.estimated_test_date)" type="date" size="small" clearable
    @update:value="(v: number | null) => emit('date', 'estimated_test_date', v)" />
  <NDatePicker v-else-if="colKey === 'actual_test_date'" :value="parseDate(task.actual_test_date)" type="date" size="small" clearable
    @update:value="(v: number | null) => emit('date', 'actual_test_date', v)" />
  <NDatePicker v-else-if="colKey === 'estimated_release_date'" :value="parseDate(task.estimated_release_date)" type="date" size="small" clearable
    @update:value="(v: number | null) => emit('date', 'estimated_release_date', v)" />
  <NDatePicker v-else-if="colKey === 'completion_date'" :value="parseDate(task.completion_date)" type="date" size="small" clearable
    @update:value="(v: number | null) => emit('date', 'completion_date', v)" />
  <!-- story_points -->
  <NInputNumber v-else-if="colKey === 'story_points'" :value="localStoryPoints" size="tiny"
    :min="0" :max="100" :step="0.5" style="width:100%"
    @update:value="onStoryPointsUpdate" />
  <!-- progress: local state + mouseup commit -->
  <div v-else-if="colKey === 'progress'" style="display:flex;align-items:center;gap:4px">
    <NSlider :value="localProgress" :min="0" :max="100" :step="5" style="flex:1"
      @update:value="onProgressUpdate" />
    <span style="font-size:11px;color:var(--text-secondary);min-width:32px;text-align:right;font-weight:500">{{ localProgress }}%</span>
  </div>
  <!-- delay -->
  <NTag v-else-if="colKey === 'delay'" size="tiny" round
    :color="{ color: delayColor?.color, textColor: '#fff' }">{{ translateDelayReason(delayStatus, activeLocale) }}</NTag>
  <!-- quality_rating (10 stars) -->
  <div v-else-if="colKey === 'quality_rating'" class="star-row">
    <span
      v-for="i in 10" :key="i"
      class="star"
      :class="{ filled: task.quality_rating !== null && i <= task.quality_rating }"
      @click="emit('update', 'quality_rating', task.quality_rating === i ? null : i)"
    >★</span>
    <span v-if="task.quality_rating" class="star-num">{{ task.quality_rating }}</span>
  </div>
  <!-- latest_note -->
  <div v-else-if="colKey === 'latest_note'" class="cell-text" @click="emit('expand', t('table.latestProgress'), task.latest_note)">
    <NInput :value="localNote" size="tiny" placeholder=" " @update:value="onNoteInput" />
  </div>
</template>

<style scoped>
.star-row { display: flex; align-items: center; gap: 1px; }
.star { font-size: 13px; color: var(--star-empty); cursor: pointer; user-select: none; }
.star.filled { color: var(--warn); }
.star:hover { color: var(--warn); }
.star-num { font-size: 11px; color: var(--text-secondary); margin-left: 4px; font-weight: 600; }

.cell-name { position: relative; background: var(--bg-base); }
.name-display {
  cursor: text; padding: 4px 2px; font-size: 14px; line-height: 1.7; color: var(--text-body);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.name-display:hover { color: var(--text-strong); }

.cell-text { cursor: pointer; position: relative; }
.cell-text::after {
  content: '⤢'; position: absolute; right: 4px; top: 50%;
  transform: translateY(-50%); font-size: 10px; color: var(--text-faint);
  opacity: 0; pointer-events: none;
}
.cell-text:hover::after { opacity: 0.8; }
</style>
