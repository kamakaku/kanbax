import { useEffect } from "react";
import { DragDropContext, type DropResult } from "react-beautiful-dnd";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type Board, type Column } from "@shared/schema";
import { Column as ColumnComponent } from "@/components/board/column";
import { BoardSelector } from "@/components/board/board-selector";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useLocation } from "wouter";

export default function Board() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { currentBoard, setCurrentBoard, setBoards } = useStore();

  // Redirect to projects page if no board is selected
  useEffect(() => {
    if (!currentBoard) {
      setLocation("/projects");
      toast({
        title: "Please select a project first",
        description: "You need to select a project before viewing boards",
      });
    }
  }, [currentBoard, setLocation, toast]);

  const { data: columns = [], isLoading: columnsLoading } = useQuery<Column[]>({
    queryKey: ["/api/boards", currentBoard?.id, "columns"],
    queryFn: async () => {
      const res = await fetch(`/api/boards/${currentBoard?.id}/columns`);
      if (!res.ok) {
        throw new Error("Failed to fetch columns");
      }
      return res.json();
    },
    enabled: !!currentBoard,
  });

  const createColumn = useMutation({
    mutationFn: async () => {
      if (!currentBoard?.id) return;

      const maxOrder = columns.reduce((max, col) => Math.max(max, col.order), -1);

      const res = await apiRequest(
        "POST",
        `/api/boards/${currentBoard.id}/columns`,
        {
          title: "New Column",
          order: maxOrder + 1,
        }
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/boards", currentBoard?.id, "columns"],
      });
      toast({ title: "Column created" });
    },
    onError: (error) => {
      toast({
        title: "Failed to create column",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateTaskStatus = useMutation({
    mutationFn: async ({ id, columnId, order }: { id: number; columnId: number; order: number }) => {
      const res = await apiRequest("PATCH", `/api/tasks/${id}`, { columnId, order });
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

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { draggableId, source, destination } = result;
    const taskId = parseInt(draggableId);
    const newColumnId = parseInt(destination.droppableId);
    const newOrder = destination.index;

    updateTaskStatus.mutate({ id: taskId, columnId: newColumnId, order: newOrder });
  };

  if (!currentBoard) {
    return null; // Will redirect via useEffect
  }

  if (columnsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Kanban Board</h1>
        <BoardSelector />
      </div>

      <div className="flex-1 overflow-x-auto">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-6 pb-4">
            {columns.map((column) => (
              <ColumnComponent
                key={column.id}
                column={column}
              />
            ))}
            <Button
              onClick={() => createColumn.mutate()}
              variant="outline"
              className="h-[500px] w-[280px] border-dashed"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Column
            </Button>
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}