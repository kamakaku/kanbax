import { create } from "zustand";
import type { Task, Board } from "@shared/schema";

interface BoardState {
  currentBoard: Board | null;
  boards: Board[];
  tasks: Task[];
  setBoards: (boards: Board[]) => void;
  setCurrentBoard: (board: Board) => void;
  setTasks: (tasks: Task[]) => void;
  updateTaskOrder: (taskId: number, status: string, order: number) => void;
}

export const useStore = create<BoardState>((set) => ({
  currentBoard: null,
  boards: [],
  tasks: [],
  setBoards: (boards) => set({ boards }),
  setCurrentBoard: (board) => set({ currentBoard: board }),
  setTasks: (tasks) => set({ tasks }),
  updateTaskOrder: (taskId, status, order) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId ? { ...task, status, order } : task
      ),
    })),
}));