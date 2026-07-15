<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  NLayout, NLayoutContent, NCard, NButton, NInput, NSpace, NList, NListItem,
  NPopconfirm, NText, NSelect, NTag,
} from 'naive-ui';
import { useMemberStore } from '@/stores/member';
import { useProjectStore } from '@/stores/project';
import { DEEPSEEK_KEY_STORAGE } from '@/utils/aiKey';
import { useI18n } from 'vue-i18n';
import { setLocale, type SupportedLocale } from '@/i18n';

const router = useRouter();
const memberStore = useMemberStore();
const projectStore = useProjectStore();
const { t, locale } = useI18n();
const languageOptions = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' },
];
function changeLocale(value: SupportedLocale) { setLocale(value); }

// ── DeepSeek API Key（仅存本机 localStorage）──
const deepseekKey = ref(localStorage.getItem(DEEPSEEK_KEY_STORAGE) ?? '');
const keySaved = ref(false);

function saveDeepseekKey() {
  localStorage.setItem(DEEPSEEK_KEY_STORAGE, deepseekKey.value.trim());
  keySaved.value = true;
  setTimeout(() => (keySaved.value = false), 1500);
}

const newMemberName = ref('');
const newMemberRole = ref<'dev' | 'test'>('dev');
const newProjectName = ref('');

const editingMemberId = ref<number | null>(null);
const editingMemberName = ref('');
const editingMemberRole = ref<'dev' | 'test'>('dev');
const editingProjectId = ref<number | null>(null);
const editingProjectName = ref('');

const roleOptions = computed(() => [
  { label: t('settings.developer'), value: 'dev' },
  { label: t('settings.tester'), value: 'test' },
]);

async function addMember() {
  if (!newMemberName.value.trim()) return;
  await memberStore.createMember(newMemberName.value.trim(), newMemberRole.value);
  newMemberName.value = '';
}

async function saveMember(id: number) {
  if (!editingMemberName.value.trim()) return;
  await memberStore.updateMember(id, editingMemberName.value.trim(), editingMemberRole.value);
  editingMemberId.value = null;
}

async function addProject() {
  if (!newProjectName.value.trim()) return;
  await projectStore.createProject(newProjectName.value.trim());
  newProjectName.value = '';
}

async function saveProject(id: number) {
  if (!editingProjectName.value.trim()) return;
  await projectStore.updateProject(id, editingProjectName.value.trim());
  editingProjectId.value = null;
}
</script>

