import { describe, it, expect } from 'vitest';
import { generateMonthlyReport, applyAiSummary, boldNames, buildSummaryPrompt, SUMMARY_PLACEHOLDER } from './report';
import { computeDelays } from './delay';
import type { TaskWithRelations, TaskStatus, TaskType } from '@/types';

let nextId = 1;
function makeTask(over: Partial<TaskWithRelations> & { name: string }): TaskWithRelations {
  return {
    id: nextId++,
    board_id: 1,
    parent_id: null,
    description: '',
    status: '进行中' as TaskStatus,
    priority: '日常',
    type: '产品需求' as TaskType,
    project_id: null,
    owner_id: null,
    start_date: null,
    estimated_test_date: null,
    actual_test_date: null,
    estimated_release_date: null,
    completion_date: null,
    progress: 0,
    progress_auto: true,
    story_points: 0,
    quality_rating: null,
    latest_note: '',
    project: null,
    assignees: [],
    testers: [],
    owner: null,
    children: [],
    ...over,
  };
}

const TODAY = '2026-06-10';
const OPTS = { today: TODAY };

describe('computeDelays', () => {
  it('进行中 + 预估提测已过未提测 → 未提测', () => {
    const d = computeDelays([makeTask({ name: 'A', status: '进行中', estimated_test_date: '2026-06-05' })], TODAY);
    expect(d).toHaveLength(1);
    expect(d[0].reason).toBe('未提测');
    expect(d[0].delayDays).toBe(5);
  });

  it('已完成 + 完成晚于评估上线 → 延迟完成', () => {
    const d = computeDelays([makeTask({
      name: 'B', status: '已完成', completion_date: '2026-06-08', estimated_release_date: '2026-06-01',
    })], TODAY);
    expect(d[0].reason).toBe('延迟完成');
    expect(d[0].delayDays).toBe(7);
  });

  it('正常任务不计延期，结果按延期天数降序', () => {
    const d = computeDelays([
      makeTask({ name: '正常', status: '已完成', completion_date: '2026-06-01', estimated_release_date: '2026-06-05' }),
      makeTask({ name: '小延', status: '进行中', estimated_test_date: '2026-06-08' }),
      makeTask({ name: '大延', status: '进行中', estimated_test_date: '2026-06-01' }),
    ], TODAY);
    expect(d.map((x) => x.task.name)).toEqual(['大延', '小延']);
  });
});

