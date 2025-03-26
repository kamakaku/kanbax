import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Task } from "@shared/schema";
import { DragDropContext, DropResult } from "react-beautiful-dnd";
import { Column as ColumnComponent } from "@/components/board/column";
import { TaskDialog } from "@/components/board/task-dialog";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

// Erweiterte Task-Schnittstelle für die Frontend-Anzeige
interface TaskWithDetails extends Task {
  board?: {
    id: number;
    title: string;
    projectId?: number | null;
  } | null;
  column?: {
    id: number;
    title: string;
  } | null;
  project?: {
    id: number;
    title: string;
  } | null;
  isPersonal?: boolean; // Flag für persönliche Aufgaben ohne Board-ID
}

// Die Standard-Spalten für das Kanban-Board
const defaultColumns = [
  { id: "backlog", title: "Backlog" },
  { id: "todo", title: "To Do" },
  { id: "in-progress", title: "In Progress" },
  { id: "review", title: "Review" },
  { id: "done", title: "Done" }
];

// Hauptkomponente für "Meine Aufgaben"
export default function MyTasks() {
  const [selectedTask, setSelectedTask] = useState<TaskWithDetails | null>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isNewTaskDialogOpen, setIsNewTaskDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Laden der zugewiesenen Aufgaben des aktuellen Benutzers
  const { data: tasks = [], isLoading, error } = useQuery<TaskWithDetails[]>({
    queryKey: ["/api/user/tasks/assigned"],
    queryFn: async () => {
      const result = await apiRequest<TaskWithDetails[]>("GET", "/api/user/tasks/assigned");
      // Debug-Logging für die geladenen Aufgaben
      console.log("Geladene Aufgaben:", result);
      // Überprüfen auf persönliche Aufgaben
      console.log("Persönliche Aufgaben:", result.filter(task => task.boardId === null || task.isPersonal));
      return result;
    },
    staleTime: 1000 * 60, // 1 Minute
  });

  // Mutation zum Aktualisieren einer Aufgabe
  const updateTaskMutation = useMutation({
    mutationFn: async (updatedTask: Task) => {
      return apiRequest("PATCH", `/api/tasks/${updatedTask.id}`, updatedTask);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/tasks/assigned"] });
      toast({
        title: "Aufgabe aktualisiert",
        description: "Die Aufgabe wurde erfolgreich aktualisiert.",
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: `Fehler beim Aktualisieren: ${(error as Error).message}`,
        variant: "destructive",
      });
    }
  });

  // Handler für Aufgaben-Klick und Update
  const handleTaskUpdate = async (updatedTask: Task): Promise<void> => {
    await updateTaskMutation.mutateAsync(updatedTask);
    return;
  };

  // Drag-and-Drop-Logik
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

      queryClient.setQueryData(["/api/user/tasks/assigned"], updatedTasks);

      await updateTaskMutation.mutateAsync({
        ...draggedTask,
        status: destination.droppableId,
        order: destination.index,
      });
    } catch (error) {
      console.error("Fehler beim Aktualisieren:", error);
      queryClient.invalidateQueries({
        queryKey: ["/api/user/tasks/assigned"],
      });
      toast({
        title: "Fehler beim Verschieben",
        description: "Bitte versuchen Sie es erneut",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Laden...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground mb-4">
          {(error as Error).message || "Aufgaben konnten nicht geladen werden"}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      {/* Background gradients */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(at_80%_0%,rgb(248,250,252)_0px,transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(at_0%_50%,rgb(241,245,249)_0px,transparent_50%)]" />
      </div>

      <div className="relative p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-start gap-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Meine Aufgaben
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Alle Ihnen zugewiesenen Aufgaben an einem Ort
              </p>
            </div>
          </div>
          
          {/* Neue Aufgabe Button */}
          <div>
            <Button 
              variant="default" 
              onClick={() => setIsNewTaskDialogOpen(true)}
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              Neue Aufgabe
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-x-auto">
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-6 pb-4">
              {defaultColumns.map((column) => {
                // Alle Aufgaben für diese Spalte finden - sowohl persönliche als auch Board-gebundene Aufgaben
                const columnTasks = tasks
                  .filter(task => {
                    // Aufgaben müssen den richtigen Status haben
                    if (task.status !== column.id) return false;
                    // Sowohl persönliche Aufgaben (boardId === null oder isPersonal === true) als auch 
                    // Board-gebundene Aufgaben anzeigen
                    return true;
                  })
                  .sort((a, b) => (a.order || 0) - (b.order || 0));

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

        {/* Dialog für Aufgabendetails */}
        <TaskDialog
          task={selectedTask || undefined}
          open={isTaskDialogOpen}
          onOpenChange={setIsTaskDialogOpen}
          onUpdate={handleTaskUpdate}
          mode="details"
        />
        
        {/* Dialog für neue Aufgaben - mit personalTask=true für persönliche Aufgabenerstellung */}
        <TaskDialog
          open={isNewTaskDialogOpen}
          onOpenChange={setIsNewTaskDialogOpen}
          onUpdate={handleTaskUpdate}
          mode="edit"
          initialColumnId={0}
          personalTask={true}
        />
      </div>
    </div>
  );
}