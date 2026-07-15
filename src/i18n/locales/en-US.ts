export const enUS = {
  common: {
    add: 'Add', save: 'Save', saved: '✓ Saved', cancel: 'Cancel', edit: 'Edit', delete: 'Delete',
    confirmDelete: 'Delete', create: 'Create', copy: 'Copy', copied: '✓ Copied', export: 'Export',
    preview: 'Preview', regenerate: 'Regenerate', empty: 'No data', unnamed: '(Untitled)', back: 'Back',
    records: '{count} records', tasksCount: '{count} tasks', days: '{count} days', score: '{value} pts',
  },
  language: { title: 'Language', description: 'Choose the language used by the interface and generated reports.', zh: '简体中文', en: 'English', switchHint: 'Switch to Chinese' },
  nav: {
    table: 'Table', kanban: 'Kanban', delay: 'Delays', release: 'Rankings', stats: 'Analytics', idle: 'Capacity',
    daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', settings: 'Team & Projects',
  },
  theme: { dark: 'Dark', light: 'Light', auto: 'System' },
  board: {
    new: 'New monthly board', newTitle: 'Create monthly task board', yearMonth: 'Month', name: 'Name',
    deleteTitle: 'Delete monthly task board', deleteMessage: 'Delete this monthly board? Every task and subtask on it will be permanently deleted. This action cannot be undone.',
    clone: 'Clone as new month', cloneTitle: 'Clone monthly board', cloneHint: 'Copies every unfinished task with its status, dates, progress, assignees, testers, and project. Completed tasks are not copied.',
    newYearMonth: 'New month', newName: 'New board name', defaultName: '{month}/{year}',
  },
  settings: {
    members: 'Team members', name: 'Name', developer: 'Developer', tester: 'Tester', developerShort: 'Dev', testerShort: 'QA',
    deleteMember: 'Delete “{name}”?', ai: 'AI settings', aiHint: 'The DeepSeek API Key is stored locally. When you use AI summaries, the key and report content are sent to DeepSeek.',
    projects: 'Projects', projectName: 'Project name', deleteProject: 'Delete “{name}”?',
  },
  table: {
    columns: 'Arrange columns', sortHint: 'Sort: Project → Completion → Task → Planned test → Type', newTask: 'New task',
    selectAll: 'Select all', actions: 'Actions', addChild: 'Add subtask', childShort: '+ Subtask', deleteShort: 'Delete',
    batchDelete: 'Delete selected ({count})', addRecord: 'Add record', deleteConfirm: 'Delete this task?',
    reorderHint: 'Drag column names with ⠿ to reorder them.', fixed: 'fixed', emptyValue: '(Empty)', taskInput: 'Enter task description', latestProgress: 'Latest update',
    column: {
      name: 'Task Description', status: 'Status', priority: 'Priority', type: 'Type', project: 'Project', assignees: 'Assignees',
      owner: 'Owner', testers: 'Testers', start_date: 'Start Date', estimated_test_date: 'Planned Test',
      actual_test_date: 'Actual Test', estimated_release_date: 'Planned Release', completion_date: 'Completion Date',
      story_points: 'Effort', progress: 'Progress', delay: 'Delay', quality_rating: 'Score', latest_note: 'Latest Update',
    },
  },
  kanban: { newTask: 'New task', empty: 'No tasks', testDate: 'Test: {date}', subtasks: 'Subtasks: {done}/{total}' },
  delay: {
    total: 'Delayed tasks', overdueTest: 'Not tested (overdue)', testDelayed: 'Test delayed', completionDelayed: 'Completed late', people: 'People affected',
    peopleOverview: 'Delay overview by person', personStat: '{count} tasks / {days} days total', details: 'Delayed task details',
    task: 'Task', priority: 'Priority', assignees: 'Assignees', owner: 'Owner', project: 'Project', estimatedTest: 'Planned test',
    actualTest: 'Actual test', delayDays: 'Days late', status: 'Status', progress: 'Progress', notTested: 'Not tested', dayValue: '{count} days', empty: 'No delayed tasks. Keep it up!',
  },
  release: {
    completed: 'Completed tasks', rated: 'Rated tasks', developers: 'Developers', testers: 'Testers',
    devTitle: 'Developer ranking — total score', devHint: 'Total score is the sum of rated tasks, balancing delivery and quality',
    testTitle: 'Tester ranking', testHint: 'Ordered by tested tasks with scores as context', rank: 'Rank', developer: 'Developer', tester: 'Tester',
    completedCount: 'Completed', ratedCount: 'Rated', totalScore: 'Total score', averageScore: 'Average', effort: 'Effort', testCount: 'Tested tasks', involvedRatings: 'Rated tasks',
  },
  stats: {
    totalTasks: 'Total tasks', taskStats: 'Task analytics', statusDistribution: 'Status distribution', typeDistribution: 'Task type distribution',
    employeeRanking: 'Team rankings', completionRanking: 'Task completion by team member', employee: 'Team member', onTime: 'On time', delayed: 'Late', total: 'Total', delayRate: 'Delay rate',
    scoreRanking: 'Team score ranking', ratedCount: 'Rated', totalScore: 'Total score', averageScore: 'Average', idleDevelopers: 'Available developers', noIdle: 'No available developers', rank: 'Rank',
  },
  idle: {
    idleDevelopers: 'Available developers', busyDevelopers: 'Busy developers', noActive: 'No active tasks', allComplete: 'All tasks are 100% complete', noIdle: 'No available developers', noBusy: 'No busy developers', activeTasks: '{count} active tasks',
  },
  report: {
    preview: 'Preview', edit: 'Edit', aiDaily: 'Generate daily report with AI', aiWeekly: 'Generate weekly report with AI', aiSummary: 'AI summary',
    regenerateList: 'Regenerate list', regenerate: 'Regenerate', copy: 'Copy', copyMarkdown: 'Copy Markdown', exportMarkdown: 'Export .md',
    dailyPlaceholder: 'Daily report', weeklyPlaceholder: 'Weekly report', monthlyPlaceholder: 'Monthly report',
  },
  domain: {
    status: { stalled: 'Stalled', todo: 'Not Started', progress: 'In Progress', release: 'Ready to Release', done: 'Completed' },
    priority: { urgent: 'Urgent', important: 'Important', routine: 'Routine', low: 'Low Priority' },
    type: { product: 'Product Request', improvement: 'Enhancement', infrastructure: 'Infrastructure', bug: 'Bug Fix', maintenance: 'Maintenance', toboss: 'Executive Request' },
    delay: { untested: 'Not Tested', testDelayed: 'Test Delayed', completionDelayed: 'Completed Late', normal: 'On Track' },
    role: { dev: 'Developer', test: 'Tester' },
  },
  errors: { missingApiKey: 'DeepSeek API Key is not configured. Add it under Team & Projects.' },
} as const;
