export interface Member {
  id: number;
  name: string;
  role: 'dev' | 'test';
  created_at?: string;
}

export interface Project {
  id: number;
  name: string;
  created_at?: string;
}

export interface Board {
  id: number;
  name: string;
  year_month: string;
  created_at?: string;
}

export type TaskStatus = '已停滞' | '待开始' | '进行中' | '待上线' | '已完成';
export type TaskPriority = '紧急' | '重要' | '日常' | '不重要';
export type TaskType = '产品需求' | '功能优化' | '基建' | 'bug修复' | '日常维护' | 'toboss';

export const TASK_STATUSES: TaskStatus[] = ['已停滞', '待开始', '进行中', '待上线', '已完成'];
export const TASK_PRIORITIES: TaskPriority[] = ['紧急', '重要', '日常', '不重要'];
export const TASK_TYPES: TaskType[] = ['产品需求', '功能优化', '基建', 'bug修复', '日常维护', 'toboss'];

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  '紧急': '#ff2d55',
  '重要': '#ff9500',
  '日常': '#5ac8fa',
  '不重要': '#8e8e93',
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  '已停滞': '#8e8e93',
  '待开始': '#ff3b30',
  '进行中': '#ffcc00',
  '待上线': '#af52de',
  '已完成': '#34c759',
};

export const DELAY_COLORS: Record<string, { color: string; type: 'error' | 'warning' | 'success' }> = {
  '提测延期': { color: '#ff2d55', type: 'error' },
  '延迟完成': { color: '#ff9500', type: 'warning' },
  '正常': { color: '#34c759', type: 'success' },
};

export interface Task {
  id: number;
  board_id: number;
  parent_id: number | null;
  name: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  type: TaskType;
  project_id: number | null;
  owner_id: number | null;
  start_date: string | null;
  estimated_test_date: string | null;
  actual_test_date: string | null;
  estimated_release_date: string | null;
  completion_date: string | null;
  progress: number;
  progress_auto: boolean;
  story_points: number;
  quality_rating: number | null;
  latest_note: string;
  created_at?: string;
  updated_at?: string;
}

export interface TaskWithRelations extends Task {
  project: Project | null;
  assignees: Member[];
  testers: Member[];
  owner: Member | null;
  children: TaskWithRelations[];
}

export interface CreateTaskInput {
  board_id: number;
  parent_id?: number | null;
  name?: string;
  status?: TaskStatus;
}

export interface UpdateTaskInput {
  name?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  task_type?: TaskType;
  project_id?: number | null;
  owner_id?: number | null;
  assignee_ids?: number[];
  tester_ids?: number[];
  start_date?: string | null;
  estimated_test_date?: string | null;
  actual_test_date?: string | null;
  estimated_release_date?: string | null;
  completion_date?: string | null;
  progress?: number;
  progress_auto?: boolean;
  story_points?: number;
  quality_rating?: number | null;
  latest_note?: string;
}

export interface TaskFilters {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  project_id?: number | null;
  assignee_id?: number | null;
}

/**
 * 延期判断逻辑：
 * - 进行中 且 实际提测日期 > 预估提测日期 → "提测延期"
 * - 已完成 且 完成日期 > 评估上线日期 → "延迟完成"
 * - 否则 → "正常"
 */
export function getDelayStatus(task: Task): '提测延期' | '延迟完成' | '正常' {
  if (task.status === '进行中' && task.actual_test_date && task.estimated_test_date) {
    if (task.actual_test_date > task.estimated_test_date) return '提测延期';
  }
  if (task.status === '已完成' && task.completion_date && task.estimated_release_date) {
    if (task.completion_date > task.estimated_release_date) return '延迟完成';
  }
  return '正常';
}
