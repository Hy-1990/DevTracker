import { describe, it, expect } from 'vitest';
import { markdownToPlain } from './plainText';

describe('markdownToPlain', () => {
  it('剥掉标题井号，保留标题文字', () => {
    expect(markdownToPlain('# 研发日报 · 2026-06-12')).toBe('研发日报 · 2026-06-12');
    expect(markdownToPlain('## 一、产品需求上线（7 项）')).toBe('一、产品需求上线（7 项）');
    expect(markdownToPlain('### 提测/测试中的需求')).toBe('提测/测试中的需求');
  });

  it('整行加粗转【】，行内加粗剥星号', () => {
    expect(markdownToPlain('**Dreamface**')).toBe('【Dreamface】');
    expect(markdownToPlain('已完成 **3 项** 任务')).toBe('已完成 3 项 任务');
  });

  it('普通条目行原样保留', () => {
    const md = '1、功能甲：已全量\n2、功能乙';
    expect(markdownToPlain(md)).toBe(md);
  });

  it('整段转换结构不变', () => {
    const md = '# 周报\n\n## 一、产品需求上线（1 项）\n\n**Agent**\n1、聊天功能\n';
    expect(markdownToPlain(md)).toBe('周报\n\n一、产品需求上线（1 项）\n\n【Agent】\n1、聊天功能\n');
  });
});
