import { createContext, useContext, ReactNode } from "react";
import { type Board } from "@shared/schema";
import { useStore } from "@/lib/store";

interface BoardContextType {
  currentBoard: Board | null;
  setCurrentBoard: (board: Board) => void;
}

export const BoardContext = createContext<BoardContextType>({
  currentBoard: null,
  setCurrentBoard: () => {},
});

interface BoardProviderProps {
  children: ReactNode;
}

export function BoardProvider({ children }: BoardProviderProps) {
  const { currentBoard, setCurrentBoard } = useStore();

  return (
    <BoardContext.Provider value={{ currentBoard, setCurrentBoard }}>
      {children}
    </BoardContext.Provider>
  );
}

export function useBoardContext() {
  const context = useContext(BoardContext);
  if (!context) {
    throw new Error("useBoardContext must be used within a BoardProvider");
  }
  return context;
}
