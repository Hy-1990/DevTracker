import {
  TASK_TYPES, TASK_STATUSES, getDelayStatus,
  type TaskWithRelations, type TaskStatus,
} from '@/types';
import { computeDelays } from '@/utils/delay';
import type { SupportedLocale } from '@/i18n';
import { translateDelayReason, translateStatus, translateTaskType } from '@/i18n/domain';

const CN_NUMS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

/** 汇报中状态的展示顺序：成果在前，在研居中，停滞垫底 */
const REPORT_STATUS_ORDER: TaskStatus[] = ['已完成', '待上线', '进行中', '待开始', '已停滞'];

/** AI 总结的占位标记，生成 AI 内容时替换它 */
export const SUMMARY_PLACEHOLDER = '（点击「AI 总结」自动生成，或在此手动撰写本月重点与风险）';
export const EN_SUMMARY_PLACEHOLDER = '(Generate an AI summary or write this month’s highlights and risks here.)';

function pct(n: number, total: number): string {
  return total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '-';
}

function names(t: TaskWithRelations): string {
  return t.assignees.map((a) => a.name).join('、') || '-';
}

function formatTaskLine(t: TaskWithRelations): string {
  const people = t.assignees.map((a) => a.name).join('、');
  const who = people ? `（${people}）` : '';
  const delay = getDelayStatus(t);

  if (t.status === '已完成') {
    const tail = delay === '延迟完成' ? '，延迟完成' : '';
    return `✅ **${t.name}**${who}${tail}`;
  }
  if (t.status === '进行中') {
    const progress = t.progress > 0 ? ` ${t.progress}%` : '';
    const tail = delay === '提测延期' ? '，提测延期' : '';
    return `**${t.name}**${who} — 进行中${progress}${tail}`;
  }
  return `**${t.name}**${who} — ${t.status}`;
}

function sortForReport(tasks: TaskWithRelations[]): TaskWithRelations[] {
  const order = new Map(REPORT_STATUS_ORDER.map((s, i) => [s, i]));
  return [...tasks].sort(
    (a, b) => (order.get(a.status) ?? 9) - (order.get(b.status) ?? 9)
  );
}

export interface ReportOptions {
  /** 注入“今天”，便于测试延期计算 */
  today?: string;
  /** 全体开发成员，用于找出无任务安排的人 */
  members?: { id: number; name: string }[];
  /** 固定报告模板语言；用户填写的业务内容保持原文 */
  locale?: SupportedLocale;
}

/**
 * 从月度表任务生成 Markdown 月报：
 * 管理总结占位 → 概览统计 → 延期分析 → 人员负载与产出 → 分类明细。
 */
