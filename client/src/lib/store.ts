import { create } from "zustand";
import type { Task, Board } from "@shared/schema";

interface BoardState {
  currentBoard: Board | null;
  boards: Board[];
  setBoards: (boards: Board[]) => void;
  setCurrentBoard: (board: Board) => void;
}

export const useStore = create<BoardState>((set) => ({
  currentBoard: null,
  boards: [],
  setBoards: (boards) => set({ boards }),
  setCurrentBoard: (board) => set({ currentBoard: board }),
}));