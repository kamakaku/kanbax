import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Task } from "@shared/schema";
import { DragDropContext, DropResult } from "react-beautiful-dnd";
import { Column as ColumnComponent } from "@/components/board/column";
import { TaskDialog } from "@/components/board/task-dialog";
import { GenericLimitWarningDialog } from "@/components/subscription/generic-limit-warning-dialog";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PlusCircle, Archive, Search, Tag, Filter, Clock, X, LayoutGrid, Table } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { BoardTableView } from "@/components/board/board-table-view"; // Added import
import { useLocation } from "wouter"; // Import für useLocation Hook hinzugefügt

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
  const [location, setLocation] = useLocation();
  const [showArchivedTasks, setShowArchivedTasks] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [viewMode, setViewMode] = useState('kanban'); // Add viewMode state
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Laden der zugewiesenen Aufgaben des aktuellen Benutzers
  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/current-user"],
  });

  const subscriptionTier = currentUser?.subscriptionTier?.toLowerCase() || 'free';
  const hasTaskAccess = ['organisation', 'enterprise'].includes(subscriptionTier);
  
  // Query für die Aufgaben - außerhalb des if-Statements platziert
  const { data: tasks = [], isLoading, error } = useQuery<TaskWithDetails[]>({
    queryKey: ["/api/user-tasks"],
    queryFn: async () => {
      // Wenn kein Zugriff, geben wir ein leeres Array zurück
      if (!hasTaskAccess) return [];

      const result = await apiRequest<TaskWithDetails[]>("GET", "/api/user-tasks");

      // Debug-Logging für die geladenen Aufgaben
      console.log("Geladene Aufgaben:", result);

      // Persönliche Aufgaben identifizieren und markieren
      const transformedTasks = result.map(task => {
        // Wenn boardId null ist, handelt es sich um eine persönliche Aufgabe
        if (task.boardId === null) {
          return {
            ...task,
            isPersonal: true
          };
        }
        return task;
      });

      // Debug-Logging für persönliche Aufgaben
      const personalTasks = transformedTasks.filter(task => task.boardId === null || task.isPersonal);
      console.log("Persönliche Aufgaben:", personalTasks);

      return transformedTasks;
    },
    staleTime: 1000 * 60, // 1 Minute
  });
  
  // Prüfen, ob ein Task-ID über die URL weitergegeben wurde
  useEffect(() => {
    if (!tasks || tasks.length === 0) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const taskId = urlParams.get('taskId');
    
    if (taskId) {
      const task = tasks.find(t => t.id === parseInt(taskId));
      if (task) {
        setSelectedTask(task);
        setIsTaskDialogOpen(true);
      }
    }
  }, [tasks]);
  
  // State für den Limit-Dialog
  const [showTaskLimitWarning, setShowTaskLimitWarning] = useState(false);
  
  const handleNewTaskDialog = async () => {
    // Zuerst prüfen, ob wir das Limit erreicht haben
    try {
      const response = await fetch("/api/limits/task-creation");
      if (response.ok) {
        const data = await response.json();
        if (data.limitReached) {
          // Wenn das Limit erreicht ist, zeigen wir den Warnungs-Dialog
          setShowTaskLimitWarning(true);
          return;
        }
      }
    } catch (error) {
      console.error("Fehler beim Prüfen des Task-Limits:", error);
    }
    
    // Wenn kein Limit erreicht ist oder die Prüfung fehlschlägt, fahren wir fort
    setSelectedLabels([]); // Labels zurücksetzen
    setIsNewTaskDialogOpen(true);
    // Form-Werte müssen im TaskDialog zurückgesetzt werden
  };

  // Extrahiere alle eindeutigen Labels aus den Aufgaben
  const allLabels = useMemo(() => {
    if (!tasks || !tasks.length) return [];
    const labelSet = new Set<string>();
    tasks.forEach(task => {
      if (task.labels && Array.isArray(task.labels)) {
        task.labels.forEach(label => {
          if (label) labelSet.add(label);
        });
      }
    });
    return Array.from(labelSet).sort();
  }, [tasks]);

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

  // Filter und Suchfunktionalität
  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    
    return tasks
      .filter((task) => showArchivedTasks ? true : !task.archived)
      .filter((task) => {
        // Suche im Titel oder in der Beschreibung
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const titleMatch = task.title?.toLowerCase().includes(query);
          const descMatch = task.description?.toLowerCase().includes(query);
          if (!titleMatch && !descMatch) return false;
        }

        // Filter nach Labels
        if (selectedLabels.length > 0) {
          if (!task.labels || !Array.isArray(task.labels)) return false;
          const hasSelectedLabel = selectedLabels.some(label =>
            task.labels && task.labels.includes(label)
          );
          if (!hasSelectedLabel) return false;
        }

        // Filter nach Prioritäten
        if (selectedPriorities.length > 0) {
          if (!selectedPriorities.includes(task.priority || '')) return false;
        }

        // Filter nach Fälligkeitsdatum
        if (selectedDate && task.dueDate) {
          const taskDate = new Date(task.dueDate);
          const selectedDateString = format(selectedDate, 'yyyy-MM-dd');
          const taskDateString = format(taskDate, 'yyyy-MM-dd');
          if (taskDateString !== selectedDateString) return false;
        }

        return true;
      });
  }, [tasks, searchQuery, selectedLabels, selectedPriorities, selectedDate, showArchivedTasks]);

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

  // Handler für das Zurücksetzen aller Filter
  const resetFilters = () => {
    setSearchQuery("");
    setSelectedLabels([]);
    setSelectedPriorities([]);
    setSelectedDate(undefined);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      {/* Background gradients */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(at_80%_0%,rgb(248,250,252)_0px,transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(at_0%_50%,rgb(241,245,249)_0px,transparent_50%)]" />
      </div>

      {!hasTaskAccess ? (
        <div className="container mx-auto p-8 relative">
          <Card className="p-6">
            <CardHeader>
              <CardTitle className="text-xl">Aufgabenverwaltung nicht verfügbar</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Die Aufgabenverwaltung ist nur in den Paketen "Organisation" und "Enterprise" verfügbar. 
                Bitte upgraden Sie Ihr Abonnement, um diese Funktion nutzen zu können.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          <div className="relative p-8">
            {/* Header mit Titel und Button */}
            <div className="flex flex-col gap-1 mb-2">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">
                    Meine Aufgaben
                  </h1>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Alle Ihnen zugewiesenen Aufgaben an einem Ort
                  </p>
                </div>

                {/* Neue Aufgabe Button und View Mode Controls */}
                <div className="flex items-center gap-4">
                  <Button
                    onClick={handleNewTaskDialog}
                    className="bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white shadow-md transition-all duration-300 hover:shadow-lg"
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Neue Aufgabe
                  </Button>
                </div>
              </div>

              {/* Filter- und Archiv-Zeile - alles in EINER Zeile */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-md">
                {/* LINKE SEITE: Suchfeld und Filter */}
                <div className="flex flex-1 items-center gap-2">
                  {/* Suchfeld - ausklappbar */}
                  <div className="flex items-center relative">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="icon" className="h-9 w-9">
                          <Search className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-0" side="bottom" align="start">
                        <div className="flex items-center px-3 py-2">
                          <Search className="h-4 w-4 mr-2 text-slate-400" />
                          <Input
                            placeholder="Tasks durchsuchen..."
                            className="border-none shadow-none focus-visible:ring-0 h-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                          />
                          {searchQuery && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSearchQuery("")}
                              className="ml-2 h-8 px-2"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                    {searchQuery && (
                      <Badge variant="secondary" className="ml-2">
                        Suche: {searchQuery}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSearchQuery("")}
                          className="h-4 w-4 ml-1 p-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    )}
                  </div>

                  {/* Label Filter */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1">
                        <Tag className="h-4 w-4" />
                        <span>Labels</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-60 p-2">
                      <div className="space-y-1 max-h-60 overflow-auto">
                        {allLabels.length > 0 ? (
                          allLabels.map(label => (
                            <div
                              key={label}
                              className="flex items-center space-x-2 p-2 rounded-md hover:bg-slate-100 transition-colors"
                            >
                              <Checkbox
                                id={`label-${label}`}
                                checked={selectedLabels.includes(label)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedLabels(prev => [...prev, label]);
                                  } else {
                                    setSelectedLabels(prev => prev.filter(l => l !== label));
                                  }
                                }}
                              />
                              <label
                                htmlFor={`label-${label}`}
                                className="flex-1 text-sm cursor-pointer"
                              >
                                {label}
                              </label>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground p-2">Keine Labels vorhanden</p>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Priorität Filter */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1">
                        <Filter className="h-4 w-4" />
                        <span>Priorität</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-60 p-2">
                      <div className="space-y-1">
                        {["high", "medium", "low"].map(priority => (
                          <div
                            key={priority}
                            className="flex items-center space-x-2 p-2 rounded-md hover:bg-slate-100 transition-colors"
                          >
                            <Checkbox
                              id={`priority-${priority}`}
                              checked={selectedPriorities.includes(priority)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedPriorities(prev => [...prev, priority]);
                                } else {
                                  setSelectedPriorities(prev => prev.filter(p => p !== priority));
                                }
                              }}
                            />
                            <label
                              htmlFor={`priority-${priority}`}
                              className="flex-1 text-sm cursor-pointer capitalize"
                            >
                              {priority === "high" ? "Hoch" : priority === "medium" ? "Mittel" : "Niedrig"}
                            </label>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Datums Filter */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1">
                        <Clock className="h-4 w-4" />
                        <span>Datum</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-2" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        initialFocus
                        locale={de}
                      />
                      {selectedDate && (
                        <div className="flex justify-end mt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedDate(undefined)}
                          >
                            Zurücksetzen
                          </Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>

                  {/* Filter zurücksetzen */}
                  {(searchQuery || selectedLabels.length > 0 || selectedPriorities.length > 0 || selectedDate) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetFilters}
                      className="text-xs"
                    >
                      Filter zurücksetzen
                    </Button>
                  )}
                </div>

                {/* RECHTE SEITE: Archiv-Toggle und View-Switch */}
                <div className="flex items-center gap-4">
                  {/* Archiv-Toggle */}
                  <div className="flex items-center gap-2">
                    <Switch
                      id="archived-toggle"
                      checked={showArchivedTasks}
                      onCheckedChange={setShowArchivedTasks}
                    />
                    <label htmlFor="archived-toggle" className="text-sm cursor-pointer">
                      Archivierte anzeigen
                    </label>
                  </div>

                  {/* View Mode Toggle */}
                  <div className="flex border rounded-md overflow-hidden">
                    <Button
                      variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                      size="sm"
                      className="rounded-none px-3"
                      onClick={() => setViewMode('kanban')}
                    >
                      <LayoutGrid className="h-4 w-4 mr-1" />
                      <span className="text-xs">Kanban</span>
                    </Button>
                    <Button
                      variant={viewMode === 'table' ? 'default' : 'ghost'}
                      size="sm"
                      className="rounded-none px-3"
                      onClick={() => setViewMode('table')}
                    >
                      <Table className="h-4 w-4 mr-1" />
                      <span className="text-xs">Tabelle</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Board-Ansicht */}
            {viewMode === 'kanban' ? (
              <DragDropContext onDragEnd={handleDragEnd}>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-4">
                  {defaultColumns.map((column) => (
                    <ColumnComponent
                      key={column.id}
                      id={column.id}
                      title={column.title}
                      tasks={filteredTasks.filter((task) => task.status === column.id)}
                      onTaskClick={(task: Task) => {
                        setSelectedTask(task as TaskWithDetails);
                        setIsTaskDialogOpen(true);
                      }}
                      boardId={null} // Persönliche Aufgaben haben kein Board
                      showStatus={false} // Status wird bereits durch die Spalten angezeigt
                      showBoardInfo // Zusätzliche Board-Informationen anzeigen
                    />
                  ))}
                </div>
              </DragDropContext>
            ) : (
              <div className="mt-4">
                <BoardTableView 
                  tasks={filteredTasks} 
                  onTaskClick={(task) => {
                    setSelectedTask(task as TaskWithDetails);
                    setIsTaskDialogOpen(true);
                  }}
                  showBoardInfo={true}
                  showProjectInfo={true}
                />
              </div>
            )}

            {/* Task Dialog für Bearbeitung */}
            {selectedTask && (
              <TaskDialog
                open={isTaskDialogOpen}
                onOpenChange={setIsTaskDialogOpen}
                task={selectedTask}
                onUpdate={handleTaskUpdate}
              />
            )}

            {/* Neuer Task Dialog */}
            <TaskDialog
              open={isNewTaskDialogOpen}
              onOpenChange={setIsNewTaskDialogOpen}
              onUpdate={async (newTask) => {
                try {
                  await apiRequest("POST", "/api/tasks", {
                    ...newTask,
                    boardId: null, // Persönliche Aufgabe ohne Board
                  });
                  queryClient.invalidateQueries({ queryKey: ["/api/user/tasks/assigned"] });
                  toast({
                    title: "Aufgabe erstellt",
                    description: "Die Aufgabe wurde erfolgreich erstellt.",
                  });
                  setIsNewTaskDialogOpen(false);
                } catch (error) {
                  toast({
                    title: "Fehler",
                    description: `Fehler beim Erstellen: ${(error as Error).message}`,
                    variant: "destructive",
                  });
                }
              }}
              isPersonalTask={true}
              task={undefined}
            />
          </div>

          {/* Warning dialog outside the main content div but inside the access control fragment */}
          <GenericLimitWarningDialog
            open={showTaskLimitWarning}
            onOpenChange={setShowTaskLimitWarning}
            title="Aufgaben-Limit erreicht"
            limitType="tasks"
            resourceName="Aufgabe"
            resourceNamePlural="Aufgaben"
            endpoint="/api/limits/task-creation"
          />
        </>
      )}
    </div>
  );
}