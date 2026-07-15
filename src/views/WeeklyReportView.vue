<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { NButton, NInput } from 'naive-ui';
import { invoke } from '@tauri-apps/api/core';
import { addDays, format, parseISO } from 'date-fns';
import MarkdownIt from 'markdown-it';
import type { TaskWithRelations } from '@/types';
import { weekRange, classifyWeekly, buildWeeklyReport, buildWeeklyPrompt, isWeeklyEmpty } from '@/utils/weeklyReport';
import { DEEPSEEK_KEY_STORAGE } from '@/utils/aiKey';
import { markdownToPlain } from '@/utils/plainText';
import { useI18n } from 'vue-i18n';
import type { SupportedLocale } from '@/i18n';
import { reportDraftKey } from '@/utils/reportDraft';

const { t, locale } = useI18n();
const activeLocale = computed(() => locale.value as SupportedLocale);

const anchor = ref(format(new Date(), 'yyyy-MM-dd'));
const range = computed(() => weekRange(anchor.value, activeLocale.value));

const md = new MarkdownIt({ breaks: true }); // 「1、」条目行不是 md 列表语法，按换行如实渲染
const listMd = ref('');   // 代码生成的原始清单，AI 永远以它为输入
const text = ref('');     // 展示/编辑/复制的正文
const empty = ref(true);
const mode = ref<'edit' | 'preview'>('preview');
const copied = ref(false);
const loading = ref(false);
const error = ref('');
const dirty = ref(false); // 用户编辑过或含 AI 结果，按周持久化，切周/重启不丢

const rendered = computed(() => md.render(text.value));
const storageKey = computed(() => reportDraftKey('weekly', range.value.key, activeLocale.value));

function prevWeek() { anchor.value = format(addDays(parseISO(anchor.value), -7), 'yyyy-MM-dd'); }
function nextWeek() { anchor.value = format(addDays(parseISO(anchor.value), 7), 'yyyy-MM-dd'); }

/** 拉当前周数据重建清单；有草稿（AI 结果/手工编辑）则正文恢复草稿 */
async function loadWeek() {
  error.value = '';
  loading.value = true;
  try {
    const r = range.value;
    const [completed, unfinished] = await Promise.all([
      invoke<TaskWithRelations[]>('list_tasks_completed_between', { start: r.start, end: r.end }),
      invoke<TaskWithRelations[]>('list_unfinished_tasks', {
        startMonth: r.start.slice(0, 7),
        endMonth: r.end.slice(0, 7),
      }),
    ]);
    const groups = classifyWeekly(completed, unfinished, r);
    empty.value = isWeeklyEmpty(groups);
    listMd.value = buildWeeklyReport(r, groups, activeLocale.value);
    const saved = localStorage.getItem(storageKey.value);
    if (saved !== null) {
      text.value = saved;
      dirty.value = true;
    } else {
      text.value = listMd.value;
      dirty.value = false;
    }
  } catch (e) {
    error.value = String(e);
  } finally {
    loading.value = false;
  }
}

/** ↻ 重新生成清单：丢弃本周草稿，回到自动生成态 */
function regenerate() {
  localStorage.removeItem(storageKey.value);
  dirty.value = false;
  return loadWeek();
}

function onEdit(v: string) {
  text.value = v;
  dirty.value = true;
}

// dirty 内容（AI 结果/手工编辑）按周持久化
watch(text, () => {
  if (dirty.value) localStorage.setItem(storageKey.value, text.value);
});

// 进入视图自动生成；切周重建清单并恢复该周草稿
watch([() => range.value.key, locale], loadWeek, { immediate: true });

// ── AI 生成周报 ──
const aiLoading = ref(false);

async function aiGenerate() {
  error.value = '';
  const apiKey = localStorage.getItem(DEEPSEEK_KEY_STORAGE) ?? '';
  if (!apiKey) {
    error.value = t('errors.missingApiKey');
    return;
  }
  aiLoading.value = true;
  try {
    const summary = await invoke<string>('ai_complete', {
      apiKey,
      prompt: buildWeeklyPrompt(listMd.value, activeLocale.value),
    });
    text.value = summary.trim();
    dirty.value = true; // AI 结果按周持久化，切周不丢
  } catch (e) {
    error.value = String(e);
  } finally {
    aiLoading.value = false;
  }
}

/** 复制为纯文本（发聊天软件汇报用，去掉 markdown 符号） */
async function copyText() {
  await navigator.clipboard.writeText(markdownToPlain(text.value));
  copied.value = true;
  setTimeout(() => (copied.value = false), 1500);
}
</script>

