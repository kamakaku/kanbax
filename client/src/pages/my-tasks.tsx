import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CircularProgressIndicator } from "@/components/ui/circular-progress";
import { Task } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TaskDialog } from "@/components/board/task-dialog";
import { Clock, CircleCheck, CalendarDays, ArrowUpRight, Tag } from "lucide-react";

export default function MyTasks() {
  const { toast } = useToast();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);

  // Abfrage der zugewiesenen Aufgaben
  const { data: assignedTasks, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/user/tasks/assigned'],
    queryFn: () => apiRequest<Task[]>('/api/user/tasks/assigned', 'GET'),
  });

  // Gruppiere Aufgaben nach Status
  const groupedTasks = assignedTasks ? 
    assignedTasks.reduce((acc: Record<string, Task[]>, task) => {
      if (!acc[task.status]) {
        acc[task.status] = [];
      }
      acc[task.status].push(task);
      return acc;
    }, {}) : {};

  // Status-Mapping für übersetzungen
  const statusTranslations: Record<string, string> = {
    'backlog': 'Backlog',
    'todo': 'Zu erledigen',
    'in-progress': 'In Bearbeitung',
    'review': 'Review',
    'done': 'Erledigt'
  };

  // Status-Reihenfolge
  const statusOrder = ['in-progress', 'todo', 'review', 'backlog', 'done'];

  // Status-Farben
  const statusColors: Record<string, string> = {
    'backlog': 'bg-slate-200 text-slate-800',
    'todo': 'bg-blue-100 text-blue-800',
    'in-progress': 'bg-amber-100 text-amber-800',
    'review': 'bg-purple-100 text-purple-800',
    'done': 'bg-green-100 text-green-800'
  };

  // Handler für das Klicken auf eine Aufgabe
  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsTaskDialogOpen(true);
  };

  // Handler für das Aktualisieren einer Aufgabe
  const handleTaskUpdate = async (updatedTask: Task) => {
    try {
      await apiRequest(`/api/tasks/${updatedTask.id}`, 'PATCH', updatedTask);
      toast({
        title: 'Aufgabe aktualisiert',
        description: 'Die Aufgabe wurde erfolgreich aktualisiert.',
      });
      refetch();
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Aufgabe:', error);
      toast({
        title: 'Fehler',
        description: 'Die Aufgabe konnte nicht aktualisiert werden.',
        variant: 'destructive',
      });
    }
  };

  // Formatieren des Fälligkeitsdatums
  const formatDueDate = (dateString?: string | null) => {
    if (!dateString) return null;
    
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE');
  };

  // Prioritäts-Badge
  const PriorityBadge = ({ priority }: { priority: string }) => {
    const colors: Record<string, string> = {
      'high': 'bg-red-100 text-red-800',
      'medium': 'bg-amber-100 text-amber-800',
      'low': 'bg-green-100 text-green-800'
    };
    
    const labels: Record<string, string> = {
      'high': 'Hoch',
      'medium': 'Mittel',
      'low': 'Niedrig'
    };

    return (
      <Badge className={colors[priority] || ''}>
        {labels[priority] || priority}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="mb-4">
            <CircularProgressIndicator value={0} size="lg" />
          </div>
          <p className="text-sm text-muted-foreground">Lade zugewiesene Aufgaben...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-destructive mb-2">Fehler beim Laden</h2>
        <p className="text-muted-foreground mb-4">
          {error instanceof Error ? error.message : 'Unbekannter Fehler'}
        </p>
        <Button onClick={() => refetch()} variant="outline">
          Erneut versuchen
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Meine Aufgaben</h1>
          <p className="text-muted-foreground mt-1">
            Alle Aufgaben, die dir zugewiesen sind
          </p>
        </div>
        <Button onClick={() => refetch()}>Aktualisieren</Button>
      </div>

      {/* Aufgaben nach Status gruppiert anzeigen */}
      {assignedTasks && assignedTasks.length > 0 ? (
        <div className="space-y-6">
          {statusOrder.map(status => (
            groupedTasks[status] && groupedTasks[status].length > 0 && (
              <div key={status} className="rounded-lg border bg-card shadow-sm">
                <div className="p-4 flex items-center gap-2">
                  <Badge className={statusColors[status]}>
                    {statusTranslations[status] || status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {groupedTasks[status].length} Aufgabe{groupedTasks[status].length !== 1 ? 'n' : ''}
                  </span>
                </div>
                <Separator />
                <div className="p-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {groupedTasks[status].map(task => (
                    <Card 
                      key={task.id} 
                      className="cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => handleTaskClick(task)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-base">{task.title}</CardTitle>
                          <PriorityBadge priority={task.priority} />
                        </div>
                        {task.board && task.board.title && (
                          <CardDescription className="flex items-center gap-1 mt-1">
                            <ArrowUpRight size={12} />
                            {task.board.title}
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
            )
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
        task={selectedTask}
        open={isTaskDialogOpen}
        onOpenChange={setIsTaskDialogOpen}
        onUpdate={handleTaskUpdate}
        mode="details"
      />
    </div>
  );
}