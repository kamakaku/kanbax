import { useEffect } from "react";
import { DragDropContext, type DropResult } from "react-beautiful-dnd";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type Board, type Column, type Task } from "@shared/schema";
import { Column as ColumnComponent } from "@/components/board/column";
import { BoardSelector } from "@/components/board/board-selector";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useLocation } from "wouter";

interface BoardData extends Board {
  columns: Column[];
  tasks: Task[];
}

export default function Board() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { currentBoard } = useStore();

  // Redirect to projects page if no board is selected
  useEffect(() => {
    if (!currentBoard) {
      setLocation("/projects");
      toast({
        title: "Bitte wählen Sie zuerst ein Projekt aus",
        description: "Sie müssen ein Projekt auswählen, bevor Sie Boards anzeigen können",
      });
    }
  }, [currentBoard, setLocation, toast]);

  const { data: boardData, isLoading } = useQuery<BoardData>({
    queryKey: ["/api/boards", currentBoard?.id],
    queryFn: async () => {
      console.log("Fetching board data for:", currentBoard?.id);
      const res = await fetch(`/api/boards/${currentBoard?.id}`);
      if (!res.ok) {
        throw new Error("Failed to fetch board");
      }
      const data = await res.json();
      console.log("Fetched board data:", data);
      return data;
    },
    enabled: !!currentBoard,
  });

  const createColumn = useMutation({
    mutationFn: async () => {
      if (!currentBoard?.id) return;

      const maxOrder = (boardData?.columns || []).reduce((max, col) => Math.max(max, col.order), -1);

      const res = await apiRequest(
        "POST",
        `/api/boards/${currentBoard.id}/columns`,
        {
          title: "Neue Spalte",
          order: maxOrder + 1,
        }
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/boards", currentBoard?.id],
      });
      toast({ title: "Spalte erstellt" });
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Erstellen der Spalte",
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
        queryKey: ["/api/boards", currentBoard?.id],
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Aktualisieren der Aufgabe",
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

  if (!currentBoard || !boardData || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Lädt...</p>
      </div>
    );
  }

  // Sort tasks by their order within each column
  const assignedTasks = boardData.tasks.filter(task => task.columnId !== 0);
  const unassignedTasks = boardData.tasks.filter(task => task.columnId === 0);

  // Create columns list including a backlog column for unassigned tasks
  let allColumns = [...boardData.columns].sort((a, b) => a.order - b.order);

  // Add backlog column if there are unassigned tasks
  if (unassignedTasks.length > 0) {
    allColumns.unshift({
      id: -1,
      title: "Backlog",
      order: -1,
      boardId: currentBoard.id
    });
  }

  // Map tasks to their columns
  const columnsWithTasks = allColumns.map(column => ({
    ...column,
    tasks: column.id === -1 
      ? unassignedTasks.sort((a, b) => a.order - b.order)
      : assignedTasks
          .filter(task => task.columnId === column.id)
          .sort((a, b) => a.order - b.order)
  }));

  console.log("Final columns with tasks:", columnsWithTasks);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Kanban Board</h1>
        <BoardSelector />
      </div>

      <div className="flex-1 overflow-x-auto">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-6 pb-4">
            {columnsWithTasks.map((column) => (
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
              Spalte hinzufügen
            </Button>
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}