<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { NText } from 'naive-ui';
import { useTaskStore } from '@/stores/task';
import type { TaskWithRelations } from '@/types';

const route = useRoute();
const taskStore = useTaskStore();
const boardId = computed(() => Number(route.params.boardId));
watch(boardId, (id) => { if (id) taskStore.fetchTasks(id); }, { immediate: true });

const allTasks = computed(() => {
  const tasks: TaskWithRelations[] = [];
  for (const t of taskStore.tasks) { tasks.push(t); for (const c of t.children) tasks.push(c); }
  return tasks;
});

// ── 开发排名：总分制（体现努力程度）──
interface DevRank {
  id: number; name: string;
  taskCount: number; ratedCount: number;
  totalScore: number; avgScore: number;
  storyPoints: number;
}

const devRanking = computed<DevRank[]>(() => {
  const map = new Map<number, DevRank>();
  for (const t of allTasks.value) {
    if (t.status !== '已完成') continue;
    for (const a of t.assignees) {
      if (!map.has(a.id)) {
        map.set(a.id, { id: a.id, name: a.name, taskCount: 0, ratedCount: 0, totalScore: 0, avgScore: 0, storyPoints: 0 });
      }
      const r = map.get(a.id)!;
      r.taskCount++;
      r.storyPoints += t.story_points;
      if (t.quality_rating != null) {
        r.ratedCount++;
        r.totalScore += t.quality_rating;
      }
    }
  }
  const result = Array.from(map.values());
  for (const r of result) {
    r.avgScore = r.ratedCount > 0 ? r.totalScore / r.ratedCount : 0;
  }
  // 按总分降序，总分相同按任务数
  return result.sort((a, b) => b.totalScore - a.totalScore || b.taskCount - a.taskCount);
});

// ── 测试排名：按测试任务数 + 得分 ──
interface TesterRank {
  id: number; name: string;
  taskCount: number; ratedCount: number;
  totalScore: number; avgScore: number;
}

const testerRanking = computed<TesterRank[]>(() => {
  const map = new Map<number, TesterRank>();
  for (const t of allTasks.value) {
    if (t.status !== '已完成') continue;
    for (const te of t.testers) {
      if (!map.has(te.id)) {
        map.set(te.id, { id: te.id, name: te.name, taskCount: 0, ratedCount: 0, totalScore: 0, avgScore: 0 });
      }
      const r = map.get(te.id)!;
      r.taskCount++;
      if (t.quality_rating != null) {
        r.ratedCount++;
        r.totalScore += t.quality_rating;
      }
    }
  }
  const result = Array.from(map.values());
  for (const r of result) {
    r.avgScore = r.ratedCount > 0 ? r.totalScore / r.ratedCount : 0;
  }
  return result.sort((a, b) => b.taskCount - a.taskCount || b.totalScore - a.totalScore);
});

// Stats
const totalCompleted = computed(() => allTasks.value.filter(t => t.status === '已完成').length);
const totalRated = computed(() => allTasks.value.filter(t => t.status === '已完成' && t.quality_rating != null).length);

function getMedal(idx: number): string {
  if (idx === 0) return '🥇';
  if (idx === 1) return '🥈';
  if (idx === 2) return '🥉';
  return String(idx + 1);
}

function getScoreColor(total: number, max: number): string {
  if (max === 0) return 'var(--text-faint)';
  const ratio = total / max;
  if (ratio >= 0.8) return 'var(--ok)';
  if (ratio >= 0.5) return 'var(--warn)';
  if (ratio >= 0.3) return 'var(--caution)';
  return 'var(--danger)';
}
</script>

