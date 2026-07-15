import { describe, it, expect } from 'vitest';
import { weekRange, classifyWeekly, buildWeeklyReport, buildWeeklyPrompt } from './weeklyReport';
import type { TaskWithRelations, TaskStatus, TaskType } from '@/types';

let nextId = 1;
function makeTask(over: Partial<TaskWithRelations> & { name: string }): TaskWithRelations {
  return {
    id: nextId++, board_id: 1, parent_id: null, description: '',
    status: '进行中' as TaskStatus, priority: '日常', type: '产品需求' as TaskType,
    project_id: null, owner_id: null, start_date: null,
    estimated_test_date: null, actual_test_date: null,
    estimated_release_date: null, completion_date: null,
    progress: 0, progress_auto: true, story_points: 0, quality_rating: null,
    latest_note: '', project: null, assignees: [], testers: [], owner: null, children: [],
    ...over,
  };
}

// 2026-06-12（周五）∈ ISO W24：6月8日(一)~6月14日(日)；用户样例 6月1日所在周 = W23
const R = weekRange('2026-06-12');

describe('weekRange', () => {
  it('formats the display title in English while preserving the storage key', () => {
    const range = weekRange('2026-06-12', 'en-US');
    expect(range.title).toBe('2026 Week 24 (Jun 8–Jun 14)');
    expect(range.key).toBe('2026-W24');
  });
  it('周一到周日，ISO 周号与用户样例吻合', () => {
    expect(R.start).toBe('2026-06-08');
    expect(R.end).toBe('2026-06-14');
    expect(R.title).toBe('2026年第24周（6月8日-6月14日）');
    expect(R.key).toBe('2026-W24');
    expect(weekRange('2026-06-01').title).toBe('2026年第23周（6月1日-6月7日）');
  });

  it('跨月的周 start/end 各属一个月', () => {
    const r = weekRange('2026-07-01'); // 周三，所在周 6月29日~7月5日
    expect(r.start).toBe('2026-06-29');
    expect(r.end).toBe('2026-07-05');
  });
});

describe('classifyWeekly', () => {
  it('本周完成的任务按类型映射三块：产品需求+toboss→一，功能优化+bug修复→二，基建→三', () => {
    const g = classifyWeekly([
      makeTask({ name: 'A', type: '产品需求', status: '已完成', completion_date: '2026-06-09' }),
      makeTask({ name: 'B', type: 'toboss', status: '已完成', completion_date: '2026-06-09' }),
      makeTask({ name: 'C', type: '功能优化', status: '已完成', completion_date: '2026-06-10' }),
      makeTask({ name: 'D', type: 'bug修复', status: '已完成', completion_date: '2026-06-10' }),
      makeTask({ name: 'E', type: '基建', status: '已完成', completion_date: '2026-06-11' }),
    ], [], R);
    expect(g.product.map((t) => t.name)).toEqual(['A', 'B']);
    expect(g.optimization.map((t) => t.name)).toEqual(['C', 'D']);
    expect(g.infra.map((t) => t.name)).toEqual(['E']);
  });

  it('日常维护、周外完成、非已完成、空名任务不进正文', () => {
    const g = classifyWeekly([
      makeTask({ name: 'F', type: '日常维护', status: '已完成', completion_date: '2026-06-09' }),
      makeTask({ name: 'G', type: '产品需求', status: '已完成', completion_date: '2026-06-07' }),
      makeTask({ name: 'H', type: '产品需求', status: '待上线', completion_date: '2026-06-09' }),
      makeTask({ name: ' ', type: '产品需求', status: '已完成', completion_date: '2026-06-09' }),
    ], [], R);
    expect(g.product).toHaveLength(0);
    expect(g.optimization).toHaveLength(0);
    expect(g.infra).toHaveLength(0);
  });

  it('未完成任务进跟进块：待上线排前；进行中且已提测进提测子块', () => {
    const g = classifyWeekly([], [
      makeTask({ name: '进行中甲', status: '进行中' }),
      makeTask({ name: '待上线乙', status: '待上线' }),
      makeTask({ name: '提测中丙', status: '进行中', actual_test_date: '2026-06-10' }),
    ], R);
    expect(g.followUp.map((t) => t.name)).toEqual(['待上线乙', '进行中甲']);
    expect(g.testing.map((t) => t.name)).toEqual(['提测中丙']);
  });
});

