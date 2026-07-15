import type { TaskWithRelations } from '@/types';
import type { SupportedLocale } from '@/i18n';

export interface DailyGroups {
  /** 今日上线：已完成 且 完成日期=当天 */
  released: TaskWithRelations[];
  /** 完成测试、待上线：待上线 且 完成日期=当天 */
  readyToRelease: TaskWithRelations[];
  /** 今日完成提测：实际提测日期=当天 */
  tested: TaskWithRelations[];
}

/** 三类互斥，按最终态优先归类（上线 > 待上线 > 提测），空名任务排除 */
export function classifyDaily(tasks: TaskWithRelations[], date: string): DailyGroups {
  const groups: DailyGroups = { released: [], readyToRelease: [], tested: [] };
  for (const t of tasks) {
    if (!t.name.trim()) continue;
    if (t.status === '已完成' && t.completion_date === date) groups.released.push(t);
    else if (t.status === '待上线' && t.completion_date === date) groups.readyToRelease.push(t);
    else if (t.actual_test_date === date) groups.tested.push(t);
  }
  return groups;
}

function taskLine(t: TaskWithRelations): string {
  return t.project ? `${t.name}（${t.project.name}）` : t.name;
}

export function isDailyEmpty(groups: DailyGroups): boolean {
  return groups.released.length + groups.readyToRelease.length + groups.tested.length === 0;
}

/** 生成日报清单 Markdown；全空时返回空态文案 */
export function buildDailyReport(date: string, groups: DailyGroups, locale: SupportedLocale = 'zh-CN'): string {
  const english = locale === 'en-US';
  const lines: string[] = [english ? `# Engineering Daily · ${date}` : `# 研发日报 · ${date}`, ''];
  if (isDailyEmpty(groups)) {
    lines.push(english ? 'No reportable progress today.' : '今日暂无可汇报的进展。');
    return lines.join('\n') + '\n';
  }
  const sections: [string, TaskWithRelations[]][] = [
    [english ? 'Released Today' : '今日上线', groups.released],
    [english ? 'Tested and Ready to Release' : '完成测试、待上线', groups.readyToRelease],
    [english ? 'Sent to Testing Today' : '今日完成提测', groups.tested],
  ];
  for (const [title, list] of sections) {
    if (list.length === 0) continue;
    lines.push(english ? `## ${title} (${list.length})` : `## ${title}（${list.length} 项）`, '');
    list.forEach((task, index) => lines.push(english ? `${index + 1}. ${taskLine(task)}` : `${index + 1}、${taskLine(task)}`));
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}

/** 构造给 DeepSeek 的提示词：研发负责人给领导的当日进度汇报 */
export function buildDailyPrompt(report: string, locale: SupportedLocale = 'zh-CN'): string {
  if (locale === 'en-US') {
    return [
      'You are an engineering lead. Turn the daily engineering checklist below into a concise progress update for leadership.',
      'Output language is mandatory: the entire response must be written in English, even when task or project names contain Chinese.',
      '',
      '1. Use only tasks and sections present in the checklist. Never invent work or details.',
      '2. Preserve section order and restart numbering in each section. One checklist task must remain one report item.',
      '3. Remove internal date or test-status prefixes from task names. Keep project names and omit personal names.',
      '4. Use direct, professional English. Return only the report body.',
      '', '---', '', report,
    ].join('\n');
  }
  return [
    '你是一名研发负责人，请把下面的研发日报清单整理成发给领导的当日进度汇报。要求：',
    '输出语言是硬性要求：全部内容必须使用简体中文，即使任务名或项目名包含英文，也不能改用英文撰写。',
    '',
    '1. 只整理清单中已有的任务，严禁新增或编造任何清单里没有的任务；清单里没有出现的分类块，结果中也不要出现；',
    '2. 按清单原有的分类块和顺序输出，每块内条目用「1、2、3」从 1 重新编号；每条只对应清单中的一个任务，忠实复述，不要扩写、不要臆测任务具体做了什么；',
    '3. 任务名开头可能带内部标记，一律去掉：日期标记（如「6.10」「6.02」，表示提测日期）、状态标记（如「测试完成」「测试完成-5.27」）；保留项目名，不要提个人姓名；',
    '4. 语气平实专业；直接输出正文，不要标题、署名和客套话。',
    '',
    '---',
    '',
    report,
  ].join('\n');
}
