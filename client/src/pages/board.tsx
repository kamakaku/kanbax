import { useEffect, useState, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { DragDropContext, type DropResult } from "react-beautiful-dnd";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type Board, type Column, type Task, type InsertBoard, type Team, type User } from "@shared/schema";
import { Column as ColumnComponent } from "@/components/board/column";
// BoardSelector wurde entfernt
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { 
  Pencil, Star, Users, Building2, Calendar as CalendarIcon, Archive, RotateCcw, 
  Eye, EyeOff, PlusCircle, MoreVertical, Tag, Filter, Clock, Search, X, Plus
} from "lucide-react";
import { BoardForm } from "@/components/board/board-form";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { TaskDialog } from "@/components/board/task-dialog";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";

// Define the default columns for the Kanban board
const defaultColumns = [
  { id: "backlog", title: "Backlog" },
  { id: "todo", title: "To Do" },
  { id: "in-progress", title: "In Progress" },
  { id: "review", title: "Review" },
  { id: "done", title: "Done" }
];

// Standard-Labels für neue Boards
const defaultLabels = [
  "Wichtig", "Dringend", "Dokumentation", "Design", "Entwicklung", 
  "Feedback", "Bug", "Feature", "Verbesserung", "Recherche", "Meeting", 
  "Planung", "Review", "Test", "UX", "Vorarbeit", "Zuarbeit"
];

