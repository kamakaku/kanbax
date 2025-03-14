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

  const updateTaskStatus = useMutation({
    mutationFn: async (updates: { task: Task, newStatus: string, newOrder: number }) => {
      const updatedTask = {
        ...updates.task,
        status: updates.newStatus,
        order: updates.newOrder
      };

      const res = await apiRequest("PATCH", `/api/tasks/${updates.task.id}`, updatedTask);
      if (!res.ok) {
        throw new Error("Fehler beim Aktualisieren des Tasks");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/boards", currentBoard?.id, "tasks"],
      });
    },
    onError: (error) => {
      console.error("Update task error:", error);
      toast({
        title: "Fehler beim Aktualisieren des Tasks",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;

    // Wenn keine Zielposition existiert, abbrechen
    if (!destination) return;

    // Wenn die Position unverändert ist, abbrechen
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    const taskId = parseInt(draggableId.replace('task-', ''));
    const draggedTask = tasks.find(t => t.id === taskId);

    if (!draggedTask) {
      console.error("Task nicht gefunden:", taskId);
      return;
    }

    try {
      // Neue Task-Liste für optimistisches Update erstellen
      const updatedTasks = Array.from(tasks);

      // Task aus der alten Position entfernen
      const [removedTask] = updatedTasks.splice(source.index, 1);

      // Task an der neuen Position einfügen
      updatedTasks.splice(destination.index, 0, {
        ...removedTask,
        status: destination.droppableId,
        order: destination.index
      });

      // Reihenfolge für alle Tasks in der Ziel-Spalte aktualisieren
      const tasksInDestColumn = updatedTasks.filter(
        t => t.status === destination.droppableId
      );

      tasksInDestColumn.forEach((task, index) => {
        task.order = index;
      });

      // Optimistisches Update durchführen
      queryClient.setQueryData(
        ["/api/boards", currentBoard?.id, "tasks"],
        updatedTasks
      );

      // Backend-Update durchführen
      await updateTaskStatus.mutateAsync({
        task: draggedTask,
        newStatus: destination.droppableId,
        newOrder: destination.index
      });

    } catch (error) {
      console.error("Fehler beim Aktualisieren des Task-Status:", error);
      // Bei Fehler Cache invalidieren, um korrekten Status wiederherzustellen
      queryClient.invalidateQueries({
        queryKey: ["/api/boards", currentBoard?.id, "tasks"],
      });

      toast({
        title: "Fehler beim Verschieben des Tasks",
        description: "Der Task konnte nicht verschoben werden. Bitte versuchen Sie es erneut.",
        variant: "destructive",
      });
    }
  };

  const handleTaskUpdate = async (updatedTask: Task) => {
    try {
      const res = await apiRequest(
        "PATCH",
        `/api/tasks/${updatedTask.id}`,
        updatedTask
      );

      if (!res.ok) {
        throw new Error("Fehler beim Aktualisieren des Tasks");
      }

      queryClient.invalidateQueries({
        queryKey: ["/api/boards", currentBoard?.id, "tasks"],
      });

      toast({ title: "Task erfolgreich aktualisiert" });
    } catch (error) {
      console.error("Task update error:", error);
      toast({
        title: "Fehler beim Aktualisieren",
        description: "Der Task konnte nicht aktualisiert werden",
        variant: "destructive",
      });
    }
  };

  const handleTaskDelete = async (taskId: number) => {
    try {
      const res = await apiRequest("DELETE", `/api/tasks/${taskId}`);
      if (!res.ok) {
        throw new Error("Fehler beim Löschen des Tasks");
      }

      queryClient.invalidateQueries({
        queryKey: ["/api/boards", currentBoard?.id, "tasks"],
      });

      toast({ title: "Task erfolgreich gelöscht" });
    } catch (error) {
      console.error("Task delete error:", error);
      toast({
        title: "Fehler beim Löschen",
        description: "Der Task konnte nicht gelöscht werden",
        variant: "destructive",
      });
    }
  };

  if (!currentBoard) {
    return null;
  }

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
                .filter(task => task.status === column.title)
                .sort((a, b) => a.order - b.order);

              return (
                <ColumnComponent
                  key={column.id}
                  column={column}
                  tasks={columnTasks}
                  onUpdate={handleTaskUpdate}
                  onDelete={handleTaskDelete}
                />
              );
            })}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}