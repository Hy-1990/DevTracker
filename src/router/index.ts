import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/board' },
    {
      path: '/board',
      name: 'board',
      component: () => import('@/views/BoardLayout.vue'),
      children: [
        { path: ':boardId/table', name: 'table-view', component: () => import('@/views/TableView.vue') },
        { path: ':boardId/kanban', name: 'kanban-view', component: () => import('@/views/KanbanView.vue') },
        { path: ':boardId/delay', name: 'delay-view', component: () => import('@/views/DelayView.vue') },
        { path: ':boardId/release', name: 'release-view', component: () => import('@/views/ReleaseView.vue') },
        { path: ':boardId/stats', name: 'stats-view', component: () => import('@/views/StatsView.vue') },
        { path: ':boardId/idle', name: 'idle-view', component: () => import('@/views/IdleView.vue') },
        { path: ':boardId/report', name: 'report-view', component: () => import('@/views/ReportView.vue') },
        { path: ':boardId/daily', name: 'daily-view', component: () => import('@/views/DailyReportView.vue') },
        { path: ':boardId/weekly', name: 'weekly-view', component: () => import('@/views/WeeklyReportView.vue') },
      ],
    },
    { path: '/settings', name: 'settings', component: () => import('@/views/Settings.vue') },
  ],
});

export default router;
