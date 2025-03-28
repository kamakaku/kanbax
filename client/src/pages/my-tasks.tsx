import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Task } from "@shared/schema";
import { DragDropContext, DropResult } from "react-beautiful-dnd";
import { Column as ColumnComponent } from "@/components/board/column";
import { TaskDialog } from "@/components/board/task-dialog";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PlusCircle, Archive, Search, Tag, Filter, Clock, X, LayoutGrid, Table } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { de } from "date-fns/locale";

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
  const [showArchivedTasks, setShowArchivedTasks] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [viewMode, setViewMode] = useState('kanban'); // Add viewMode state
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Laden der zugewiesenen Aufgaben des aktuellen Benutzers
  const { data: tasks = [], isLoading, error } = useQuery<TaskWithDetails[]>({
    queryKey: ["/api/user/tasks/assigned"],
    queryFn: async () => {
      const result = await apiRequest<TaskWithDetails[]>("GET", "/api/user/tasks/assigned");

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
    return tasks.filter(task => {
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

      // Filter for archived tasks
      if (task.archived && !showArchivedTasks) return false;

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
                onClick={() => setIsNewTaskDialogOpen(true)}
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
                            className="text-sm font-medium leading-none cursor-pointer flex-1"
                          >
                            {label}
                          </label>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500 p-2">Keine Labels verfügbar</p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Prioritäten Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    <Filter className="h-4 w-4" />
                    <span>Priorität</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-60 p-2">
                  <div className="space-y-1">
                    {["high", "medium", "low"].map((priority) => (
                      <div key={priority} className="flex items-center space-x-2">
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
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {priority === "high" && "Hoch"}
                          {priority === "medium" && "Mittel"}
                          {priority === "low" && "Niedrig"}
                        </label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Fälligkeitsdatum Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    <Clock className="h-4 w-4" />
                    <span>Fällig</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    locale={de}
                    className="rounded-md border shadow"
                  />
                  {selectedDate && (
                    <div className="p-3 border-t flex justify-between items-center">
                      <span className="text-sm">
                        {format(selectedDate, "PPP", { locale: de })}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedDate(undefined)}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Zurücksetzen
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>

              {/* Reset Filter Button - nur anzeigen, wenn mindestens ein Filter aktiv ist */}
              {(searchQuery || selectedLabels.length > 0 || selectedPriorities.length > 0 || selectedDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="text-blue-500 hover:text-blue-700"
                >
                  <X className="h-4 w-4 mr-1" />
                  Filter zurücksetzen
                </Button>
              )}
            </div>

            {/* RECHTE SEITE: View-Mode Switcher und Archiv-Toggle */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center border rounded-md">
                  <Button
                    variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                    onClick={() => {
                      setViewMode('kanban');
                      setShowArchivedTasks(false);
                    }}
                    size="icon"
                    className="rounded-none rounded-l-md"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'table' ? 'default' : 'ghost'}
                    onClick={() => {
                      setViewMode('table');
                      setShowArchivedTasks(false);
                    }}
                    size="icon"
                    className="rounded-none rounded-r-md"
                  >
                    <Table className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="flex items-center">
                  <Switch
                    id="show-archived"
                    checked={showArchivedTasks}
                    onCheckedChange={setShowArchivedTasks}
                  />
                  <label
                    htmlFor="show-archived"
                    className="flex items-center ml-2 cursor-pointer"
                  >
                    <div className="relative">
                      <Archive className={`h-4 w-4 ${!showArchivedTasks ? "text-slate-400" : "text-slate-700"}`} />
                      {!showArchivedTasks && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-5 h-px bg-slate-400 rotate-45"></div>
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1">
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-6 pb-4">
              {defaultColumns.map((column) => {
                // Alle Aufgaben für diese Spalte finden - sowohl persönliche als auch Board-gebundene Aufgaben
                const columnTasks = filteredTasks
                  .filter(task => {
                    // Aufgaben müssen den richtigen Status haben
                    if (task.status !== column.id) return false;

                    // Archivierte Aufgaben filtern, es sei denn showArchivedTasks ist true
                    if (task.archived && !showArchivedTasks) return false;

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
                    showArchivedTasks={showArchivedTasks}
                    onClick={(task) => {
                      setSelectedTask(task as TaskWithDetails);
                      setIsTaskDialogOpen(true);
                    }}
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

        {/* Dialog für neue Aufgaben - mit isPersonalTask=true für persönliche Aufgabenerstellung */}
        <TaskDialog
          open={isNewTaskDialogOpen}
          onOpenChange={setIsNewTaskDialogOpen}
          onUpdate={handleTaskUpdate}
          mode="edit"
          initialColumnId={0}
          isPersonalTask={true}
        />
      </div>
    </div>
  );
}