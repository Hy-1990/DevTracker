import { addDays, format, getISOWeek, getISOWeekYear, parseISO, startOfISOWeek } from 'date-fns';
import { TASK_PRIORITIES, type TaskWithRelations } from '@/types';
import type { SupportedLocale } from '@/i18n';

export interface WeekRange {
  title: string; // 2026年第24周（6月8日-6月14日）
  start: string; // 2026-06-08（周一）
  end: string;   // 2026-06-14（周日）
  key: string;   // 2026-W24，草稿持久化键
}

export function weekRange(anchor: string, locale: SupportedLocale = 'zh-CN'): WeekRange {
  const start = startOfISOWeek(parseISO(anchor));
  const end = addDays(start, 6);
  const week = getISOWeek(start);
  const year = getISOWeekYear(start);
  const cn = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日`;
  const en = (date: Date) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
  return {
    title: locale === 'en-US' ? `${year} Week ${week} (${en(start)}–${en(end)})` : `${year}年第${week}周（${cn(start)}-${cn(end)}）`,
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
    key: `${year}-W${String(week).padStart(2, '0')}`,
  };
}

export interface WeeklyGroups {
  /** 一、产品需求上线：产品需求 + toboss */
  product: TaskWithRelations[];
  /** 二、性能优化与问题修复：功能优化 + bug修复 */
  optimization: TaskWithRelations[];
  /** 三、架构迁移与基建优化：基建 */
  infra: TaskWithRelations[];
  /** 四、PM重点关注与后续跟进：进行中/待上线（待上线排前） */
  followUp: TaskWithRelations[];
  /** 提测/测试中：进行中且已填实际提测日期 */
  testing: TaskWithRelations[];
}

const PRODUCT_TYPES: string[] = ['产品需求', 'toboss'];
const OPTIMIZATION_TYPES: string[] = ['功能优化', 'bug修复'];

/** 正文三块收本周完成；日常维护/空名排除。跟进块收进行中/待上线，停滞不进 */
export function classifyWeekly(
  completed: TaskWithRelations[],
  unfinished: TaskWithRelations[],
  range: WeekRange
): WeeklyGroups {
  const g: WeeklyGroups = { product: [], optimization: [], infra: [], followUp: [], testing: [] };
  for (const t of completed) {
    if (!t.name.trim() || t.status !== '已完成' || !t.completion_date) continue;
    if (t.completion_date < range.start || t.completion_date > range.end) continue;
    if (PRODUCT_TYPES.includes(t.type)) g.product.push(t);
    else if (OPTIMIZATION_TYPES.includes(t.type)) g.optimization.push(t);
    else if (t.type === '基建') g.infra.push(t);
    // 日常维护不进周报
  }
  for (const t of unfinished) {
    if (!t.name.trim()) continue;
    if (t.status === '进行中' && t.actual_test_date) g.testing.push(t);
    else if (t.status === '进行中' || t.status === '待上线') g.followUp.push(t);
  }
  g.followUp.sort((a, b) => (a.status === b.status ? 0 : a.status === '待上线' ? -1 : 1));
  return g;
}

function taskLine(t: TaskWithRelations): string {
  const note = t.latest_note.trim();
  return note ? `${t.name}：${note}` : t.name;
}

/** 项目展示顺序：置顶项目在前，其余项目居中按出现顺序，无项目（其他）最后 */
export const PROJECT_ORDER: string[] = ['Dreamface', 'Agent', 'DreamAPI'];
const NO_PROJECT = '其他';

function projectRank(name: string): number {
  const i = PROJECT_ORDER.indexOf(name);
  if (i !== -1) return i;
  return name === NO_PROJECT ? PROJECT_ORDER.length + 1 : PROJECT_ORDER.length;
}

function priorityRank(t: TaskWithRelations): number {
  const i = TASK_PRIORITIES.indexOf(t.priority);
  return i === -1 ? TASK_PRIORITIES.length : i;
}

/** 块内按项目分组（置顶顺序），组内按优先级排序（紧急>重要>日常>不重要，平级时待上线在前） */
function groupByProject(list: TaskWithRelations[]): [string, TaskWithRelations[]][] {
  const map = new Map<string, TaskWithRelations[]>();
  for (const t of list) {
    const key = t.project?.name ?? NO_PROJECT;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  for (const tasks of map.values()) {
    tasks.sort((a, b) => {
      const d = priorityRank(a) - priorityRank(b);
      if (d !== 0) return d;
      if (a.status !== b.status) return a.status === '待上线' ? -1 : b.status === '待上线' ? 1 : 0;
      return 0;
    });
  }
  return [...map.entries()].sort((a, b) => projectRank(a[0]) - projectRank(b[0]));
}

/** 渲染一个分块：项目小标题加粗，组内 1、2、3 编号 */
function pushGrouped(lines: string[], list: TaskWithRelations[], locale: SupportedLocale): void {
  for (const [project, tasks] of groupByProject(list)) {
    lines.push(`**${project === NO_PROJECT && locale === 'en-US' ? 'Other' : project}**`);
    tasks.forEach((task, index) => lines.push(locale === 'en-US' ? `${index + 1}. ${taskLine(task)}` : `${index + 1}、${taskLine(task)}`));
    lines.push('');
  }
}

export function isWeeklyEmpty(g: WeeklyGroups): boolean {
  return (
    g.product.length + g.optimization.length + g.infra.length +
    g.followUp.length + g.testing.length === 0
  );
}

/** 生成周报清单 Markdown；全空时返回空态文案 */
export function buildWeeklyReport(range: WeekRange, g: WeeklyGroups, locale: SupportedLocale = 'zh-CN'): string {
  const english = locale === 'en-US';
  const lines: string[] = [english ? `# ${range.title} Engineering Weekly Report` : `# ${range.title}研发周报`, ''];
  if (isWeeklyEmpty(g)) {
    lines.push(english ? 'No reportable progress this week.' : '本周暂无可汇报的进展。');
    return lines.join('\n') + '\n';
  }
  const sections: [string, TaskWithRelations[]][] = [
    [english ? '1. Product Releases' : '一、产品需求上线', g.product],
    [english ? '2. Performance and Fixes' : '二、性能优化与问题修复', g.optimization],
    [english ? '3. Architecture and Infrastructure' : '三、架构迁移与基建优化', g.infra],
  ];
  for (const [title, list] of sections) {
    if (list.length === 0) continue;
    lines.push(english ? `## ${title} (${list.length})` : `## ${title}（${list.length} 项）`, '');
    pushGrouped(lines, list, locale);
  }
  if (g.followUp.length + g.testing.length > 0) {
    lines.push(english ? '## 4. Focus and Follow-up (Next Week)' : '## 四、PM重点关注与后续跟进（下周备忘）', '');
    pushGrouped(lines, g.followUp, locale);
    if (g.testing.length > 0) {
      lines.push(english ? '### In Testing' : '### 提测/测试中的需求', '');
      pushGrouped(lines, g.testing, locale);
    }
  }
  return lines.join('\n').trimEnd() + '\n';
}