<template>
  <div class="weekly-view">
    <div class="toolbar">
      <div class="toolbar-left">
        <div class="week-switch">
          <button class="week-btn" @click="prevWeek">←</button>
          <span class="week-title">{{ range.title }}</span>
          <button class="week-btn" @click="nextWeek">→</button>
        </div>
        <div class="mode-tabs">
          <button :class="['mode-btn', { active: mode === 'preview' }]" @click="mode = 'preview'">{{ $t('report.preview') }}</button>
          <button :class="['mode-btn', { active: mode === 'edit' }]" @click="mode = 'edit'">{{ $t('report.edit') }}</button>
        </div>
      </div>
      <div class="toolbar-right">
        <NButton size="small" quaternary :loading="aiLoading" :disabled="empty || loading" @click="aiGenerate">
          ✦ {{ $t('report.aiWeekly') }}
        </NButton>
        <NButton size="small" quaternary :loading="loading" @click="regenerate">↻ {{ $t('report.regenerateList') }}</NButton>
        <NButton size="small" type="primary" @click="copyText">{{ copied ? $t('common.copied') : $t('common.copy') }}</NButton>
      </div>
    </div>
    <div v-if="error" class="ai-error">{{ error }}</div>

    <div class="report-body">
      <NInput
        v-if="mode === 'edit'"
        :value="text"
        type="textarea"
        class="report-editor"
        :placeholder="$t('report.weeklyPlaceholder')"
        @update:value="onEdit"
      />
      <div v-else class="report-preview markdown-body" v-html="rendered"></div>
    </div>
  </div>
</template>

<style scoped>
.weekly-view { display: flex; flex-direction: column; height: 100%; }

.toolbar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0 0 12px; gap: 12px; flex-shrink: 0; flex-wrap:wrap;
}
.toolbar-left { display: flex; gap: 10px; align-items: center; flex-wrap:wrap; }
.toolbar-right { display: flex; gap: 8px; flex-wrap:wrap; }

.week-switch {
  display: flex; align-items: center; gap: 6px;
  background: var(--bg-card-strong); border-radius: 8px; padding: 3px 6px;
}
.week-btn {
  padding: 3px 8px; font-size: 12px; color: var(--text-muted);
  background: transparent; border: none; border-radius: 6px;
  cursor: pointer; transition: all 0.15s;
}
.week-btn:hover { color: var(--text-strong); background: var(--hover-overlay); }
.week-title { font-size: 12px; font-weight: 600; color: var(--text-secondary); min-width: 200px; text-align: center; white-space:nowrap; }

.ai-error {
  margin-bottom: 10px; padding: 8px 12px; border-radius: 6px;
  font-size: 12px; color: var(--danger);
  background: rgba(255,45,85,0.08); border: 1px solid rgba(255,45,85,0.2);
  flex-shrink: 0;
}

.mode-tabs {
  display: flex; gap: 2px; background: var(--bg-card-strong);
  border-radius: 8px; padding: 3px; width: fit-content;
}
.mode-btn {
  padding: 4px 14px; font-size: 12px; font-weight: 500;
  color: var(--text-muted); background: transparent; border: none;
  border-radius: 6px; cursor: pointer; transition: all 0.15s;
}
.mode-btn:hover { color: var(--text-secondary); }
.mode-btn.active { color: #fff; background: var(--accent-dim); }

.report-body {
  flex: 1; min-height: 0; overflow: hidden;
  border: 1px solid var(--border-soft); border-radius: 8px;
  background: var(--bg-card);
}
.report-editor {
  height: 100%;
  font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace;
}
.report-editor :deep(.n-input__textarea-el) {
  height: 100% !important;
  padding: 16px 20px;
  font-family: inherit;
  font-size: 13px !important;
  line-height: 1.8 !important;
}
.report-editor :deep(.n-input-wrapper) { height: 100%; padding: 0; }

.report-preview { height: 100%; overflow-y: auto; padding: 24px 32px; }

.markdown-body :deep(h1) {
  font-size: 22px; color: var(--text-strong); margin-bottom: 16px;
  padding-bottom: 10px; border-bottom: 1px solid var(--border-soft);
}
.markdown-body :deep(h2) { font-size: 16px; color: var(--accent-strong); margin: 22px 0 10px; }
.markdown-body :deep(h3) { font-size: 14px; color: var(--text-strong); margin: 16px 0 8px; }
.markdown-body :deep(p) { margin: 8px 0; line-height: 1.8; color: var(--text-body); }
.markdown-body :deep(ul) { padding-left: 24px; margin: 8px 0; }
.markdown-body :deep(li) { line-height: 1.8; color: var(--text-body); margin: 5px 0; }
.markdown-body :deep(strong) { color: var(--text-strong); }
</style>
