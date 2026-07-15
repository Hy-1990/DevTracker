<script setup lang="ts">
import { computed, watch, onMounted, ref, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { NCard, NGrid, NGi, NStatistic, NText, NTag } from 'naive-ui';
import * as echarts from 'echarts';
import { getChartText } from '@/theme';
import { useThemeStore } from '@/stores/theme';
import { useTaskStore } from '@/stores/task';
import { useMemberStore } from '@/stores/member';
import {
  TASK_STATUSES, TASK_TYPES, STATUS_COLORS, getDelayStatus,
  type TaskWithRelations,
} from '@/types';
import { useI18n } from 'vue-i18n';
import { translateStatus, translateTaskType } from '@/i18n/domain';
import type { SupportedLocale } from '@/i18n';

const route = useRoute();
const taskStore = useTaskStore();
const memberStore = useMemberStore();
const themeStore = useThemeStore();
const { locale } = useI18n();
const activeLocale = computed(() => locale.value as SupportedLocale);
const boardId = computed(() => Number(route.params.boardId));
watch(boardId, (id) => { if (id) taskStore.fetchTasks(id); }, { immediate: true });

// All tasks including children
const allTasks = computed(() => {
  const tasks: TaskWithRelations[] = [];
  for (const t of taskStore.tasks) { tasks.push(t); for (const c of t.children) tasks.push(c); }
  return tasks;
});

const totalCount = computed(() => allTasks.value.length);
const statusCounts = computed(() => {
  const counts: Record<string, number> = {};
  for (const s of TASK_STATUSES) counts[s] = 0;
  for (const t of allTasks.value) counts[t.status]++;
  return counts;
});

// Task type distribution
const TYPE_COLORS: Record<string, string> = {
  '产品需求': '#5ac8fa', '功能优化': '#34c759', '基建': '#af52de',
  'bug修复': '#ff3b30', '日常维护': '#ff9500', 'toboss': '#8e8e93',
};
const typeCounts = computed(() => {
  const counts: Record<string, number> = {};
  for (const t of TASK_TYPES) counts[t] = 0;
  for (const t of allTasks.value) counts[t.type] = (counts[t.type] ?? 0) + 1;
  return counts;
});

// Employee completion ranking
interface CompletionRank { name: string; onTime: number; delayed: number; total: number; delayRate: string; }
const completionRanking = computed<CompletionRank[]>(() => {
  const map = new Map<number, { name: string; onTime: number; delayed: number }>();
  for (const t of allTasks.value) {
    if (t.status !== '已完成') continue;
    const delayed = getDelayStatus(t) === '延迟完成';
    for (const a of (t as TaskWithRelations).assignees ?? []) {
      if (!map.has(a.id)) map.set(a.id, { name: a.name, onTime: 0, delayed: 0 });
      const rec = map.get(a.id)!;
      delayed ? rec.delayed++ : rec.onTime++;
    }
  }
  return Array.from(map.values())
    .map((r) => ({ name: r.name, onTime: r.onTime, delayed: r.delayed, total: r.onTime + r.delayed,
      delayRate: r.onTime + r.delayed > 0 ? (r.delayed / (r.onTime + r.delayed) * 100).toFixed(1) + '%' : '0%',
    }))
    .sort((a, b) => b.total - a.total);
});

// Employee score ranking — 总分制
interface ScoreRank { name: string; count: number; totalScore: number; avg: string; }
const scoreRanking = computed<ScoreRank[]>(() => {
  const map = new Map<number, { name: string; scores: number[] }>();
  for (const t of allTasks.value) {
    if (t.status !== '已完成' || t.quality_rating == null) continue;
    for (const a of (t as TaskWithRelations).assignees ?? []) {
      if (!map.has(a.id)) map.set(a.id, { name: a.name, scores: [] });
      map.get(a.id)!.scores.push(t.quality_rating);
    }
  }
  return Array.from(map.values())
    .map((r) => ({ name: r.name, count: r.scores.length,
      totalScore: r.scores.reduce((a, b) => a + b, 0),
      avg: (r.scores.reduce((a, b) => a + b, 0) / r.scores.length).toFixed(1),
    }))
    .sort((a, b) => b.totalScore - a.totalScore);
});

// Idle developers
const idleDevs = computed(() => {
  return memberStore.devMembers.filter((m) => {
    const activeTasks = allTasks.value.filter(
      (t) => t.status === '进行中' && (t as TaskWithRelations).assignees?.some((a) => a.id === m.id)
    );
    return activeTasks.length === 0 || activeTasks.every((t) => t.progress >= 100);
  });
});

// Pie chart
const pieChartRef = ref<HTMLElement | null>(null);
function renderPieChart() {
  if (!pieChartRef.value) return;
  const chart = echarts.getInstanceByDom(pieChartRef.value) ?? echarts.init(pieChartRef.value);
  const ct = getChartText(themeStore.resolved);
  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    series: [{ type: 'pie', radius: ['40%', '70%'],
      label: { formatter: '{b}: {c} ({d}%)', color: ct.label, fontSize: 12 },
      data: TASK_STATUSES.map((s) => ({ name: translateStatus(s, activeLocale.value), value: statusCounts.value[s] || 0, itemStyle: { color: STATUS_COLORS[s] } })),
    }],
  });
}
// Task type donut
const typeChartRef = ref<HTMLElement | null>(null);
function renderTypeChart() {
  if (!typeChartRef.value) return;
  const chart = echarts.getInstanceByDom(typeChartRef.value) ?? echarts.init(typeChartRef.value);
  const ct = getChartText(themeStore.resolved);
  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, textStyle: { color: ct.legend }, itemWidth: 10, itemHeight: 10 },
    series: [{
      type: 'pie', radius: ['40%', '68%'], center: ['50%', '45%'],
      label: { formatter: '{b}\n{d}%', color: ct.label, fontSize: 11 },
      data: TASK_TYPES
        .map((type) => ({ name: translateTaskType(type, activeLocale.value), value: typeCounts.value[type] || 0, itemStyle: { color: TYPE_COLORS[type] } }))
        .filter((d) => d.value > 0),
    }],
  });
}