describe('buildWeeklyReport', () => {
  it('generates English section copy without translating task and project names', () => {
    const range = weekRange('2026-06-12', 'en-US');
    const md = buildWeeklyReport(range, classifyWeekly([
      makeTask({ name: '登录优化', type: '产品需求', status: '已完成', completion_date: '2026-06-09' }),
    ], [], range), 'en-US');
    expect(md).toContain('Engineering Weekly Report');
    expect(md).toContain('## 1. Product Releases (1)');
    expect(md).toContain('1. 登录优化');
  });
  it('四块结构，块内按项目分组，备注拼在条目后', () => {
    const md = buildWeeklyReport(R, classifyWeekly([
      makeTask({ name: '功能甲', type: '产品需求', status: '已完成', completion_date: '2026-06-09', project: { id: 1, name: 'Dreamface' }, latest_note: '已全量' }),
      makeTask({ name: '功能乙', type: '基建', status: '已完成', completion_date: '2026-06-10' }),
    ], [
      makeTask({ name: '功能丙', status: '待上线', latest_note: '周一发布' }),
      makeTask({ name: '功能丁', status: '进行中', actual_test_date: '2026-06-11' }),
    ], R));
    expect(md).toContain('# 2026年第24周（6月8日-6月14日）研发周报');
    expect(md).toContain('## 一、产品需求上线（1 项）');
    expect(md).toContain('**Dreamface**\n1、功能甲：已全量');
    expect(md).not.toContain('二、性能优化与问题修复'); // 空块跳过
    expect(md).toContain('## 三、架构迁移与基建优化（1 项）');
    expect(md).toContain('**其他**\n1、功能乙');
    expect(md).toContain('## 四、PM重点关注与后续跟进（下周备忘）');
    expect(md).toContain('1、功能丙：周一发布');
    expect(md).toContain('### 提测/测试中的需求');
    expect(md).toContain('1、功能丁');
  });

  it('项目顺序 Dreamface→Agent→DreamAPI→其他项目→无项目，组内按优先级排序且编号从 1 重起', () => {
    const PD = { id: 1, name: 'Dreamface' };
    const PA = { id: 2, name: 'Agent' };
    const PS = { id: 4, name: 'SEO' };
    const md = buildWeeklyReport(R, classifyWeekly([
      makeTask({ name: 'SEO需求', type: '产品需求', status: '已完成', completion_date: '2026-06-09', project: PS }),
      makeTask({ name: '聊天功能', type: '产品需求', status: '已完成', completion_date: '2026-06-09', project: PA, priority: '日常' }),
      makeTask({ name: '普通需求', type: '产品需求', status: '已完成', completion_date: '2026-06-09', project: PD, priority: '日常' }),
      makeTask({ name: '无项目需求', type: '产品需求', status: '已完成', completion_date: '2026-06-09' }),
      makeTask({ name: '紧急需求', type: '产品需求', status: '已完成', completion_date: '2026-06-09', project: PD, priority: '紧急' }),
    ], [], R));
    const at = (s: string) => md.indexOf(s);
    expect(at('**Dreamface**')).toBeGreaterThan(-1);
    expect(at('**Dreamface**')).toBeLessThan(at('**Agent**'));
    expect(at('**Agent**')).toBeLessThan(at('**SEO**'));
    expect(at('**SEO**')).toBeLessThan(at('**其他**'));
    // Dreamface 组内：紧急在前、日常在后；Agent 组编号重新从 1 起
    expect(md).toContain('**Dreamface**\n1、紧急需求\n2、普通需求');
    expect(md).toContain('**Agent**\n1、聊天功能');
  });

  it('全空显示空态文案', () => {
    const md = buildWeeklyReport(R, classifyWeekly([], [], R));
    expect(md).toContain('本周暂无可汇报的进展');
  });
});

describe('buildWeeklyPrompt', () => {
  it('明确约束中英文输出语言', () => {
    expect(buildWeeklyPrompt('# 周报', 'zh-CN')).toContain('必须使用简体中文');
    expect(buildWeeklyPrompt('# Weekly', 'en-US')).toContain('must be written in English');
  });

  it('包含清单原文、保留分块要求与不点名要求', () => {
    const p = buildWeeklyPrompt('# 周报\n1、功能甲');
    expect(p).toContain('1、功能甲');
    expect(p).toContain('不要提个人姓名');
    expect(p).toContain('1、2、3');
  });

  it('要求去掉任务名开头的内部标记', () => {
    const p = buildWeeklyPrompt('# 周报\n1、测试完成-5.27 功能甲');
    expect(p).toContain('内部标记');
    expect(p).toContain('「6.10」');
    expect(p).toContain('「测试完成」');
  });

  it('禁止新增清单之外的任务或分类块', () => {
    const p = buildWeeklyPrompt('# 周报\n1、功能甲');
    expect(p).toContain('严禁新增');
  });
});
