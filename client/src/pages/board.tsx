import { useEffect } from "react";
import { DragDropContext, type DropResult } from "react-beautiful-dnd";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type Board, type InsertBoard } from "@shared/schema";
import { Column } from "@/components/board/column";
import { BoardSelector } from "@/components/board/board-selector";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const COLUMNS = [
  { title: "To Do", status: "todo" },
  { title: "In Progress", status: "in-progress" },
  { title: "Done", status: "done" },
];

export default function Board() {
  const { toast } = useToast();
  const { currentBoard, setCurrentBoard, setBoards } = useStore();

  const { data: boards, isLoading, error } = useQuery<Board[]>({
    queryKey: ["/api/boards"],
  });

  const createBoard = useMutation({
    mutationFn: async (board: InsertBoard) => {
      const res = await apiRequest("POST", "/api/boards", board);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
      toast({ title: "Board created successfully" });
    },
    onError: (error) => {
      toast({
        title: "Failed to create board",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateTaskStatus = useMutation({
    mutationFn: async ({ id, status, order }: { id: number; status: string; order: number }) => {
      const res = await apiRequest("PATCH", `/api/tasks/${id}`, { status, order });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/boards", currentBoard?.id, "tasks"],
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update task",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!isLoading && boards) {
      setBoards(boards);
      if (!currentBoard && boards.length > 0) {
        setCurrentBoard(boards[0]);
      } else if (boards.length === 0 && !createBoard.isPending) {
        createBoard.mutate({
          title: "My First Board",
          description: "A board to get you started",
        });
      }
    }
  }, [boards, isLoading, currentBoard, setCurrentBoard, setBoards]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { draggableId, source, destination } = result;
    const taskId = parseInt(draggableId);
    const newStatus = destination.droppableId;
    const newOrder = destination.index;

    updateTaskStatus.mutate({ id: taskId, status: newStatus, order: newOrder });
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-red-500">Error loading boards: {error.message}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Loading boards...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Kanban Board</h1>
        <div className="flex items-center gap-4">
          <BoardSelector />
          {(!boards || boards.length === 0) && !createBoard.isPending && (
            <Button
              onClick={() =>
                createBoard.mutate({
                  title: "My First Board",
                  description: "A board to get you started",
                })
              }
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Board
            </Button>
          )}
        </div>
      </div>

      {currentBoard ? (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-6 overflow-x-auto pb-4">
            {COLUMNS.map(({ title, status }) => (
              <Column
                key={status}
                title={title}
                status={status as "todo" | "in-progress" | "done"}
              />
            ))}
          </div>
        </DragDropContext>
      ) : (
        <div className="flex items-center justify-center min-h-[500px]">
          <p className="text-lg text-muted-foreground">
            {boards && boards.length > 0
              ? "Please select a board"
              : "Create your first board to get started"}
          </p>
        </div>
      )}
    </div>
  );
}