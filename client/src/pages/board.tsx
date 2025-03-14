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
import { useLocation } from "wouter";

const defaultColumns = [
  { id: "backlog", title: "backlog" },
  { id: "todo", title: "todo" },
  { id: "in-progress", title: "in-progress" },
  { id: "review", title: "review" },
  { id: "done", title: "done" }
];

export default function Board() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { currentBoard } = useStore();

  useEffect(() => {
    if (!currentBoard) {
      setLocation("/projects");
      toast({
        title: "Bitte wählen Sie zuerst ein Projekt aus",
        description: "Sie müssen ein Projekt auswählen, bevor Sie Boards anzeigen können",
      });
    }
  }, [currentBoard, setLocation, toast]);

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/boards", currentBoard?.id, "tasks"],
    queryFn: async () => {
      const res = await fetch(`/api/boards/${currentBoard?.id}/tasks`);
      if (!res.ok) {
        throw new Error("Fehler beim Laden der Tasks");
      }
      return res.json();
    },
    enabled: !!currentBoard,
  });

  const updateTask = useMutation({
    mutationFn: async (updates: { task: Task; newStatus: string; newOrder: number }) => {
      const updatedTask = {
        ...updates.task,
        status: updates.newStatus,
        order: updates.newOrder,
      };

      const res = await apiRequest("PATCH", `/api/tasks/${updatedTask.id}`, updatedTask);
      if (!res.ok) {
        throw new Error("Fehler beim Aktualisieren des Tasks");
      }
      return res.json();
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Aktualisieren",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;

    const taskId = parseInt(draggableId);
    const draggedTask = tasks.find(t => t.id === taskId);

    if (!draggedTask) {
      console.error("Task nicht gefunden:", taskId);
      return;
    }

    try {
      // Erstelle eine neue Task-Liste für das optimistische Update
      const updatedTasks = [...tasks];
      const sourceIndex = updatedTasks.findIndex(t => t.id === taskId);
      const [movedTask] = updatedTasks.splice(sourceIndex, 1);

      // Berechne die neue Position
      const insertIndex = destination.index;
      updatedTasks.splice(insertIndex, 0, {
        ...movedTask,
        status: destination.droppableId,
        order: destination.index,
      });

      // Aktualisiere die Reihenfolge in der betroffenen Spalte
      const columnTasks = updatedTasks.filter(t => t.status === destination.droppableId);
      columnTasks.forEach((task, index) => {
        task.order = index;
      });

      // Optimistisches Update
      queryClient.setQueryData(["/api/boards", currentBoard?.id, "tasks"], updatedTasks);

      // Backend-Update
      await updateTask.mutateAsync({
        task: draggedTask,
        newStatus: destination.droppableId,
        newOrder: destination.index,
      });
    } catch (error) {
      console.error("Fehler beim Aktualisieren:", error);
      queryClient.invalidateQueries({
        queryKey: ["/api/boards", currentBoard?.id, "tasks"],
      });
      toast({
        title: "Fehler beim Verschieben",
        description: "Bitte versuchen Sie es erneut",
        variant: "destructive",
      });
    }
  };

  if (!currentBoard) return null;

  if (tasksLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Laden...</p>
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
            {defaultColumns.map((column) => {
              const columnTasks = tasks
                .filter(task => task.status === column.id) // Changed to use column.id instead of column.title
                .sort((a, b) => a.order - b.order);

              return (
                <ColumnComponent
                  key={column.id}
                  column={column}
                  tasks={columnTasks}
                />
              );
            })}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}