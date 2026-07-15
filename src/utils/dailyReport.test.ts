import { describe, it, expect } from 'vitest';
import { classifyDaily, buildDailyReport, buildDailyPrompt } from './dailyReport';
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

const D = '2026-06-12';

describe('classifyDaily', () => {
  it('已完成 + 完成日期=当天 → 今日上线', () => {
    const g = classifyDaily([makeTask({ name: 'A', status: '已完成', completion_date: D })], D);
    expect(g.released.map((t) => t.name)).toEqual(['A']);
    expect(g.readyToRelease).toHaveLength(0);
    expect(g.tested).toHaveLength(0);
  });

  it('待上线 + 完成日期=当天 → 完成测试待上线', () => {
    const g = classifyDaily([makeTask({ name: 'B', status: '待上线', completion_date: D })], D);
    expect(g.readyToRelease.map((t) => t.name)).toEqual(['B']);
  });

  it('实际提测日期=当天（任意状态）→ 今日完成提测', () => {
    const g = classifyDaily([makeTask({ name: 'C', status: '进行中', actual_test_date: D })], D);
    expect(g.tested.map((t) => t.name)).toEqual(['C']);
  });

  it('互斥最终态优先：今天提测且今天上线 → 只归今日上线', () => {
    const g = classifyDaily(
      [makeTask({ name: 'D', status: '已完成', completion_date: D, actual_test_date: D })],
      D
    );
    expect(g.released).toHaveLength(1);
    expect(g.tested).toHaveLength(0);
  });

  it('待上线且今天提测今天完成测试 → 只归待上线', () => {
    const g = classifyDaily(
      [makeTask({ name: 'E', status: '待上线', completion_date: D, actual_test_date: D })],
      D
    );
    expect(g.readyToRelease).toHaveLength(1);
    expect(g.tested).toHaveLength(0);
  });

  it('日期不匹配、空名任务一律排除', () => {
    const g = classifyDaily(
      [
        makeTask({ name: 'F', status: '已完成', completion_date: '2026-06-11' }),
        makeTask({ name: '  ', status: '已完成', completion_date: D }),
      ],
      D
    );
    expect(g.released).toHaveLength(0);
    expect(g.readyToRelease).toHaveLength(0);
    expect(g.tested).toHaveLength(0);
  });
});

describe('buildDailyReport', () => {
  it('generates fixed report copy in English without translating task data', () => {
    const md = buildDailyReport(D, classifyDaily([
      makeTask({ name: '登录优化', status: '已完成', completion_date: D }),
    ], D), 'en-US');
    expect(md).toContain(`# Engineering Daily · ${D}`);
    expect(md).toContain('## Released Today (1)');
    expect(md).toContain('1. 登录优化');
  });
  it('三小节按序输出，每小节内从 1 重新编号，任务行为「任务名（项目）」', () => {
    const md = buildDailyReport(D, classifyDaily([
      makeTask({ name: '功能甲', status: '已完成', completion_date: D, project: { id: 1, name: '项目X' } }),
      makeTask({ name: '功能乙', status: '待上线', completion_date: D }),
      makeTask({ name: '功能丙', status: '进行中', actual_test_date: D }),
    ], D));
    expect(md).toContain(`# 研发日报 · ${D}`);
    expect(md).toContain('## 今日上线（1 项）');
    expect(md).toContain('1、功能甲（项目X）');
    expect(md).toContain('## 完成测试、待上线（1 项）');
    expect(md).toContain('1、功能乙');
    expect(md).toContain('## 今日完成提测（1 项）');
    expect(md).toContain('1、功能丙');
    expect(md).not.toContain('2、');
  });

  it('同小节内编号递增', () => {
    const md = buildDailyReport(D, classifyDaily([
      makeTask({ name: '功能甲', status: '已完成', completion_date: D }),
      makeTask({ name: '功能乙', status: '已完成', completion_date: D }),
    ], D));
    expect(md).toContain('1、功能甲');
    expect(md).toContain('2、功能乙');
  });

  it('无项目的任务不带括号', () => {
    const md = buildDailyReport(D, classifyDaily([
      makeTask({ name: '功能乙', status: '待上线', completion_date: D }),
    ], D));
    expect(md).not.toContain('功能乙（');
  });

  it('空小节跳过，全空显示空态文案', () => {
    const some = buildDailyReport(D, classifyDaily([
      makeTask({ name: '功能甲', status: '已完成', completion_date: D }),
    ], D));
    expect(some).not.toContain('完成测试、待上线');
    expect(some).not.toContain('今日完成提测');

    const empty = buildDailyReport(D, classifyDaily([], D));
    expect(empty).toContain('今日暂无可汇报的进展');
  });
});

describe('buildDailyPrompt', () => {
  it('明确约束中文结果只能使用简体中文', () => {
    expect(buildDailyPrompt('# 研发日报', 'zh-CN')).toContain('必须使用简体中文');
  });

  it('generates an English AI instruction when requested', () => {
    const prompt = buildDailyPrompt('# Daily', 'en-US');
    expect(prompt).toContain('engineering lead');
    expect(prompt).toContain('must be written in English');
  });
  it('包含清单原文、分条编号与不点名要求', () => {
    const p = buildDailyPrompt('# 研发日报\n1、功能甲');
    expect(p).toContain('1、功能甲');
    expect(p).toContain('不要提个人姓名');
    expect(p).toContain('1、2、3');
  });

  it('要求去掉任务名开头的内部标记', () => {
    const p = buildDailyPrompt('# 研发日报\n1、6.10 功能甲');
    expect(p).toContain('内部标记');
    expect(p).toContain('「6.10」');
    expect(p).toContain('「测试完成」');
  });

  it('禁止编造清单外的任务，且不再硬编码三个分类块', () => {
    const p = buildDailyPrompt('# 研发日报\n1、功能甲');
    expect(p).toContain('只整理清单中已有的任务');
    expect(p).toContain('严禁新增或编造');
    expect(p).toContain('不要扩写');
    expect(p).not.toContain('三个分类块');
  });
});
