import { create } from "zustand";
import type { Task } from "@shared/schema";

interface BoardState {
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  updateTaskOrder: (taskId: number, status: string, order: number) => void;
}

export const useStore = create<BoardState>((set) => ({
  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  updateTaskOrder: (taskId, status, order) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId ? { ...task, status, order } : task
      ),
    })),
}));