/** 构造给 DeepSeek 的提示词：研发负责人给领导的正式周报 */
export function buildWeeklyPrompt(report: string, locale: SupportedLocale = 'zh-CN'): string {
  if (locale === 'en-US') {
    return [
      'You are an engineering lead. Turn the weekly engineering checklist below into a formal leadership update.', '',
      'Output language is mandatory: the entire response must be written in English, even when task or project names contain Chinese.',
      'Use only the provided tasks, sections, projects, and notes. Preserve their order and never invent details.',
      'Keep one item per source task, remove internal prefixes, omit personal names, and write clear professional English.',
      'Return only the report body.', '', '---', '', report,
    ].join('\n');
  }
  return [
    '你是一名研发负责人，请把下面的研发周报清单整理成发给领导的正式周报。要求：',
    '输出语言是硬性要求：全部内容必须使用简体中文，即使任务名或项目名包含英文，也不能改用英文撰写。',
    '',
    '1. 只整理清单中已有的任务，严禁新增清单之外的任务或分类块；保留清单的分块结构、块标题、项目分组（加粗的项目名）及其顺序，每个项目组内条目用「1、2、3」从 1 重新编号；',
    '2. 每条仅依据该任务自身的素材（任务名、项目、备注）来写，可适当组织语言说清做了什么、当前状态（已上线/灰度中/待上线/提测中）；备注里没有的细节不要臆测或编造；',
    '3. 提及项目名和事项，不要提个人姓名；',
    '4. 任务名开头可能带内部标记，汇报中一律去掉：日期标记（如「6.10」「6.02」，表示提测日期）、状态标记（如「测试完成」「测试完成-5.27」）；去掉后把剩余任务名表述成通顺的事项；',
    '5. 语气平实专业，不夸大、不堆砌形容词；',
    '6. 直接输出正文，不要署名和客套话。',
    '',
    '---',
    '',
    report,
  ].join('\n');
}
