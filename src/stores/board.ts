import { defineStore } from 'pinia';
import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type { Board } from '@/types';

export const useBoardStore = defineStore('board', () => {
  const boards = ref<Board[]>([]);
  const currentBoardId = ref<number | null>(null);

  const currentBoard = () => boards.value.find((b) => b.id === currentBoardId.value) ?? null;

  async function fetchBoards() {
    boards.value = await invoke<Board[]>('list_boards');
    if (boards.value.length > 0 && !currentBoardId.value) {
      currentBoardId.value = boards.value[0].id;
    }
  }

  async function createBoard(name: string, yearMonth: string) {
    const board = await invoke<Board>('create_board', { name, yearMonth });
    boards.value.unshift(board);
    currentBoardId.value = board.id;
    return board;
  }

  async function deleteBoard(id: number) {
    await invoke('delete_board', { id });
    boards.value = boards.value.filter((b) => b.id !== id);
    if (currentBoardId.value === id) {
      currentBoardId.value = boards.value[0]?.id ?? null;
    }
  }

  async function cloneBoard(sourceId: number, name: string, yearMonth: string) {
    const board = await invoke<Board>('clone_board', { sourceId, name, yearMonth });
    boards.value.unshift(board);
    currentBoardId.value = board.id;
    return board;
  }

  function selectBoard(id: number) {
    currentBoardId.value = id;
  }

  return { boards, currentBoardId, currentBoard, fetchBoards, createBoard, deleteBoard, cloneBoard, selectBoard };
});
