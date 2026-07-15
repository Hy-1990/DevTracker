<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { NButton, NInput } from 'naive-ui';
import { invoke } from '@tauri-apps/api/core';
import MarkdownIt from 'markdown-it';
import { useTaskStore } from '@/stores/task';
import { useBoardStore } from '@/stores/board';
import { useMemberStore } from '@/stores/member';
import { generateMonthlyReport, applyAiSummary, buildSummaryPrompt, boldNames } from '@/utils/report';
import { DEEPSEEK_KEY_STORAGE } from '@/utils/aiKey';
import { useI18n } from 'vue-i18n';
import type { SupportedLocale } from '@/i18n';
import { reportDraftKey } from '@/utils/reportDraft';

const route = useRoute();
const taskStore = useTaskStore();
const boardStore = useBoardStore();
const memberStore = useMemberStore();
const { t, locale } = useI18n();
const activeLocale = computed(() => locale.value as SupportedLocale);

const boardId = computed(() => Number(route.params.boardId));
watch(boardId, (id) => { if (id) taskStore.fetchTasks(id); }, { immediate: true });

const md = new MarkdownIt();
const text = ref('');
const mode = ref<'edit' | 'preview'>('preview');
const copied = ref(false);
const dirty = ref(false); // 用户编辑过或含 AI 总结，数据变化时不自动覆盖

const yearMonth = computed(() => boardStore.currentBoard()?.year_month ?? '');
const rendered = computed(() => md.render(text.value));
const storageKey = computed(() => reportDraftKey('monthly', String(boardId.value), activeLocale.value));

function regenerate() {
  text.value = generateMonthlyReport(yearMonth.value, taskStore.tasks, {
    members: memberStore.devMembers.map((m) => ({ id: m.id, name: m.name })),
    locale: activeLocale.value,
  });
  dirty.value = false;
  localStorage.removeItem(storageKey.value); // 回到自动生成态，跟随数据刷新
}

function onEdit(v: string) {
  text.value = v;
  dirty.value = true;
}

// dirty 内容（手动编辑/AI 总结）持久化，切 tab、重启不丢
watch(text, () => {
  if (dirty.value) localStorage.setItem(storageKey.value, text.value);
});

// 进入视图、切换月度表或语言：只恢复当前语言的保存稿，否则生成对应语言的报告
watch([boardId, locale], () => {
  const saved = localStorage.getItem(storageKey.value);
  if (saved !== null) {
    text.value = saved;
    dirty.value = true;
  } else {
    dirty.value = false;
    regenerate();
  }
}, { immediate: true });

// 任务数据异步就绪/变化时，自动生成态跟随刷新
watch(() => taskStore.tasks, () => { if (!dirty.value) regenerate(); });

async function copyText() {
  await navigator.clipboard.writeText(text.value);
  copied.value = true;
  setTimeout(() => (copied.value = false), 1500);
}

// ── AI 总结 ──
const aiLoading = ref(false);
const aiError = ref('');

async function aiSummarize() {
  aiError.value = '';
  const apiKey = localStorage.getItem(DEEPSEEK_KEY_STORAGE) ?? '';
  if (!apiKey) {
    aiError.value = t('errors.missingApiKey');
    return;
  }
  aiLoading.value = true;
  try {
    const summary = await invoke<string>('ai_complete', {
      apiKey,
      prompt: buildSummaryPrompt(text.value, activeLocale.value),
    });
    // 兜底：AI 漏加粗的人名按成员列表补加粗
    const bolded = boldNames(summary, memberStore.members.map((m) => m.name));
    text.value = applyAiSummary(text.value, bolded);
    dirty.value = true; // AI 结果叠加在当前文本上，避免被自动重新生成覆盖
  } catch (e) {
    aiError.value = String(e);
  } finally {
    aiLoading.value = false;
  }
}