<template>
  <NLayout style="height: 100vh">
    <NLayoutContent content-style="padding: 24px; max-width: 640px; margin: 0 auto;">
      <NButton quaternary size="small" @click="router.back()" style="margin-bottom: 16px">← {{ $t('common.back') }}</NButton>

      <NCard :title="$t('language.title')" size="small" style="margin-bottom: 20px">
        <div class="setting-row">
          <NText depth="3" class="setting-description">{{ $t('language.description') }}</NText>
          <NSelect
            :value="locale"
            :options="languageOptions"
            size="small"
            class="language-select"
            @update:value="changeLocale"
          />
        </div>
      </NCard>

      <NCard :title="$t('settings.members')" size="small" style="margin-bottom: 20px">
        <NSpace class="form-actions" style="margin-bottom: 12px">
          <NInput v-model:value="newMemberName" :placeholder="$t('settings.name')" size="small" class="name-input" @keydown.enter="addMember" />
          <NSelect v-model:value="newMemberRole" :options="roleOptions" size="small" style="width:110px" />
          <NButton size="small" type="primary" @click="addMember">{{ $t('common.add') }}</NButton>
        </NSpace>

        <NList bordered size="small">
          <NListItem v-for="m in memberStore.members" :key="m.id">
            <template v-if="editingMemberId === m.id">
              <NSpace>
                <NInput v-model:value="editingMemberName" size="small" style="width:100px" />
                <NSelect v-model:value="editingMemberRole" :options="roleOptions" size="small" style="width:110px" />
                <NButton size="tiny" type="primary" @click="saveMember(m.id)">{{ $t('common.save') }}</NButton>
                <NButton size="tiny" @click="editingMemberId = null">{{ $t('common.cancel') }}</NButton>
              </NSpace>
            </template>
            <template v-else>
              <NSpace justify="space-between" align="center" style="width: 100%">
                <NSpace :size="8" align="center">
                  <NText>{{ m.name }}</NText>
                  <NTag size="tiny" :type="m.role === 'dev' ? 'info' : 'warning'">
                    {{ m.role === 'dev' ? $t('settings.developerShort') : $t('settings.testerShort') }}
                  </NTag>
                </NSpace>
                <NSpace :size="4">
                  <NButton text size="tiny" @click="editingMemberId = m.id; editingMemberName = m.name; editingMemberRole = m.role as any">{{ $t('common.edit') }}</NButton>
                  <NPopconfirm @positive-click="memberStore.deleteMember(m.id)">
                    <template #trigger><NButton text size="tiny" type="error">{{ $t('common.delete') }}</NButton></template>
                    {{ $t('settings.deleteMember', { name: m.name }) }}
                  </NPopconfirm>
                </NSpace>
              </NSpace>
            </template>
          </NListItem>
        </NList>
      </NCard>

      <NCard :title="$t('settings.ai')" size="small" style="margin-bottom: 20px">
        <NSpace vertical :size="8">
          <NText depth="3" style="font-size:12px">
            {{ $t('settings.aiHint') }}
          </NText>
          <NSpace>
            <NInput
              v-model:value="deepseekKey"
              type="password"
              show-password-on="click"
              placeholder="sk-..."
              size="small"
              style="width: 320px"
              @keydown.enter="saveDeepseekKey"
            />
            <NButton size="small" type="primary" @click="saveDeepseekKey">
              {{ keySaved ? $t('common.saved') : $t('common.save') }}
            </NButton>
          </NSpace>
        </NSpace>
      </NCard>

      <NCard :title="$t('settings.projects')" size="small">
        <NSpace class="form-actions" style="margin-bottom: 12px">
          <NInput v-model:value="newProjectName" :placeholder="$t('settings.projectName')" size="small" @keydown.enter="addProject" />
          <NButton size="small" type="primary" @click="addProject">{{ $t('common.add') }}</NButton>
        </NSpace>
        <NList bordered size="small">
          <NListItem v-for="p in projectStore.projects" :key="p.id">
            <template v-if="editingProjectId === p.id">
              <NSpace>
                <NInput v-model:value="editingProjectName" size="small" />
                <NButton size="tiny" type="primary" @click="saveProject(p.id)">{{ $t('common.save') }}</NButton>
                <NButton size="tiny" @click="editingProjectId = null">{{ $t('common.cancel') }}</NButton>
              </NSpace>
            </template>
            <template v-else>
              <NSpace justify="space-between" align="center" style="width:100%">
                <NText>{{ p.name }}</NText>
                <NSpace :size="4">
                  <NButton text size="tiny" @click="editingProjectId = p.id; editingProjectName = p.name">{{ $t('common.edit') }}</NButton>
                  <NPopconfirm @positive-click="projectStore.deleteProject(p.id)">
                    <template #trigger><NButton text size="tiny" type="error">{{ $t('common.delete') }}</NButton></template>
                    {{ $t('settings.deleteProject', { name: p.name }) }}
                  </NPopconfirm>
                </NSpace>
              </NSpace>
            </template>
          </NListItem>
        </NList>
      </NCard>
    </NLayoutContent>
  </NLayout>
</template>

<style scoped>
.setting-row { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; }
.setting-description { flex:1 1 280px; font-size:12px; }
.language-select { width:180px; flex:0 0 180px; }
.form-actions { display:flex; flex-wrap:wrap; align-items:center; }
.name-input { width:160px; max-width:100%; }
@media (max-width: 720px) {
  .language-select { width:100%; flex-basis:100%; }
  .name-input { width:100%; }
}
</style>