function renderCharts() { renderPieChart(); renderTypeChart(); }
watch(allTasks, () => nextTick(renderCharts), { deep: true });
watch(() => themeStore.resolved, () => nextTick(renderCharts));
watch(locale, () => nextTick(renderCharts));
onMounted(() => nextTick(renderCharts));
</script>

<template>
  <div style="overflow-y:auto;height:100%">
    <!-- Overview cards -->
    <NGrid :cols="6" :x-gap="12" style="margin-bottom:20px">
      <NGi>
        <NCard size="small" :bordered="false" style="background:var(--bg-card)">
          <NStatistic :label="$t('stats.totalTasks')" :value="totalCount" />
        </NCard>
      </NGi>
      <NGi v-for="status in TASK_STATUSES" :key="status">
        <NCard size="small" :bordered="false" style="background:var(--bg-card)">
          <NStatistic :label="translateStatus(status, activeLocale)" :value="statusCounts[status] || 0">
            <template #suffix>
              <NText depth="3" style="font-size:12px">
                {{ totalCount > 0 ? ((statusCounts[status] || 0) / totalCount * 100).toFixed(1) + '%' : '0%' }}
              </NText>
            </template>
          </NStatistic>
        </NCard>
      </NGi>
    </NGrid>

    <!-- ── 任务统计（前） ── -->
    <div class="section-title">{{ $t('stats.taskStats') }}</div>
    <NGrid :cols="2" :x-gap="16" :y-gap="16" style="margin-bottom:22px">
      <NGi>
        <NCard :title="$t('stats.statusDistribution')" size="small" :bordered="false" style="background:var(--bg-card)">
          <div ref="pieChartRef" style="width:100%;height:300px"></div>
        </NCard>
      </NGi>
      <NGi>
        <NCard :title="$t('stats.typeDistribution')" size="small" :bordered="false" style="background:var(--bg-card)">
          <div ref="typeChartRef" style="width:100%;height:300px"></div>
        </NCard>
      </NGi>
    </NGrid>

    <!-- ── 员工排名（后） ── -->
    <div class="section-title">{{ $t('stats.employeeRanking') }}</div>
    <NGrid :cols="2" :x-gap="16" :y-gap="16">
      <!-- Completion ranking -->
      <NGi>
        <NCard :title="$t('stats.completionRanking')" size="small" :bordered="false" style="background:var(--bg-card)">
          <table class="rank-table" v-if="completionRanking.length > 0">
            <thead><tr><th>{{ $t('stats.rank') }}</th><th>{{ $t('stats.employee') }}</th><th>{{ $t('stats.onTime') }}</th><th>{{ $t('stats.delayed') }}</th><th>{{ $t('stats.total') }}</th><th>{{ $t('stats.delayRate') }}</th></tr></thead>
            <tbody>
              <tr v-for="(r, idx) in completionRanking" :key="r.name">
                <td><span v-if="idx < 3" class="medal">{{ ['🥇','🥈','🥉'][idx] }}</span><span v-else>{{ idx + 1 }}</span></td>
                <td>{{ r.name }}</td>
                <td style="color:var(--ok)">{{ r.onTime }}</td>
                <td style="color:var(--danger)">{{ r.delayed }}</td>
                <td><strong>{{ r.total }}</strong></td>
                <td><NText :type="parseFloat(r.delayRate) > 20 ? 'error' : 'success'">{{ r.delayRate }}</NText></td>
              </tr>
            </tbody>
          </table>
          <NText v-else depth="3">{{ $t('common.empty') }}</NText>
        </NCard>
      </NGi>

      <!-- Score ranking -->
      <NGi>
        <NCard :title="$t('stats.scoreRanking')" size="small" :bordered="false" style="background:var(--bg-card)">
          <table class="rank-table" v-if="scoreRanking.length > 0">
            <thead><tr><th>{{ $t('stats.rank') }}</th><th>{{ $t('stats.employee') }}</th><th>{{ $t('stats.ratedCount') }}</th><th>{{ $t('stats.totalScore') }}</th><th>{{ $t('stats.averageScore') }}</th></tr></thead>
            <tbody>
              <tr v-for="(r, idx) in scoreRanking" :key="r.name">
                <td><span v-if="idx < 3" class="medal">{{ ['🥇','🥈','🥉'][idx] }}</span><span v-else>{{ idx + 1 }}</span></td>
                <td>{{ r.name }}</td>
                <td>{{ r.count }}</td>
                <td><strong style="color:var(--ok);font-size:16px">{{ r.totalScore }}</strong></td>
                <td style="color:var(--warn)">{{ r.avg }}</td>
              </tr>
            </tbody>
          </table>
          <NText v-else depth="3">{{ $t('common.empty') }}</NText>
        </NCard>
      </NGi>

      <!-- Idle developers -->
      <NGi>
        <NCard :title="$t('stats.idleDevelopers')" size="small" :bordered="false" style="background:var(--bg-card)">
          <div v-if="idleDevs.length > 0" style="display:flex;flex-wrap:wrap;gap:8px;padding:8px 0">
            <NTag v-for="m in idleDevs" :key="m.id" type="success" round>{{ m.name }}</NTag>
          </div>
          <NText v-else depth="3">{{ $t('stats.noIdle') }}</NText>
        </NCard>
      </NGi>
    </NGrid>
  </div>
</template>

<style scoped>
.section-title { font-size:14px; font-weight:600; color:var(--text-secondary); margin:2px 2px 12px; letter-spacing:0.3px; }
.rank-table { width:100%; border-collapse:collapse; font-size:13px; }
.rank-table th { text-align:left; padding:6px 8px; font-weight:500; color:var(--text-muted); border-bottom:1px solid var(--border-soft); font-size:12px; }
.rank-table td { padding:6px 8px; border-bottom:1px solid var(--border-faint); }
.rank-table tr:hover { background:var(--hover-overlay); }
.medal { font-size:16px; }
</style>