function exportMd() {
  const blob = new Blob([text.value], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${activeLocale.value === 'en-US' ? 'engineering-monthly-report' : '研发月报'}-${yearMonth.value || 'devtracker'}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div class="report-view">
    <div class="toolbar">
      <div class="mode-tabs">
        <button :class="['mode-btn', { active: mode === 'preview' }]" @click="mode = 'preview'">{{ $t('report.preview') }}</button>
        <button :class="['mode-btn', { active: mode === 'edit' }]" @click="mode = 'edit'">{{ $t('report.edit') }}</button>
      </div>
      <div class="toolbar-right">
        <NButton size="small" quaternary :loading="aiLoading" @click="aiSummarize">✦ {{ $t('report.aiSummary') }}</NButton>
        <NButton size="small" quaternary @click="regenerate">↻ {{ $t('report.regenerate') }}</NButton>
        <NButton size="small" quaternary @click="copyText">{{ copied ? $t('common.copied') : $t('report.copyMarkdown') }}</NButton>
        <NButton size="small" type="primary" @click="exportMd">{{ $t('report.exportMarkdown') }}</NButton>
      </div>
    </div>
    <div v-if="aiError" class="ai-error">{{ aiError }}</div>

    <div class="report-body">
      <NInput
        v-if="mode === 'edit'"
        :value="text"
        type="textarea"
        class="report-editor"
        :placeholder="$t('report.monthlyPlaceholder')"
        @update:value="onEdit"
      />
      <div v-else class="report-preview markdown-body" v-html="rendered"></div>
    </div>
  </div>
</template>

<style scoped>
.report-view { display: flex; flex-direction: column; height: 100%; }

.toolbar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0 0 12px; gap: 12px; flex-shrink: 0; flex-wrap:wrap;
}
.toolbar-right { display: flex; gap: 8px; flex-wrap:wrap; }

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

.report-preview {
  height: 100%; overflow-y: auto; padding: 24px 32px;
}

/* ── Markdown 渲染样式 ── */
.markdown-body :deep(h1) {
  font-size: 22px; color: var(--text-strong); margin-bottom: 16px;
  padding-bottom: 10px; border-bottom: 1px solid var(--border-soft);
}
.markdown-body :deep(h2) {
  font-size: 16px; color: var(--accent-strong); margin: 22px 0 10px;
}
.markdown-body :deep(h3) {
  font-size: 14px; color: var(--text-strong); margin: 16px 0 8px;
}
.markdown-body :deep(table) {
  border-collapse: collapse; margin: 10px 0; font-size: 13px;
  width: 100%; table-layout: auto;
}
.markdown-body :deep(th) {
  text-align: left; padding: 7px 14px; font-weight: 600; color: var(--text-secondary);
  border-bottom: 1px solid var(--border-strong); background: var(--bg-card);
}
.markdown-body :deep(td) {
  padding: 7px 14px; border-bottom: 1px solid var(--border-soft); color: var(--text-body);
}
.markdown-body :deep(p) { margin: 8px 0; line-height: 1.8; color: var(--text-body); }
.markdown-body :deep(ul),
.markdown-body :deep(ol) { padding-left: 24px; margin: 8px 0; }
.markdown-body :deep(li) { line-height: 1.8; color: var(--text-body); margin: 5px 0; }
.markdown-body :deep(li > p) { margin: 0; }
.markdown-body :deep(li > ul) { margin: 2px 0; }
.markdown-body :deep(li::marker) { color: var(--text-muted); }
.markdown-body :deep(strong) { color: var(--text-strong); }
.markdown-body :deep(blockquote) {
  border-left: 3px solid var(--accent-dim); padding: 4px 14px;
  margin: 10px 0; color: var(--text-secondary);
  background: var(--bg-card); border-radius: 0 6px 6px 0;
}
.markdown-body :deep(blockquote p) { color: var(--text-secondary); }
.markdown-body :deep(hr) { border: none; border-top: 1px solid var(--border-soft); margin: 18px 0; }
</style>
