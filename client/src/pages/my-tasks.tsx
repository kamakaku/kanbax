import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Task } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskDialog } from "@/components/board/task-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, CalendarDays, CircleCheck, Tag } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

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
}

// Hilfsfunktion zur Formatierung des Fälligkeitsdatums
function formatDueDate(dateString: string | Date): string {
  const date = typeof dateString === "string" ? new Date(dateString) : dateString;
  return format(date, "dd. MMM yyyy", { locale: de });
}

// Komponente für die Anzeige der Priorität als Badge
function PriorityBadge({ priority }: { priority: string }) {
  let variant: "default" | "destructive" | "outline" | "secondary" = "default";
  
  switch (priority) {
    case "high":
      variant = "destructive";
      break;
    case "medium":
      variant = "secondary";
      break;
    case "low":
      variant = "outline";
      break;
    default:
      variant = "default";
  }

  const priorityText = {
    high: "Hoch",
    medium: "Mittel",
    low: "Niedrig"
  }[priority] || priority;

  return (
    <Badge variant={variant} className="ml-2">
      {priorityText}
    </Badge>
  );
}

// Hauptkomponente für "Meine Aufgaben"
export default function MyTasks() {
  const [selectedTask, setSelectedTask] = useState<TaskWithDetails | null>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Laden der zugewiesenen Aufgaben des aktuellen Benutzers
  const { data: tasks, isLoading, error } = useQuery<TaskWithDetails[]>({
    queryKey: ["/api/user/tasks/assigned"],
    queryFn: async () => {
      return apiRequest<TaskWithDetails[]>("GET", "/api/user/tasks/assigned");
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

  // Handler für Aufgaben-Klick
  const handleTaskClick = (task: TaskWithDetails) => {
    setSelectedTask(task);
    setIsTaskDialogOpen(true);
  };

  // Handler für Aufgaben-Update
  const handleTaskUpdate = async (updatedTask: Task): Promise<void> => {
    await updateTaskMutation.mutateAsync(updatedTask);
    return;
  };

  // Gruppiert Aufgaben nach Status
  const groupTasksByStatus = () => {
    if (!tasks || !Array.isArray(tasks)) return {};
    
    const groups: Record<string, TaskWithDetails[]> = {};
    
    tasks.forEach((task: TaskWithDetails) => {
      if (!groups[task.status]) {
        groups[task.status] = [];
      }
      groups[task.status].push(task);
    });
    
    return groups;
  };

  // Status-Übersetzungen und Reihenfolge
  const statusOrder = ["todo", "in-progress", "review", "done", "backlog"];
  const statusTranslations: Record<string, string> = {
    "todo": "Zu erledigen",
    "in-progress": "In Bearbeitung",
    "review": "In Überprüfung",
    "done": "Erledigt",
    "backlog": "Backlog"
  };

  // Status-Gruppen sortieren
  const sortedGroups = Object.entries(groupTasksByStatus())
    .sort(([statusA], [statusB]) => {
      const indexA = statusOrder.indexOf(statusA);
      const indexB = statusOrder.indexOf(statusB);
      return indexA - indexB;
    });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Meine Aufgaben</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-1/3 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Meine Aufgaben</h1>
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Fehler beim Laden</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Es ist ein Fehler beim Laden der Aufgaben aufgetreten. Bitte versuchen Sie es später erneut.</p>
            <p className="text-sm text-muted-foreground mt-2">{(error as Error).message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Meine Aufgaben</h1>
      </div>
      
      {sortedGroups.length > 0 ? (
        <div className="space-y-6">
          {sortedGroups.map(([status, statusTasks]) => (
            <div key={status} className="space-y-3">
              <h2 className="text-xl font-semibold">
                {statusTranslations[status] || status}
                <Badge variant="outline" className="ml-2">
                  {statusTasks.length}
                </Badge>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {statusTasks.map((task: TaskWithDetails) => (
                  <Card 
                    key={task.id} 
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleTaskClick(task)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-base">{task.title}</CardTitle>
                        <PriorityBadge priority={task.priority} />
                      </div>
                      {task.board && (
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <ArrowUpRight size={12} />
                          {task.board.title}
                          {task.project && (
                            <span className="text-xs ml-1">
                              ({task.project.title})
                            </span>
                          )}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {task.description && (
                        <p className="text-sm line-clamp-2">{task.description}</p>
                      )}
                      <div className="flex flex-wrap gap-2 pt-2">
                        {task.dueDate && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarDays size={12} />
                            <span>Fällig: {formatDueDate(task.dueDate)}</span>
                          </div>
                        )}
                        {task.checklist && task.checklist.length > 0 && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CircleCheck size={12} />
                            <span>
                              {task.checklist.filter((item: any) => item.checked).length}/{task.checklist.length}
                            </span>
                          </div>
                        )}
                        {task.labels && task.labels.length > 0 && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Tag size={12} />
                            <span>
                              {task.labels.length} Label{task.labels.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center p-8 border rounded-lg bg-card">
          <h3 className="text-xl font-semibold mb-2">Keine zugewiesenen Aufgaben</h3>
          <p className="text-muted-foreground mb-4">
            Dir sind derzeit keine Aufgaben zugewiesen.
          </p>
        </div>
      )}

      {/* Dialog für Aufgabendetails */}
      <TaskDialog
        task={selectedTask || undefined}
        open={isTaskDialogOpen}
        onOpenChange={setIsTaskDialogOpen}
        onUpdate={handleTaskUpdate}
        mode="details"
      />
    </div>
  );
}