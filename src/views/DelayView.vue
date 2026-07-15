<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { NTag, NText } from 'naive-ui';
import { useTaskStore } from '@/stores/task';
import { computeDelays } from '@/utils/delay';
import { PRIORITY_COLORS, type TaskWithRelations, type TaskPriority } from '@/types';
import { useI18n } from 'vue-i18n';
import { translateDelayReason, translatePriority } from '@/i18n/domain';
import type { SupportedLocale } from '@/i18n';

const route = useRoute();
const taskStore = useTaskStore();
const { locale } = useI18n();
const activeLocale = computed(() => locale.value as SupportedLocale);
const boardId = computed(() => Number(route.params.boardId));
watch(boardId, (id) => { if (id) taskStore.fetchTasks(id); }, { immediate: true });

// 所有任务（含子任务）
const allTasks = computed(() => {
  const tasks: TaskWithRelations[] = [];
  for (const t of taskStore.tasks) { tasks.push(t); for (const c of t.children) tasks.push(c); }
  return tasks;
});

// 延期任务：只看「进行中」和「已完成」（待上线是卡审核，不算延期）
const delayedTasks = computed(() => computeDelays(allTasks.value));

// 按执行人聚合延期数
const assigneeDelaySummary = computed(() => {
  const map = new Map<number, { name: string; count: number; totalDays: number }>();
  for (const d of delayedTasks.value) {
    for (const a of d.task.assignees) {
      if (!map.has(a.id)) map.set(a.id, { name: a.name, count: 0, totalDays: 0 });
      const r = map.get(a.id)!;
      r.count++;
      r.totalDays += d.delayDays;
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
});

function priorityColor(p: TaskPriority) { return PRIORITY_COLORS[p] ?? '#8e8e93'; }
</script>

<template>
  <div class="delay-view">
    <!-- 概览 -->
    <div class="summary-row">
      <div class="summary-card danger">
        <div class="summary-num">{{ delayedTasks.length }}</div>
        <div class="summary-label">{{ $t('delay.total') }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-num">{{ delayedTasks.filter(d => d.reason === '未提测').length }}</div>
        <div class="summary-label">{{ $t('delay.overdueTest') }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-num">{{ delayedTasks.filter(d => d.reason === '提测延迟').length }}</div>
        <div class="summary-label">{{ $t('delay.testDelayed') }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-num">{{ delayedTasks.filter(d => d.reason === '延迟完成').length }}</div>
        <div class="summary-label">{{ $t('delay.completionDelayed') }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-num">{{ assigneeDelaySummary.length }}</div>
        <div class="summary-label">{{ $t('delay.people') }}</div>
      </div>
    </div>

    <!-- 按人员聚合 -->
    <div v-if="assigneeDelaySummary.length > 0" class="section-card">
      <div class="section-title">{{ $t('delay.peopleOverview') }}</div>
      <div class="person-chips">
        <div v-for="a in assigneeDelaySummary" :key="a.name" class="person-chip">
          <span class="person-name">{{ a.name }}</span>
          <span class="person-stat">{{ $t('delay.personStat', { count: a.count, days: a.totalDays }) }}</span>
        </div>
      </div>
    </div>

    <!-- 延期任务明细 -->
    <div class="section-card">
      <div class="section-title">{{ $t('delay.details') }}</div>
      <div v-if="delayedTasks.length > 0" class="table-scroll"><table class="delay-table">
        <thead>
          <tr>
            <th style="width:40%">{{ $t('delay.task') }}</th><th>{{ $t('delay.priority') }}</th><th>{{ $t('delay.assignees') }}</th>
            <th>{{ $t('delay.owner') }}</th><th>{{ $t('delay.project') }}</th><th>{{ $t('delay.estimatedTest') }}</th>
            <th>{{ $t('delay.actualTest') }}</th><th>{{ $t('delay.delayDays') }}</th><th>{{ $t('delay.status') }}</th><th>{{ $t('delay.progress') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in delayedTasks" :key="d.task.id" :class="{ critical: d.delayDays >= 7 }">
            <td class="name-col">{{ d.task.name || $t('common.unnamed') }}</td>
            <td>
              <NTag size="tiny" round :color="{ color: priorityColor(d.task.priority), textColor: '#fff' }">
                {{ translatePriority(d.task.priority, activeLocale) }}
              </NTag>
            </td>
            <td>
              <div class="member-list">
                <span v-for="a in d.task.assignees" :key="a.id" class="member-tag">{{ a.name }}</span>
                <span v-if="d.task.assignees.length === 0" class="empty">-</span>
              </div>
            </td>
            <td>{{ d.task.owner?.name || '-' }}</td>
            <td>{{ d.task.project?.name || '-' }}</td>
            <td>{{ d.task.estimated_test_date || '-' }}</td>
            <td>{{ d.task.actual_test_date || $t('delay.notTested') }}</td>
            <td>
              <span class="delay-days" :class="{ severe: d.delayDays >= 7, moderate: d.delayDays >= 3 && d.delayDays < 7 }">
                {{ $t('delay.dayValue', { count: d.delayDays }) }}
              </span>
            </td>
            <td>
              <NTag size="tiny" :type="d.reason === '未提测' ? 'error' : d.reason === '延迟完成' ? 'info' : 'warning'">{{ translateDelayReason(d.reason, activeLocale) }}</NTag>
            </td>
            <td>{{ d.task.progress }}%</td>
          </tr>
        </tbody>
      </table></div>
      <NText v-else depth="3" style="padding:24px;display:block;text-align:center">
        {{ $t('delay.empty') }}
      </NText>
    </div>
  </div>
</template>

<style scoped>
.delay-view { padding: 4px 0; overflow-y: auto; height: 100%; }

.summary-row { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
.summary-card {
  flex: 1 1 150px; padding: 16px 20px; border-radius: 8px;
  background: var(--bg-card); border: 1px solid var(--border-soft);
}
.summary-card.danger { border-color: rgba(255,45,85,0.3); }
.summary-num { font-size: 28px; font-weight: 700; color: var(--text-strong); }
.summary-card.danger .summary-num { color: var(--danger); }
.summary-label { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

.section-card {
  border-radius: 8px; background: var(--bg-card);
  border: 1px solid var(--border-soft); overflow: hidden; margin-bottom: 16px;
}
.section-title {
  padding: 12px 16px; font-size: 14px; font-weight: 600; color: var(--text-secondary);
  border-bottom: 1px solid var(--border-soft);
}

.person-chips { display: flex; flex-wrap: wrap; gap: 8px; padding: 14px 16px; }
.person-chip {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 14px; border-radius: 8px; background: rgba(255,45,85,0.08);
  border: 1px solid rgba(255,45,85,0.15);
}
.person-name { font-weight: 600; color: var(--text-strong); font-size: 14px; }
.person-stat { font-size: 12px; color: var(--danger-soft-text); }

.table-scroll { overflow-x:auto; }
.delay-table { width: 100%; min-width:1050px; border-collapse: collapse; font-size: 13px; }
.delay-table th {
  text-align: left; padding: 10px 12px; font-weight: 600; color: var(--text-secondary);
  border-bottom: 1px solid var(--border-strong); font-size: 12px;
}
.delay-table td {
  padding: 10px 12px; border-bottom: 1px solid var(--border-soft); color: var(--text-body);
}
.delay-table tr:hover { background: var(--hover-overlay); }
.delay-table tr.critical { background: rgba(255,45,85,0.04); }
.delay-table tr.critical:hover { background: rgba(255,45,85,0.08); }

.name-col { font-weight: 500; color: var(--text-strong); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.member-list { display: flex; flex-wrap: wrap; gap: 4px; }
.member-tag {
  padding: 2px 8px; border-radius: 10px; font-size: 12px;
  background: rgba(255,45,85,0.12); color: var(--danger-soft-text);
}
.empty { color: var(--text-faint); }

.delay-days { font-weight: 700; color: var(--warn); }
.delay-days.moderate { color: #ff9500; }
.delay-days.severe { color: var(--danger); }
</style>
