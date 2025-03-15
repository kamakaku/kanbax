import { useEffect, useState } from "react";
import { DragDropContext, type DropResult } from "react-beautiful-dnd";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type Board, type Column, type Task, type InsertBoard } from "@shared/schema";
import { Column as ColumnComponent } from "@/components/board/column";
import { BoardSelector } from "@/components/board/board-selector";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { BoardForm } from "@/components/board/board-form";

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
  const { currentBoard, currentProject } = useStore();
  const [showEditForm, setShowEditForm] = useState(false);

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

  const updateBoard = useMutation({
    mutationFn: async (data: InsertBoard) => {
      if (!currentBoard?.id) return null;

      const res = await apiRequest(
        "PATCH",
        `/api/boards/${currentBoard.id}`,
        data
      );

      if (!res.ok) {
        throw new Error("Fehler beim Aktualisieren des Boards");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/boards", currentBoard?.id],
      });
      toast({ title: "Board erfolgreich aktualisiert" });
      setShowEditForm(false);
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Aktualisieren",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateTask = useMutation({
    mutationFn: async (updatedTask: Task) => {
      try {
        return await apiRequest<Task>("PATCH", `/api/tasks/${updatedTask.id}`, updatedTask);
      } catch (error) {
        console.error("Task update error:", error);
        throw new Error("Fehler beim Aktualisieren des Tasks");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/boards", currentBoard?.id, "tasks"],
      });
      toast({ title: "Task erfolgreich aktualisiert" });
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
      const updatedTasks = [...tasks];
      const sourceIndex = updatedTasks.findIndex(t => t.id === taskId);
      const [movedTask] = updatedTasks.splice(sourceIndex, 1);

      const insertIndex = destination.index;
      updatedTasks.splice(insertIndex, 0, {
        ...movedTask,
        status: destination.droppableId,
        order: destination.index,
      });

      const columnTasks = updatedTasks.filter(t => t.status === destination.droppableId);
      columnTasks.forEach((task, index) => {
        task.order = index;
      });

      queryClient.setQueryData(["/api/boards", currentBoard?.id, "tasks"], updatedTasks);

      await updateTask.mutateAsync({
        ...draggedTask,
        status: destination.droppableId,
        order: destination.index,
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

  const handleTaskUpdate = async (updatedTask: Task) => {
    await updateTask.mutateAsync(updatedTask);
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
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">{currentBoard.title}</h1>
            {currentProject && (
              <p className="text-sm text-muted-foreground mt-1">
                Projekt: {currentProject.title}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowEditForm(true)}
            className="hover:bg-muted"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
        <BoardSelector />
      </div>

      <div className="flex-1 overflow-x-auto">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-6 pb-4">
            {defaultColumns.map((column) => {
              const columnTasks = tasks
                .filter(task => task.status === column.id)
                .sort((a, b) => a.order - b.order);

              return (
                <ColumnComponent
                  key={column.id}
                  column={column}
                  tasks={columnTasks}
                  onUpdate={handleTaskUpdate}
                />
              );
            })}
          </div>
        </DragDropContext>
      </div>

      <BoardForm
        open={showEditForm}
        onClose={() => setShowEditForm(false)}
        defaultValues={currentBoard}
        onSubmit={(data) => updateBoard.mutate(data)}
      />
    </div>
  );
}