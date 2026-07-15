import { defineStore } from 'pinia';
import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type { Project } from '@/types';

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([]);

  async function fetchProjects() {
    projects.value = await invoke<Project[]>('list_projects');
  }

  async function createProject(name: string) {
    const project = await invoke<Project>('create_project', { name });
    projects.value.push(project);
    return project;
  }

  async function updateProject(id: number, name: string) {
    await invoke('update_project', { id, name });
    const p = projects.value.find((p) => p.id === id);
    if (p) p.name = name;
  }

  async function deleteProject(id: number) {
    await invoke('delete_project', { id });
    projects.value = projects.value.filter((p) => p.id !== id);
  }

  return { projects, fetchProjects, createProject, updateProject, deleteProject };
});