export function generateMonthlyReport(
  yearMonth: string,
  tasks: TaskWithRelations[],
  opts: ReportOptions = {}
): string {
  const { today, members = [], locale = 'zh-CN' } = opts;
  if (locale === 'en-US') return generateEnglishMonthlyReport(yearMonth, tasks, today, members);
  const [y, m] = yearMonth.split('-');
  const title = y && m
    ? `# 研发月报 · ${y} 年 ${Number(m)} 月`
    : `# 研发月报 · ${yearMonth}`;

  const named = tasks.filter((t) => t.name.trim());
  const all: TaskWithRelations[] = [];
  for (const t of named) {
    all.push(t);
    for (const c of t.children) if (c.name.trim()) all.push(c);
  }

  const total = all.length;
  const byStatus = (s: TaskStatus) => all.filter((t) => t.status === s);
  const completed = byStatus('已完成');
  const delays = computeDelays(all, today);
  const people = new Set(all.flatMap((t) => t.assignees.map((a) => a.id)));
  const completedOnTime = completed.filter((t) => getDelayStatus(t) === '正常').length;

  const lines: string[] = [title, ''];
  const sec = (i: number, name: string) => `## ${CN_NUMS[i] ?? i + 1}、${name}`;
  let si = 0;

  // ── 管理总结（置顶，AI 生成或手动撰写）──
  lines.push(sec(si++, '管理总结'), '');
  lines.push(`> ${SUMMARY_PLACEHOLDER}`, '');

  // ── 概览（横向表格，避免窄表竖排）──
  lines.push(sec(si++, '本月概览'), '');
  lines.push('| 任务总数 | 已完成 | 完成准时率 | 延期任务 | 参与人数 |');
  lines.push('| :---: | :---: | :---: | :---: | :---: |');
  lines.push(
    `| ${total} | ${completed.length}（${pct(completed.length, total)}） | ` +
    `${pct(completedOnTime, completed.length)} | ${delays.length} | ${people.size} |`
  );
  lines.push('');

  const statusCols = TASK_STATUSES.filter((s) => byStatus(s).length > 0);
  if (statusCols.length > 0) {
    lines.push('**状态分布**', '');
    lines.push(`| ${statusCols.join(' | ')} |`);
    lines.push(`|${statusCols.map(() => ' :---: ').join('|')}|`);
    lines.push(`| ${statusCols.map((s) => `${byStatus(s).length}（${pct(byStatus(s).length, total)}）`).join(' | ')} |`);
    lines.push('');
  }

  const typeCols = TASK_TYPES.filter((tp) => all.some((t) => t.type === tp));
  if (typeCols.length > 0) {
    lines.push('**类型分布**', '');
    lines.push(`| ${typeCols.join(' | ')} |`);
    lines.push(`|${typeCols.map(() => ' :---: ').join('|')}|`);
    lines.push(`| ${typeCols.map((tp) => {
      const n = all.filter((t) => t.type === tp).length;
      return `${n}（${pct(n, total)}）`;
    }).join(' | ')} |`);
    lines.push('');
  }

  // ── 延期分析 ──
  lines.push(sec(si++, '延期分析'), '');
  if (delays.length === 0) {
    lines.push('本月无延期任务。', '');
  } else {
    lines.push('| 任务 | 类型 | 执行人 | 延期情况 |');
    lines.push('| --- | --- | --- | --- |');
    for (const d of delays) {
      lines.push(`| ${d.task.name} | ${d.task.type} | ${names(d.task)} | ${d.reason} ${d.delayDays} 天 |`);
    }
    // 按人聚合
    const byPerson = new Map<string, { count: number; days: number }>();
    for (const d of delays) {
      for (const a of d.task.assignees) {
        const r = byPerson.get(a.name) ?? { count: 0, days: 0 };
        r.count++; r.days += d.delayDays;
        byPerson.set(a.name, r);
      }
    }
    if (byPerson.size > 0) {
      const agg = [...byPerson.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .map(([n, r]) => `${n}（${r.count} 项 / 累计 ${r.days} 天）`)
        .join('，');
      lines.push('', `涉及人员：${agg}`);
    }
    lines.push('');
  }

  // ── 人员负载与产出（全量任务，供任务量/难度分析）──
  lines.push(sec(si++, '人员负载与产出'), '');
  interface Load {
    id: number; name: string;
    total: number; doing: number; done: number;
    points: number; scores: number[];
  }
  const loads = new Map<number, Load>();
  for (const t of all) {
    for (const a of t.assignees) {
      const r = loads.get(a.id) ?? { id: a.id, name: a.name, total: 0, doing: 0, done: 0, points: 0, scores: [] };
      r.total++;
      r.points += t.story_points;
      if (t.status === '进行中') r.doing++;
      if (t.status === '已完成') {
        r.done++;
        if (t.quality_rating != null) r.scores.push(t.quality_rating);
      }
      loads.set(a.id, r);
    }
  }
  if (loads.size === 0) {
    lines.push('本月暂无人员任务记录。', '');
  } else {
    const rows = [...loads.values()].sort((a, b) => b.total - a.total || b.points - a.points);
    lines.push('| 成员 | 任务数 | 进行中 | 已完成 | 工时合计 | 单任务均工时 | 质量总分 | 均分 |');
    lines.push('| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |');
    for (const r of rows) {
      const totalScore = r.scores.reduce((a, b) => a + b, 0);
      const avg = r.scores.length > 0 ? (totalScore / r.scores.length).toFixed(1) : '-';
      const avgPoints = r.total > 0 ? (r.points / r.total).toFixed(1) : '-';
      lines.push(
        `| ${r.name} | ${r.total} | ${r.doing} | ${r.done} | ${r.points.toFixed(1)} | ${avgPoints} | ${totalScore || '-'} | ${avg} |`
      );
    }
    lines.push('');
  }
  const idle = members.filter((m) => !loads.has(m.id));
  if (idle.length > 0) {
    lines.push(`本月无任务安排：${idle.map((m) => m.name).join('、')}`, '');
  }

  // ── 分类明细 ──
  lines.push(sec(si++, '分类明细'), '');
  for (const type of TASK_TYPES) {
    const group = named.filter((t) => t.type === type);
    if (group.length === 0) continue;
    lines.push(`### ${type}（${group.length} 项）`, '');
    for (const t of sortForReport(group)) {
      lines.push(`- ${formatTaskLine(t)}`);
      for (const c of t.children) {
        if (c.name.trim()) lines.push(`  - ${formatTaskLine(c)}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

function generateEnglishMonthlyReport(
  yearMonth: string,
  tasks: TaskWithRelations[],
  today: string | undefined,
  members: { id: number; name: string }[],
): string {
  const [year, month] = yearMonth.split('-');
  const monthName = year && month
    ? new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(Number(year), Number(month) - 1, 1)))
    : yearMonth;
  const title = year && month ? `# Engineering Monthly Report · ${monthName} ${year}` : `# Engineering Monthly Report · ${yearMonth}`;
  const named = tasks.filter((task) => task.name.trim());
  const all = named.flatMap((task) => [task, ...task.children.filter((child) => child.name.trim())]);
  const completed = all.filter((task) => task.status === '已完成');
  const delays = computeDelays(all, today);
  const people = new Set(all.flatMap((task) => task.assignees.map((person) => person.id)));
  const completedOnTime = completed.filter((task) => getDelayStatus(task) === '正常').length;
  const lines: string[] = [title, '', '## 1. Management Summary', '', `> ${EN_SUMMARY_PLACEHOLDER}`, ''];

  lines.push('## 2. Monthly Overview', '');
  lines.push('| Total Tasks | Completed | On-time Completion | Delayed Tasks | Contributors |');
  lines.push('| :---: | :---: | :---: | :---: | :---: |');
  lines.push(`| ${all.length} | ${completed.length} (${pct(completed.length, all.length)}) | ${pct(completedOnTime, completed.length)} | ${delays.length} | ${people.size} |`, '');

  const statuses = TASK_STATUSES.filter((status) => all.some((task) => task.status === status));
  if (statuses.length) {
    lines.push('**Status Distribution**', '', `| ${statuses.map((status) => translateStatus(status, 'en-US')).join(' | ')} |`);
    lines.push(`|${statuses.map(() => ' :---: ').join('|')}|`);
    lines.push(`| ${statuses.map((status) => {
      const count = all.filter((task) => task.status === status).length;
      return `${count} (${pct(count, all.length)})`;
    }).join(' | ')} |`, '');
  }

  lines.push('## 3. Delay Analysis', '');
  if (!delays.length) lines.push('No delayed tasks this month.', '');
  else {
    lines.push('| Task | Type | Assignees | Delay |', '| --- | --- | --- | --- |');
    delays.forEach((delay) => lines.push(`| ${delay.task.name} | ${translateTaskType(delay.task.type, 'en-US')} | ${delay.task.assignees.map((person) => person.name).join(', ') || '-'} | ${translateDelayReason(delay.reason, 'en-US')} — ${delay.delayDays} days |`));
    lines.push('');
  }

  lines.push('## 4. Team Workload and Output', '');
  const loads = new Map<number, { name: string; total: number; active: number; done: number; points: number }>();
  all.forEach((task) => task.assignees.forEach((person) => {
    const item = loads.get(person.id) ?? { name: person.name, total: 0, active: 0, done: 0, points: 0 };
    item.total += 1; item.points += task.story_points;
    if (task.status === '进行中') item.active += 1;
    if (task.status === '已完成') item.done += 1;
    loads.set(person.id, item);
  }));
  if (!loads.size) lines.push('No assigned tasks this month.', '');
  else {
    lines.push('| Team Member | Tasks | In Progress | Completed | Total Effort |', '| --- | :---: | :---: | :---: | :---: |');
    [...loads.values()].sort((a, b) => b.total - a.total).forEach((item) => lines.push(`| ${item.name} | ${item.total} | ${item.active} | ${item.done} | ${item.points.toFixed(1)} |`));
    lines.push('');
  }
  const idle = members.filter((member) => !loads.has(member.id));
  if (idle.length) lines.push(`No tasks assigned this month: ${idle.map((member) => member.name).join(', ')}`, '');

  lines.push('## 5. Details by Type', '');
  TASK_TYPES.forEach((type) => {
    const group = named.filter((task) => task.type === type);
    if (!group.length) return;
    lines.push(`### ${translateTaskType(type, 'en-US')} (${group.length})`, '');
    sortForReport(group).forEach((task) => {
      const assignees = task.assignees.map((person) => person.name).join(', ');
      const progress = task.status === '进行中' && task.progress ? ` ${task.progress}%` : '';
      lines.push(`- **${task.name}**${assignees ? ` (${assignees})` : ''} — ${translateStatus(task.status, 'en-US')}${progress}`);
      task.children.filter((child) => child.name.trim()).forEach((child) => lines.push(`  - **${child.name}** — ${translateStatus(child.status, 'en-US')}`));
    });
    lines.push('');
  });
  return lines.join('\n').trimEnd() + '\n';
}

/** 把 AI 生成的总结写入月报：作为正文（非引用块）替换占位行，否则追加到文末 */
export function applyAiSummary(report: string, summary: string): string {
  const body = summary.trim();
  if (report.includes(`> ${SUMMARY_PLACEHOLDER}`)) {
    return report.replace(`> ${SUMMARY_PLACEHOLDER}`, body);
  }
  if (report.includes(`> ${EN_SUMMARY_PLACEHOLDER}`)) {
    return report.replace(`> ${EN_SUMMARY_PLACEHOLDER}`, body);
  }
  const title = report.startsWith('# Engineering') ? 'AI Summary' : 'AI 总结';
  return `${report.trimEnd()}\n\n## ${title}\n\n${body}\n`;
}

/** 把人名加粗（跳过已加粗的，长名优先避免嵌套） */
export function boldNames(text: string, names: string[]): string {
  let out = text;
  const sorted = [...new Set(names)]
    .filter((n) => n.trim())
    .sort((a, b) => b.length - a.length);
  for (const n of sorted) {
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`(?<!\\*)${esc}(?!\\*)`, 'g'), `**${n}**`);
  }
  return out;
}

/** 构造给 DeepSeek 的提示词：高级研发管理者的多维度月度盘点 */
export function buildSummaryPrompt(report: string, locale: SupportedLocale = 'zh-CN'): string {
  if (locale === 'en-US') {
    return [
      'You are an engineering director. Review the monthly engineering report below and produce an evidence-based management summary.',
      'Output language is mandatory: the entire response must be written in English, even when task or project names contain Chinese.',
      'The month may still be in progress. Never invent causes, facts, or long-term patterns that are not present in the report.', '',
      'Cover delivery mix and pace, workload and quality by named team member, material delays or imbalances, and 2–3 concrete management actions.',
      'Bold every person name with Markdown. Write 250–400 words in professional English and return only the body.',
      '', '---', '', report,
    ].join('\n');
  }
  return [
    '你是一名高级研发管理者（研发总监），请基于下面这份研发月报数据做一次管理盘点。',
    '输出语言是硬性要求：全部内容必须使用简体中文，即使任务名或项目名包含英文，也不能改用英文撰写。',
    '注意：当月可能尚未结束，请基于当前进度分析，不要因数据不完整而回避结论。',
    '底线：所有结论必须有月报数据支撑，严禁编造数据中不存在的事实；数据里没有的信息（如延期原因、任务停滞的缘由、个人的具体情况、跨月的长期表现）不要臆测，只能就数据可见的现象下判断。要求：',
    '',
    '1. 任务安排盘点：本月任务结构（产品需求 vs 技术投入的占比与侧重）、整体进度节奏是否健康；',
    '2. 人员盘点（重点，结合「人员负载与产出」「延期分析」两张表，逐条点名，不要含糊）：',
    '   - 任务量：谁无任务安排或任务明显偏少、谁负载过重需要分流；',
    '   - 任务含金量：结合单任务均工时和任务类型，指出本月集中在低难度任务（如日常维护、bug 修复、低工时任务）的人；',
    '   - 重点关注：延期集中、任务停滞、产出与质量明显落后的人，指出数据上的表现（延期项数/天数、停滞数量、质量分），不要替他们臆测原因；',
    '   - 重点培养：产出量大、质量分高、承担高难度任务的人，建议如何加担子；',
    '3. 给出 2-3 条下一步的管理动作建议（建议属于你的判断，可基于数据合理提出）；',
    '4. 所有提到的人名一律用 Markdown 加粗，如 **张三**；',
    '5. 中文，300-500 字，建议按「整体 / 人员 / 建议」分小段，直接输出正文，不要标题、不要客套话。',
    '',
    '---',
    '',
    report,
  ].join('\n');
}