export function Board() {
  const { id } = useParams<{ id: string }>();
  const boardId = parseInt(id);
  const { toast } = useToast();
  const [path] = useLocation();
  const taskId = new URL(window.location.href).searchParams.get('taskId');
  const [, setLocation] = useLocation();
  const { currentBoard, setCurrentBoard } = useStore();
  const [showEditForm, setShowEditForm] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [showArchivedTasks, setShowArchivedTasks] = useState(false);
  const [showNewTaskDialog, setShowNewTaskDialog] = useState(false);
  const [initialColumnId, setInitialColumnId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState('kanban'); // Add view mode state

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [allLabels, setAllLabels] = useState<string[]>([]);
  const [newLabelInput, setNewLabelInput] = useState("");

  // Fetch board data
  const { data: board, isLoading: isBoardLoading, error: boardError } = useQuery<Board>({
    queryKey: ["/api/boards", boardId],
    queryFn: async () => {
      const response = await fetch(`/api/boards/${boardId}`);
      if (!response.ok) {
        throw new Error("Fehler beim Laden des Boards");
      }
      return response.json();
    },
  });

  // Fetch teams data
  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
    queryFn: async () => {
      const response = await fetch("/api/teams");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Teams");
      }
      return response.json();
    },
  });

  // Fetch users data
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Benutzer");
      }
      return response.json();
    },
  });

  // Get team, user and creator information
  const getTeamAndUserInfo = () => {
    if (!board) return { teams: [], users: [], creator: null };

    const boardTeams = teams.filter(team => board.team_ids?.includes(team.id));
    const boardUsers = users.filter(user => board.assigned_user_ids?.includes(user.id));
    const creator = users.find(user => user.id === board.creator_id);

    return { teams: boardTeams, users: boardUsers, creator };
  };

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/boards", boardId, "tasks"],
    queryFn: async () => {
      const res = await fetch(`/api/boards/${boardId}/tasks`);
      if (!res.ok) throw new Error("Failed to fetch tasks");
      const data = await res.json();
      console.log("Geladene Tasks:", data); // Debug-Log
      return data;
    },
    enabled: !!boardId,
    retry: 3
  });

  // Debug-Log für gefilterte Tasks
  useEffect(() => {
    console.log("Aktuell angezeigte Tasks:", tasks);
  }, [tasks]);

  useEffect(() => {
    if (board) {
      setCurrentBoard(board);
    }

    // Extrahiere alle Labels aus den Tasks
    if (tasks) {
      const labelSet = new Set<string>();
      tasks.forEach(task => {
        if (task.labels && Array.isArray(task.labels)) {
          task.labels.forEach(label => {
            if (label && typeof label === 'string' && label.trim() !== '') {
              labelSet.add(label);
            }
          });
        }
      });
      setAllLabels(Array.from(labelSet).sort((a, b) => 
        a.localeCompare(b, 'de', { sensitivity: 'base' })
      ));
    }
  }, [board, setCurrentBoard, tasks]);

  const updateBoard = useMutation({
    mutationFn: async (data: InsertBoard) => {
      if (!boardId) return null;
      return await apiRequest("PATCH", `/api/boards/${boardId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId] });
      toast({ title: "Board erfolgreich aktualisiert" });
      setShowEditForm(false);
    },
    onError: (error) => {
      console.error("Update error:", error);
      toast({
        title: "Fehler beim Aktualisieren",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleFavorite = useMutation({
    mutationFn: async () => {
      if (!boardId) return null;
      return await apiRequest('PATCH', `/api/boards/${boardId}/favorite`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId] });
      toast({ title: "Favoriten-Status aktualisiert" });
    },
  });

  // Archivierungsmutation
  const archiveBoard = useMutation({
    mutationFn: async () => {
      if (!boardId) return null;
      return await apiRequest('PATCH', `/api/boards/${boardId}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId] });

      toast({
        title: "Board archiviert",
        description: "Das Board wurde erfolgreich archiviert.",
      });

      // Zurück zur Projektseite oder Boards-Übersicht
      setLocation(board?.project_id ? `/projects/${board.project_id}` : '/all-boards');
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Archivieren",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Wiederherstellungsmutation
  const unarchiveBoard = useMutation({
    mutationFn: async () => {
      if (!boardId) return null;
      return await apiRequest('PATCH', `/api/boards/${boardId}/unarchive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId] });

      toast({
        title: "Board wiederhergestellt",
        description: "Das Board wurde erfolgreich wiederhergestellt.",
      });

      setConfirmArchive(false);
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Wiederherstellen",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const updateTask = useMutation({
    mutationFn: async (updatedTask: Task) => {
      return await apiRequest<Task>("PATCH", `/api/tasks/${updatedTask.id}`, updatedTask);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/boards", boardId, "tasks"],
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

      queryClient.setQueryData(["/api/boards", boardId, "tasks"], updatedTasks);

      await updateTask.mutateAsync({
        ...draggedTask,
        status: destination.droppableId,
        order: destination.index,
      });
    } catch (error) {
      console.error("Fehler beim Aktualisieren:", error);
      queryClient.invalidateQueries({
        queryKey: ["/api/boards", boardId, "tasks"],
      });
      toast({
        title: "Fehler beim Verschieben",
        description: "Bitte versuchen Sie es erneut",
        variant: "destructive",
      });
    }
  };

  if (isBoardLoading || tasksLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Laden...</p>
      </div>
    );
  }

  if (boardError || !board) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground mb-4">
          {boardError?.message || "Board konnte nicht geladen werden"}
        </p>
        <Button
          variant="outline"
          onClick={() => window.history.back()}
        >
          Zurück
        </Button>
      </div>
    );
  }

  const { teams: boardTeams, users: boardUsers, creator } = getTeamAndUserInfo();
  const boardColumns = defaultColumns; // Using defaultColumns for now


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      {/* Background gradients */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(at_80%_0%,rgb(248,250,252)_0px,transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(at_0%_50%,rgb(241,245,249)_0px,transparent_50%)]" />
      </div>

      <div className="relative p-8">
        {/* Header - neue Struktur */}
        <div className="flex flex-col gap-1 mb-2">
          {/* Erste Zeile: Titel + Fav-Stern / Buttons rechts */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">
                {board.title}
              </h1>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => toggleFavorite.mutate()}
                className="hover:bg-slate-100 mt-0.5"
              >
                <Star
                  className={`h-5 w-5 ${board.is_favorite ? "fill-yellow-400 text-yellow-400" : "text-slate-400"}`}
                />
              </Button>
            </div>

            <div className="flex items-center gap-3">
              {board.archived && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  Archiviert
                </Badge>
              )}

              {/* Aktionsmenü mit Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="default"
                    size="icon" 
                    className="h-8 w-8 bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white shadow-md"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setShowEditForm(true)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    <span>Bearbeiten</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem 
                    onClick={() => {
                      setInitialColumnId(null); // Kein spezieller Status, Standard ist backlog
                      setShowNewTaskDialog(true);
                    }}
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    <span>Neuer Task</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {board.archived ? (
                    <DropdownMenuItem onClick={() => unarchiveBoard.mutate()} className="text-blue-600">
                      <RotateCcw className="h-4 w-4 mr-2" />
                      <span>Wiederherstellen</span>
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => setConfirmArchive(true)} className="text-gray-600">
                      <Archive className="h-4 w-4 mr-2" />
                      <span>Archivieren</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Zweite Zeile: Projekt (falls zugeordnet) */}
          {board.project && (
            <div className="flex items-center mt-0.5">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className="font-medium">Projekt:</span> {board.project.title}
              </p>
            </div>
          )}

          {/* Dritte Zeile: Ersteller + Benutzer */}
          <div className="flex gap-6 mt-0.5">
            {/* Creator Section - Jetzt mit blauem Rand ohne Text */}
            {creator && (
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                  <Avatar className="h-7 w-7 border-2 border-blue-500 shadow-sm">
                    <AvatarImage src={creator.avatarUrl || undefined} alt={creator.username} />
                    <AvatarFallback className="text-xs bg-blue-100 text-blue-800">
                      {creator.username.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </div>
            )}

            {/* Teams Section */}
            {boardTeams.length > 0 && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div className="flex flex-wrap gap-1">
                  {boardTeams.map((team) => (
                    <Badge key={team.id} variant="outline" className="bg-white shadow-sm hover:bg-slate-50">
                      {team.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Users Section - Neue überlappende Avatar-Darstellung */}
            {boardUsers.length > 0 && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div className="flex -space-x-2 overflow-hidden ml-1">
                  {boardUsers
                    .filter(user => user.id !== board.creator_id) // Filtere Creator aus, da er bereits angezeigt wird
                    .map((user) => (
                      <Avatar key={user.id} className="h-9 w-9 border-2 border-white rounded-full">
                        <AvatarImage src={user.avatarUrl || undefined} alt={user.username} />
                        <AvatarFallback className="text-xs bg-blue-100 text-blue-800">
                          {user.username.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Vierte Zeile: Filter und Suche - alles in einer Zeile */}
          <div className="flex flex-col mt-1">
            <div className="flex items-center justify-between py-3 px-0 bg-slate-50 rounded-md">
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

                {/* Label Filter - Verbesserte Version */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1">
                      <Tag className="h-4 w-4" />
                      <span>Labels {selectedLabels.length > 0 && `(${selectedLabels.length})`}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3">
                    <div className="space-y-2">
                      {allLabels.map((label) => (
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
                      ))}
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
                  <PopoverContent className="w-48 p-3">
                    <div className="space-y-2">
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
                            className="text-sm font-medium capitalize cursor-pointer flex-1"
                          >
                            {priority}
                          </label>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Deadline Filter */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1">
                      <Clock className="h-4 w-4" />
                      <span>Deadline</span>
                      {selectedDate && <span className="ml-1 text-xs">✓</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      locale={de}
                      className="border-0"
                    />
                    {selectedDate && (
                      <div className="px-4 py-3 border-t flex justify-end">
                        <Button 
                          variant="outline" 
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

                {/* Reset-Filter Button */}
                {(selectedLabels.length > 0 || selectedPriorities.length > 0 || selectedDate || searchQuery) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedLabels([]);
                      setSelectedPriorities([]);
                      setSelectedDate(undefined);
                      setSearchQuery("");
                    }}
                    className="text-xs text-slate-600"
                  >
                    Filter zurücksetzen
                  </Button>
                )}
              </div>

              {/* RECHTE SEITE: Archiv-Toggle ohne Text */}
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

        <div className="flex-1">
          <div className="flex gap-2 mb-4">
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'outline'}
              onClick={() => setViewMode('kanban')}
              size="sm"
            >
              Kanban
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'outline'}
              onClick={() => setViewMode('table')}
              size="sm"
            >
              Tabelle
            </Button>
          </div>

          {viewMode === 'kanban' ? (
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="flex gap-6 pb-4">
                {boardColumns.map((column) => {
                  let filteredTasks = tasks
                    .filter(task => task.status === column.id)
                    // Filter out archived tasks unless showArchivedTasks is true
                    .filter(task => showArchivedTasks || !task.archived);

                  // Suche nach Texteingabe
                  if (searchQuery) {
                    const query = searchQuery.toLowerCase();
                    filteredTasks = filteredTasks.filter(task => 
                      task.title.toLowerCase().includes(query) || 
                      (task.description && task.description.toLowerCase().includes(query))
                    );
                  }

                  // Labels filtern
                  if (selectedLabels.length > 0) {
                    filteredTasks = filteredTasks.filter(task => 
                      task.labels && task.labels.some(label => selectedLabels.includes(label))
                    );
                  }

                  // Priorität filtern
                  if (selectedPriorities.length > 0) {
                    filteredTasks = filteredTasks.filter(task => 
                      task.priority && selectedPriorities.includes(task.priority)
                    );
                  }

                  // Deadline filtern
                  if (selectedDate) {
                    const targetDate = format(selectedDate, 'yyyy-MM-dd');
                    filteredTasks = filteredTasks.filter(task => {
                      if (!task.dueDate) return false;
                      const taskDate = format(new Date(task.dueDate), 'yyyy-MM-dd');
                      return taskDate === targetDate;
                    });
                  }

                  // Nach Order sortieren
                  filteredTasks = filteredTasks.sort((a, b) => a.order - b.order);

                  return (
                    <ColumnComponent
                      key={column.id}
                      column={column}
                      tasks={filteredTasks}
                      onUpdate={updateTask.mutate}
                      showArchivedTasks={showArchivedTasks}
                    />
                  );
                })}
              </div>
            </DragDropContext>
          ) : (
            <div>
              {/* Placeholder for Table View */}
              <p>Table View will be implemented here.</p>
              {/*  Implementation of the table view would go here.  This would likely involve iterating through the tasks and rendering them in a table format. */}
            </div>
          )}
        </div>

        <BoardForm
          open={showEditForm}
          onClose={() => setShowEditForm(false)}
          defaultValues={{
            ...board,
            team_ids: board.team_ids || [],
          }}
          onSubmit={async (data) => {
            await updateBoard.mutateAsync(data);
          }}
        />

        {/* Archivierungsbestätigung */}
        <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Board archivieren</AlertDialogTitle>
              <AlertDialogDescription>
                Möchten Sie dieses Board wirklich archivieren? Archivierte Boards werden in einer separaten Ansicht angezeigt und können später wiederhergestellt werden.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={() => archiveBoard.mutate()}>
                Archivieren
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Task Dialog für neue Tasks */}
        <TaskDialog 
          open={showNewTaskDialog}
          onOpenChange={setShowNewTaskDialog}
          mode="edit"
          initialColumnId={initialColumnId === null ? undefined : initialColumnId}
          task={{
            id: 0, // Wird von der API überschrieben
            title: "",
            description: "",
            richDescription: "",
            // Status basierend auf der ausgewählten Spalte, falls vorhanden
            status: initialColumnId 
              ? defaultColumns.find(col => parseInt(col.id.toString()) === initialColumnId)?.id || "backlog" 
              : "backlog",
            priority: "medium",
            labels: [],
            checklist: [],
            // Spalten-ID, Fallback auf 1 statt 0 (ungültig)
            columnId: initialColumnId || 1,
            boardId: boardId,
            assignedUserIds: [],
            assignedTeamId: null,
            dueDate: null,
            attachments: [],
            archived: false,
            order: 0
          }}
          onUpdate={async (newTask) => {
            try {
              await apiRequest("POST", `/api/boards/${boardId}/tasks`, newTask);
              queryClient.invalidateQueries({ queryKey: ["/api/boards", boardId, "tasks"] });
              toast({ title: "Task erfolgreich erstellt" });
              return Promise.resolve();
            } catch (error) {
              console.error("Error creating task:", error);
              toast({
                title: "Fehler beim Erstellen",
                description: (error as Error).message,
                variant: "destructive",
              });
              return Promise.reject(error);
            }
          }}
        />
      </div>
    </div>
  );
}

export default Board;