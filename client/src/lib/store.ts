import { create } from "zustand";
import type { Task, Board, Project } from "@shared/schema";

interface BoardState {
  currentBoard: Board | null;
  currentProject: Project | null;
  boards: Board[];
  setBoards: (boards: Board[]) => void;
  setCurrentBoard: (board: Board) => void;
  setCurrentProject: (project: Project | null) => void;
}

export const useStore = create<BoardState>((set) => ({
  currentBoard: null,
  currentProject: null,
  boards: [],
  setBoards: (boards) => {
    console.log("[Store] Setting boards:", boards);
    set({ boards });
  },
  setCurrentBoard: (board) => {
    console.log("[Store] Setting current board:", board);
    set({ currentBoard: board });
  },
  setCurrentProject: (project) => {
    console.log("[Store] Setting current project:", project);
    set({ currentProject: project });
  },
}));