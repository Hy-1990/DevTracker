import { defineStore } from 'pinia';
import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type { TaskWithRelations, CreateTaskInput, UpdateTaskInput, TaskFilters } from '@/types';

export const useTaskStore = defineStore('task', () => {
  const tasks = ref<TaskWithRelations[]>([]);
  const loading = ref(false);
  const filters = ref<TaskFilters>({});

  async function fetchTasks(boardId: number) {
    loading.value = true;
    try {
      const f = Object.keys(filters.value).length > 0 ? filters.value : undefined;
      tasks.value = await invoke<TaskWithRelations[]>('list_tasks', {
        boardId,
        filters: f ?? null,
      });
    } finally {
      loading.value = false;
    }
  }

  async function createTask(input: CreateTaskInput): Promise<TaskWithRelations> {
    const task = await invoke<TaskWithRelations>('create_task', { input });
    // Refresh to get correct ordering
    await fetchTasks(input.board_id);
    return task;
  }

  async function updateTask(id: number, input: UpdateTaskInput): Promise<TaskWithRelations> {
    const updated = await invoke<TaskWithRelations>('update_task', { id, input });
    // Find and replace in list (top-level or child)
    const idx = tasks.value.findIndex((t) => t.id === id);
    if (idx >= 0) {
      tasks.value[idx] = updated;
    } else {
      for (const parent of tasks.value) {
        const ci = parent.children.findIndex((c) => c.id === id);
        if (ci >= 0) { parent.children[ci] = updated; break; }
      }
    }
    return updated;
  }

  async function deleteTask(id: number) {
    await invoke('delete_task', { id });
    const idx = tasks.value.findIndex((t) => t.id === id);
    if (idx >= 0) {
      tasks.value.splice(idx, 1);
    } else {
      for (const parent of tasks.value) {
        const ci = parent.children.findIndex((c) => c.id === id);
        if (ci >= 0) { parent.children.splice(ci, 1); break; }
      }
    }
  }

  function setFilters(f: TaskFilters) { filters.value = f; }
  function clearFilters() { filters.value = {}; }

  return { tasks, loading, filters, fetchTasks, createTask, updateTask, deleteTask, setFilters, clearFilters };
});