<template>
  <div class="rank-view">
    <!-- Summary -->
    <div class="summary-row">
      <div class="summary-card">
        <div class="summary-num">{{ totalCompleted }}</div>
        <div class="summary-label">{{ $t('release.completed') }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-num">{{ totalRated }}</div>
        <div class="summary-label">{{ $t('release.rated') }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-num">{{ devRanking.length }}</div>
        <div class="summary-label">{{ $t('release.developers') }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-num">{{ testerRanking.length }}</div>
        <div class="summary-label">{{ $t('release.testers') }}</div>
      </div>
    </div>

    <div class="two-col">
      <!-- 开发排名 -->
      <div class="section-card">
        <div class="section-title">{{ $t('release.devTitle') }}<span class="section-hint">{{ $t('release.devHint') }}</span></div>
        <table class="rank-table" v-if="devRanking.length > 0">
          <thead>
            <tr>
              <th style="width:50px">{{ $t('release.rank') }}</th><th>{{ $t('release.developer') }}</th><th>{{ $t('release.completedCount') }}</th>
              <th>{{ $t('release.ratedCount') }}</th><th>{{ $t('release.totalScore') }}</th><th>{{ $t('release.averageScore') }}</th><th>{{ $t('release.effort') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, idx) in devRanking" :key="r.id" :class="{ top3: idx < 3 }">
              <td class="rank-col"><span class="medal">{{ getMedal(idx) }}</span></td>
              <td class="name-col">{{ r.name }}</td>
              <td>{{ r.taskCount }}</td>
              <td>{{ r.ratedCount }}</td>
              <td>
                <span class="total-score" :style="{ color: getScoreColor(r.totalScore, devRanking[0]?.totalScore ?? 0) }">
                  {{ r.totalScore }}
                </span>
              </td>
              <td>
                <span v-if="r.ratedCount > 0" style="color:var(--warn);font-weight:500">{{ r.avgScore.toFixed(1) }}</span>
                <span v-else class="no-score">-</span>
              </td>
              <td>{{ r.storyPoints.toFixed(1) }}</td>
            </tr>
          </tbody>
        </table>
        <NText v-else depth="3" style="padding:20px;display:block;text-align:center">{{ $t('common.empty') }}</NText>
      </div>

      <!-- 测试排名 -->
      <div class="section-card">
        <div class="section-title">{{ $t('release.testTitle') }}<span class="section-hint">{{ $t('release.testHint') }}</span></div>
        <table class="rank-table" v-if="testerRanking.length > 0">
          <thead>
            <tr>
              <th style="width:50px">{{ $t('release.rank') }}</th><th>{{ $t('release.tester') }}</th><th>{{ $t('release.testCount') }}</th>
              <th>{{ $t('release.involvedRatings') }}</th><th>{{ $t('release.totalScore') }}</th><th>{{ $t('release.averageScore') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, idx) in testerRanking" :key="r.id" :class="{ top3: idx < 3 }">
              <td class="rank-col"><span class="medal">{{ getMedal(idx) }}</span></td>
              <td class="name-col">{{ r.name }}</td>
              <td><strong>{{ r.taskCount }}</strong></td>
              <td>{{ r.ratedCount }}</td>
              <td>
                <span class="total-score" :style="{ color: getScoreColor(r.totalScore, testerRanking[0]?.totalScore ?? 0) }">
                  {{ r.totalScore }}
                </span>
              </td>
              <td>
                <span v-if="r.ratedCount > 0" style="color:var(--warn);font-weight:500">{{ r.avgScore.toFixed(1) }}</span>
                <span v-else class="no-score">-</span>
              </td>
            </tr>
          </tbody>
        </table>
        <NText v-else depth="3" style="padding:20px;display:block;text-align:center">{{ $t('common.empty') }}</NText>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rank-view { padding: 4px 0; overflow-y: auto; height: 100%; }

.summary-row { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap:wrap; }
.summary-card {
  flex: 1 1 160px; padding: 16px 20px; border-radius: 8px;
  background: var(--bg-card); border: 1px solid var(--border-soft);
}
.summary-num { font-size: 28px; font-weight: 700; color: var(--text-strong); }
.summary-label { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

.two-col { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }

.section-card {
  border-radius: 8px; background: var(--bg-card);
  border: 1px solid var(--border-soft); overflow: hidden;
}
.section-title {
  padding: 12px 16px; font-size: 14px; font-weight: 600; color: var(--text-secondary);
  border-bottom: 1px solid var(--border-soft);
  display: flex; align-items: baseline; gap: 10px; flex-wrap:wrap;
}
.section-hint { font-size: 11px; color: var(--text-faint); font-weight: 400; }

.rank-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.rank-table th {
  text-align: left; padding: 10px 12px; font-weight: 600; color: var(--text-secondary);
  border-bottom: 1px solid var(--border-strong); font-size: 12px;
}
.rank-table td {
  padding: 10px 12px; border-bottom: 1px solid var(--border-soft); color: var(--text-body);
}
.rank-table tr:hover { background: var(--hover-overlay); }
.rank-table tr.top3 { background: var(--bg-card); }

.rank-col { text-align: center; }
.medal { font-size: 18px; }
.name-col { font-weight: 600; color: var(--text-strong); }
.total-score { font-size: 18px; font-weight: 700; }
.no-score { color: var(--text-faint); font-size: 12px; }
@media (max-width: 1100px) { .two-col { grid-template-columns:1fr; } .section-card { overflow-x:auto; } .rank-table { min-width:620px; } }
</style>
