<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { NCard, NGrid, NGi, NTag, NText } from 'naive-ui';
import { useTaskStore } from '@/stores/task';
import { useMemberStore } from '@/stores/member';
import type { TaskWithRelations } from '@/types';
import { useI18n } from 'vue-i18n';

const route = useRoute();
const taskStore = useTaskStore();
const memberStore = useMemberStore();
const { t } = useI18n();
const boardId = computed(() => Number(route.params.boardId));
watch(boardId, (id) => { if (id) taskStore.fetchTasks(id); }, { immediate: true });

const allTasks = computed(() => {
  const tasks: TaskWithRelations[] = [];
  for (const t of taskStore.tasks) { tasks.push(t); for (const c of t.children) tasks.push(c); }
  return tasks;
});

interface DevStatus {
  id: number;
  name: string;
  idle: boolean;
  activeTasks: { name: string; progress: number }[];
}

const devStatuses = computed<DevStatus[]>(() => {
  return memberStore.devMembers.map((m) => {
    const active = allTasks.value.filter(
      (t) => t.status === '进行中' && (t as TaskWithRelations).assignees?.some((a) => a.id === m.id)
    );
    const idle = active.length === 0 || active.every((t) => t.progress >= 100);
    return {
      id: m.id,
      name: m.name,
      idle,
      activeTasks: active.map((task) => ({ name: task.name || t('common.unnamed'), progress: task.progress })),
    };
  });
});

const idleDevs = computed(() => devStatuses.value.filter((d) => d.idle));
const busyDevs = computed(() => devStatuses.value.filter((d) => !d.idle));
</script>

<template>
  <div style="overflow-y:auto;height:100%">
    <NGrid :cols="2" :x-gap="16" :y-gap="16">
      <NGi>
        <NCard :title="$t('idle.idleDevelopers')" size="small" :bordered="false" style="background:var(--bg-card)">
          <div v-if="idleDevs.length > 0" style="display:flex;flex-direction:column;gap:8px;padding:8px 0">
            <div v-for="d in idleDevs" :key="d.id" class="dev-card idle">
              <NTag type="success" round size="small">{{ d.name }}</NTag>
              <NText depth="3" style="font-size:12px;margin-left:8px">
                {{ d.activeTasks.length === 0 ? $t('idle.noActive') : $t('idle.allComplete') }}
              </NText>
            </div>
          </div>
          <NText v-else depth="3" style="padding:16px 0;display:block">{{ $t('idle.noIdle') }}</NText>
        </NCard>
      </NGi>

      <NGi>
        <NCard :title="$t('idle.busyDevelopers')" size="small" :bordered="false" style="background:var(--bg-card)">
          <div v-if="busyDevs.length > 0" style="display:flex;flex-direction:column;gap:12px;padding:8px 0">
            <div v-for="d in busyDevs" :key="d.id" class="dev-card busy">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <NTag type="warning" round size="small">{{ d.name }}</NTag>
                <NText depth="3" style="font-size:12px">{{ $t('idle.activeTasks', { count: d.activeTasks.length }) }}</NText>
              </div>
              <div v-for="(t, i) in d.activeTasks" :key="i" style="padding-left:12px;font-size:12px;color:var(--text-muted)">
                · {{ t.name }} ({{ t.progress }}%)
              </div>
            </div>
          </div>
          <NText v-else depth="3" style="padding:16px 0;display:block">{{ $t('idle.noBusy') }}</NText>
        </NCard>
      </NGi>
    </NGrid>
  </div>
</template>

<style scoped>
.dev-card { padding:8px 12px; border-radius:6px; }
.dev-card.idle { background:rgba(42,157,143,0.08); }
.dev-card.busy { background:rgba(244,162,97,0.08); }
</style>
