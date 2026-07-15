import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type { Member } from '@/types';

export const useMemberStore = defineStore('member', () => {
  const members = ref<Member[]>([]);

  const devMembers = computed(() => members.value.filter((m) => m.role === 'dev'));
  const testMembers = computed(() => members.value.filter((m) => m.role === 'test'));

  async function fetchMembers() {
    members.value = await invoke<Member[]>('list_members');
  }

  async function createMember(name: string, role: 'dev' | 'test') {
    const member = await invoke<Member>('create_member', { name, role });
    members.value.push(member);
    return member;
  }

  async function updateMember(id: number, name: string, role: 'dev' | 'test') {
    await invoke('update_member', { id, name, role });
    const m = members.value.find((m) => m.id === id);
    if (m) { m.name = name; m.role = role; }
  }

  async function deleteMember(id: number) {
    await invoke('delete_member', { id });
    members.value = members.value.filter((m) => m.id !== id);
  }

  return { members, devMembers, testMembers, fetchMembers, createMember, updateMember, deleteMember };
});