describe('generateMonthlyReport', () => {
  it('generates English management sections while preserving task names', () => {
    const md = generateMonthlyReport('2026-06', [makeTask({ name: '登录优化' })], { ...OPTS, locale: 'en-US' });
    expect(md).toContain('# Engineering Monthly Report · June 2026');
    expect(md).toContain('## 1. Management Summary');
    expect(md).toContain('登录优化');
  });
  it('标题包含年月', () => {
    const md = generateMonthlyReport('2026-06', [], OPTS);
    expect(md).toContain('# 研发月报 · 2026 年 6 月');
  });

  it('概览为横向表：指标行、状态分布、类型分布', () => {
    const md = generateMonthlyReport('2026-06', [
      makeTask({ name: 'A', status: '已完成', assignees: [{ id: 1, name: '张三', role: 'dev' }] }),
      makeTask({ name: 'B', status: '进行中', assignees: [{ id: 2, name: '李四', role: 'dev' }] }),
    ], OPTS);
    expect(md).toContain('| 任务总数 | 已完成 | 完成准时率 | 延期任务 | 参与人数 |');
    expect(md).toContain('| 2 | 1（50.0%） | 100.0% | 0 | 2 |');
    expect(md).toContain('| 进行中 | 已完成 |'); // 状态分布横向表头
    expect(md).toContain('| 1（50.0%） | 1（50.0%） |');
    expect(md).toContain('| 产品需求 |'); // 类型分布
    expect(md).toContain('| 2（100.0%） |');
  });

  it('无延期时输出说明，有延期时生成表格和人员聚合', () => {
    const ok = generateMonthlyReport('2026-06', [makeTask({ name: 'A' })], OPTS);
    expect(ok).toContain('本月无延期任务');

    const md = generateMonthlyReport('2026-06', [
      makeTask({
        name: '迟', status: '进行中', estimated_test_date: '2026-06-05',
        assignees: [{ id: 1, name: '张三', role: 'dev' }],
      }),
    ], OPTS);
    expect(md).toContain('| 迟 | 产品需求 | 张三 | 未提测 5 天 |');
    expect(md).toContain('涉及人员：张三（1 项 / 累计 5 天）');
  });

  it('人员负载表统计全量任务并按任务数排序，列出无任务成员', () => {
    const md = generateMonthlyReport('2026-06', [
      makeTask({
        name: 'A', status: '已完成', story_points: 2, quality_rating: 8,
        assignees: [{ id: 1, name: '张三', role: 'dev' }],
      }),
      makeTask({
        name: 'B', status: '进行中', story_points: 4,
        assignees: [{ id: 1, name: '张三', role: 'dev' }],
      }),
      makeTask({
        name: 'C', status: '已完成', story_points: 1, quality_rating: 9,
        assignees: [{ id: 2, name: '李四', role: 'dev' }],
      }),
    ], { today: TODAY, members: [
      { id: 1, name: '张三' }, { id: 2, name: '李四' }, { id: 3, name: '王五' },
    ] });
    // 张三：2 任务（1 进行中 1 完成），工时 6，均工时 3，总分 8
    expect(md).toContain('| 张三 | 2 | 1 | 1 | 6.0 | 3.0 | 8 | 8.0 |');
    expect(md).toContain('| 李四 | 1 | 0 | 1 | 1.0 | 1.0 | 9 | 9.0 |');
    expect(md.indexOf('| 张三 |')).toBeLessThan(md.indexOf('| 李四 |'));
    expect(md).toContain('本月无任务安排：王五');
  });

  it('分类明细：已完成带 ✅ 排前，进行中带进度，子任务嵌套', () => {
    const md = generateMonthlyReport('2026-06', [
      makeTask({
        name: '在研', status: '进行中', progress: 60,
        children: [makeTask({ name: '子', status: '已完成' })],
      }),
      makeTask({ name: '完成', status: '已完成' }),
    ], OPTS);
    expect(md).toContain('- **在研** — 进行中 60%');
    expect(md).toContain('  - ✅ **子**');
    expect(md.indexOf('✅ **完成**')).toBeLessThan(md.indexOf('**在研**'));
  });

  it('空名称任务被忽略', () => {
    const md = generateMonthlyReport('2026-06', [
      makeTask({ name: '  ' }),
      makeTask({ name: '有名字' }),
    ], OPTS);
    expect(md).toContain('| 1 | 0（0.0%） | - | 0 | 0 |');
  });

  it('管理总结占位在开头（概览之前）', () => {
    const md = generateMonthlyReport('2026-06', [makeTask({ name: 'A' })], OPTS);
    expect(md).toContain('## 一、管理总结');
    expect(md.indexOf(SUMMARY_PLACEHOLDER)).toBeLessThan(md.indexOf('本月概览'));
  });
});

describe('boldNames', () => {
  it('人名加粗，已加粗的不重复处理', () => {
    const out = boldNames('张三延期较多，**李四**正常。', ['张三', '李四']);
    expect(out).toBe('**张三**延期较多，**李四**正常。');
  });

  it('长名优先，短名不破坏长名', () => {
    const out = boldNames('张三丰本月无产出。', ['张三', '张三丰']);
    expect(out).toBe('**张三丰**本月无产出。');
  });

  it('同名多次出现都加粗', () => {
    const out = boldNames('张三 A 任务、张三 B 任务。', ['张三']);
    expect(out).toBe('**张三** A 任务、**张三** B 任务。');
  });
});

describe('applyAiSummary', () => {
  it('替换占位行为正文（不带引用前缀）', () => {
    const report = generateMonthlyReport('2026-06', [makeTask({ name: 'A' })], OPTS);
    const out = applyAiSummary(report, '本月重心在基建。\n\n- **张三**需关注');
    expect(out).not.toContain(SUMMARY_PLACEHOLDER);
    expect(out).toContain('本月重心在基建。');
    expect(out).toContain('- **张三**需关注');
    expect(out).not.toContain('> 本月重心');
  });

  it('无占位时追加 AI 总结章节', () => {
    const out = applyAiSummary('# 自定义内容\n', '总结正文');
    expect(out).toContain('## AI 总结');
    expect(out).toContain('总结正文');
  });
});

describe('buildSummaryPrompt', () => {
  it('明确约束中英文输出语言', () => {
    expect(buildSummaryPrompt('# 月报', 'zh-CN')).toContain('必须使用简体中文');
    expect(buildSummaryPrompt('# Monthly', 'en-US')).toContain('must be written in English');
  });

  it('包含月报原文', () => {
    const p = buildSummaryPrompt('# 研发月报\n概览数据');
    expect(p).toContain('概览数据');
  });

  it('禁止编造数据外的事实，不臆测延期原因，不下跨月「长期」判断', () => {
    const p = buildSummaryPrompt('# 研发月报');
    expect(p).toContain('严禁编造');
    expect(p).toContain('延期原因'); // 数据无原因，须明示不臆测
    expect(p).not.toContain('给出具体原因'); // 旧诱导编造的措辞已移除
    expect(p).not.toContain('长期只做'); // 单月数据不支持「长期」判断
  });
});
