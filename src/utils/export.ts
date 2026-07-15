import * as XLSX from 'xlsx';
import type { TaskWithRelations } from '@/types';
import { getDelayStatus } from '@/types';

function flattenTasks(tasks: TaskWithRelations[]): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (const t of tasks) {
    rows.push(taskToRow(t, false));
    for (const child of t.children) {
      rows.push(taskToRow(child, true));
    }
  }
  return rows;
}

function taskToRow(t: TaskWithRelations, isChild: boolean): Record<string, unknown> {
  return {
    ID: t.id,
    任务描述: isChild ? `  └ ${t.name}` : t.name,
    进展: t.status,
    优先级: t.priority,
    类型: t.type,
    项目: t.project?.name ?? '',
    任务执行人: t.assignees.map((a) => a.name).join(', '),
    需求负责人: t.owner?.name ?? '',
    测试人员: t.testers.map((a) => a.name).join(', '),
    开始日期: t.start_date ?? '',
    预估提测日期: t.estimated_test_date ?? '',
    实际提测日期: t.actual_test_date ?? '',
    评估上线日期: t.estimated_release_date ?? '',
    完成日期: t.completion_date ?? '',
    工时: t.story_points,
    进度: `${t.progress}%`,
    是否延期: getDelayStatus(t),
    质量评分: t.quality_rating ?? '',
    最新进展: t.latest_note ?? '',
    父任务ID: t.parent_id ?? '',
  };
}

export function exportToExcel(tasks: TaskWithRelations[], filename: string) {
  const rows = flattenTasks(tasks);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '任务');
  XLSX.writeFile(wb, filename);
}

export function exportToCSV(tasks: TaskWithRelations[], filename: string) {
  const rows = flattenTasks(tasks);
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToJSON(tasks: TaskWithRelations[], filename: string) {
  const json = JSON.stringify(tasks, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
