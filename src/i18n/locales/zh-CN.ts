export const zhCN = {
  common: {
    add: '添加', save: '保存', saved: '✓ 已保存', cancel: '取消', edit: '编辑', delete: '删除',
    confirmDelete: '确认删除', create: '创建', copy: '复制', copied: '✓ 已复制', export: '导出',
    preview: '预览', regenerate: '重新生成', empty: '暂无数据', unnamed: '(未命名)', back: '返回',
    records: '{count} 条记录', tasksCount: '{count} 个任务', days: '{count} 天', score: '{value} 分',
  },
  language: { title: '语言', description: '选择界面和自动生成报告使用的语言。', zh: '简体中文', en: 'English', switchHint: '切换为 English' },
  nav: {
    table: '表格', kanban: '看板', delay: '延期', release: '排名', stats: '统计', idle: '空闲',
    daily: '日报', weekly: '周报', monthly: '月报', settings: '成员 / 项目管理',
  },
  theme: { dark: '深色', light: '浅色', auto: '自动' },
  board: {
    new: '新建月度表', newTitle: '新建月度任务表', yearMonth: '年月', name: '名称',
    deleteTitle: '删除月度任务表', deleteMessage: '确定要删除这个月度表吗？该表下所有任务（含子任务）将被永久删除，此操作不可恢复。',
    clone: '复制为新月度表', cloneTitle: '复制月度表', cloneHint: '将完整继承未完成任务（状态、日期、进度、执行人、测试人员、项目等），已完成任务不复制。',
    newYearMonth: '新表年月', newName: '新表名称', defaultName: '{year}年{month}月',
  },
  settings: {
    members: '团队成员管理', name: '姓名', developer: '开发人员', tester: '测试人员', developerShort: '开发', testerShort: '测试',
    deleteMember: '确认删除「{name}」？', ai: 'AI 设置', aiHint: 'DeepSeek API Key 保存在本机；使用 AI 总结时，Key 和报告内容会发送给 DeepSeek。',
    projects: '项目管理', projectName: '项目名称', deleteProject: '确认删除「{name}」？',
  },
  table: {
    columns: '调整列顺序', sortHint: '排序：项目 → 完成日期 → 任务描述 → 预估提测 → 类型', newTask: '新建任务',
    selectAll: '全选', actions: '操作', addChild: '新建子任务', childShort: '+子', deleteShort: '删',
    batchDelete: '批量删除（{count} 条）', addRecord: '添加记录', deleteConfirm: '确认删除？',
    reorderHint: '按住 ⠿ 拖拽列名上下移动。', fixed: '固定', emptyValue: '(空)', taskInput: '输入任务描述', latestProgress: '最新进展',
    column: {
      name: '任务描述', status: '进展', priority: '优先级', type: '类型', project: '项目', assignees: '任务执行人',
      owner: '需求负责人', testers: '测试人员', start_date: '开始日期', estimated_test_date: '预估提测',
      actual_test_date: '实际提测', estimated_release_date: '评估上线', completion_date: '完成日期',
      story_points: '工时', progress: '进度', delay: '是否延期', quality_rating: '得分', latest_note: '最新进展',
    },
  },
  kanban: { newTask: '新建任务', empty: '暂无任务', testDate: '提测：{date}', subtasks: '子任务：{done}/{total}' },
  delay: {
    total: '延期任务总数', overdueTest: '未提测（已超期）', testDelayed: '提测延迟', completionDelayed: '延迟完成', people: '涉及人数',
    peopleOverview: '延期人员概览', personStat: '{count} 个任务 / 累计 {days} 天', details: '延期任务明细',
    task: '任务描述', priority: '优先级', assignees: '执行人', owner: '需求负责人', project: '项目', estimatedTest: '预估提测',
    actualTest: '实际提测', delayDays: '延期天数', status: '状态', progress: '进度', notTested: '未提测', dayValue: '{count} 天', empty: '当前没有延期任务，保持！',
  },
  release: {
    completed: '已完成任务', rated: '已评分任务', developers: '参与开发', testers: '参与测试',
    devTitle: '开发排行榜 — 总分制', devHint: '总分 = 所有已评分任务得分之和，体现完成量和质量',
    testTitle: '测试排行榜', testHint: '按测试任务数排序，兼顾得分', rank: '排名', developer: '开发', tester: '测试',
    completedCount: '完成数', ratedCount: '已评分', totalScore: '总分', averageScore: '均分', effort: '工时', testCount: '测试任务数', involvedRatings: '涉及评分数',
  },
  stats: {
    totalTasks: '总任务', taskStats: '任务统计', statusDistribution: '状态分布', typeDistribution: '任务类型分布（产品需求 / 基建 / bug 等占比）',
    employeeRanking: '员工排名', completionRanking: '员工完成任务排名', employee: '员工', onTime: '按时完成', delayed: '延迟完成', total: '总数', delayRate: '延迟率',
    scoreRanking: '员工得分排行榜（总分制）', ratedCount: '已评分数', totalScore: '总分', averageScore: '均分', idleDevelopers: '空闲开发人员', noIdle: '当前无空闲人员', rank: '排名',
  },
  idle: {
    idleDevelopers: '空闲开发人员', busyDevelopers: '忙碌开发人员', noActive: '无进行中任务', allComplete: '所有任务已 100%', noIdle: '当前无空闲人员', noBusy: '当前无忙碌人员', activeTasks: '{count} 个进行中任务',
  },
  report: {
    preview: '预览', edit: '编辑', aiDaily: 'AI 生成日报', aiWeekly: 'AI 生成周报', aiSummary: 'AI 总结',
    regenerateList: '重新生成清单', regenerate: '重新生成', copy: '复制', copyMarkdown: '复制 Markdown', exportMarkdown: '导出 .md',
    dailyPlaceholder: '日报内容', weeklyPlaceholder: '周报内容', monthlyPlaceholder: '月报内容',
  },
  domain: {
    status: { stalled: '已停滞', todo: '待开始', progress: '进行中', release: '待上线', done: '已完成' },
    priority: { urgent: '紧急', important: '重要', routine: '日常', low: '不重要' },
    type: { product: '产品需求', improvement: '功能优化', infrastructure: '基建', bug: 'bug修复', maintenance: '日常维护', toboss: 'toboss' },
    delay: { untested: '未提测', testDelayed: '提测延迟', completionDelayed: '延迟完成', normal: '正常' },
    role: { dev: '开发人员', test: '测试人员' },
  },
  errors: { missingApiKey: '未配置 DeepSeek API Key，请到「成员 / 项目管理」页填写' },
} as const;
