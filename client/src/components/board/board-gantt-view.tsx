import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Gantt, Task as GanttTask, ViewMode } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import dayjs from 'dayjs';
import { type Task } from '@shared/schema';
import { TaskDialog } from './task-dialog';
import { Button } from '@/components/ui/button';
import { 
  ZoomIn, ZoomOut, Calendar, ArrowLeft, ArrowRight,
  ChevronLeft, ChevronRight, Maximize, Minimize, RotateCcw,
  CalendarDays, CalendarRange, CalendarDays as CalendarIcon
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';

interface BoardGanttViewProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  showArchivedTasks?: boolean;
}

// Erweiterte Hilfsfunktion zum Konvertieren der Task-Daten in das für Gantt erforderliche Format
const convertToGanttTasks = (tasks: Task[]): GanttTask[] => {
  return tasks.map(task => {
    // Startdatum bestimmen - entweder task.startDate oder wenn nicht vorhanden, task.dueDate oder aktuelles Datum
    const start = task.startDate 
      ? new Date(task.startDate) 
      : task.dueDate 
        ? new Date(task.dueDate) 
        : new Date();
    
    // Enddatum bestimmen - entweder task.dueDate oder wenn nicht vorhanden, das Startdatum + 1 Tag
    const end = task.dueDate 
      ? new Date(task.dueDate) 
      : dayjs(start).add(1, 'day').toDate();

    // Sicherstellen, dass das Enddatum nicht vor dem Startdatum liegt
    const actualEnd = end < start ? dayjs(start).add(1, 'day').toDate() : end;

    // Fortschritt berechnen basierend auf Checkliste oder standardmäßig 0%
    let progress = 0;
    if (task.checklist && task.checklist.length > 0) {
      try {
        const completedItems = task.checklist.filter(item => {
          try {
            const parsedItem = typeof item === 'string' ? JSON.parse(item) : item;
            return parsedItem.checked === true;
          } catch (e) {
            return false;
          }
        }).length;
        progress = (completedItems / task.checklist.length) * 100;
      } catch (e) {
        progress = 0;
      }
    }

    // Status als Projekt für gruppierte Darstellung
    const statusLabel = getStatusLabel(task.status);

    // Keine Icons im Titel, nur den reinen Titel verwenden
    const titleWithPriority = task.title;

    return {
      id: `${task.id}`,
      name: titleWithPriority,
      start: start,
      end: actualEnd,
      progress: progress,
      type: 'task',
      isDisabled: false,
      styles: { 
        // Verbesserte Farben und Verläufe für Balken
        progressColor: getTaskColor(task),
        progressSelectedColor: getTaskColor(task, true),
        backgroundColor: getGradientBackground(task),
        backgroundSelectedColor: getGradientBackground(task, true),
        
        // Verbesserte Textstile für besseren Kontrast
        textColor: '#ffffff',  // Weiße Schrift für besseren Kontrast auf farbigem Hintergrund
        fontFamily: 'Urbanist, sans-serif',
        fontSize: '12px',
        fontWeight: 'bold',
        opacity: task.archived ? 0.6 : 1,
      },
      project: statusLabel,
      dependencies: [],
      hideChildren: false
    } as GanttTask;
  });
};

// Status in benutzerfreundliche Labels umwandeln
const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'backlog':
      return 'Backlog';
    case 'todo':
      return 'To Do';
    case 'in-progress':
      return 'In Progress';
    case 'review':
      return 'Review';
    case 'done':
      return 'Fertig';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
};

// Verbesserte Styling-Funktionen für Gantt-Balken basierend auf Priorität
const getTaskColor = (task: Task, isSelected: boolean = false): string => {
  if (task.archived) {
    return isSelected ? '#666666' : '#999999';
  }
  
  switch (task.priority) {
    case 'niedrig':
    case 'low':
      return isSelected ? '#2e7d32' : '#4caf50';
    case 'mittel':
    case 'medium':
      return isSelected ? '#e65100' : '#ff9800';
    case 'hoch':
    case 'high':
      return isSelected ? '#c62828' : '#f44336';
    default:
      return isSelected ? '#0277bd' : '#03a9f4';
  }
};

// Funktion liefert CSS-Verlaufscode für Gantt-Balken
const getGradientBackground = (task: Task, isSelected: boolean = false): string => {
  const baseColor = getTaskColor(task, isSelected);
  const lighterColor = baseColor + (isSelected ? '90' : '60');  // Hellere Variante für den Verlauf
  
  // Erzeugt einen schönen Farbverlauf mit besserer Lesbarkeit für Text
  return `linear-gradient(to right, ${baseColor}, ${lighterColor})`;
};

// Hintergrundfarbe für Gantt-Balken
const getBackgroundColor = (task: Task, isSelected: boolean = false): string => {
  if (task.archived) {
    return isSelected ? '#e0e0e0' : '#f5f5f5';
  }
  
  const baseColor = getTaskColor(task, false);
  // Verbesserte Farbverläufe für die Hintergründe
  return isSelected 
    ? baseColor + '40' // 25% Opazität für den ausgewählten Zustand
    : baseColor + '20'; // 12.5% Opazität für den normalen Zustand
};

export function BoardGanttView({ tasks, onTaskClick, showArchivedTasks = false }: BoardGanttViewProps) {
  const { toast } = useToast();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Week);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [columnWidth, setColumnWidth] = useState<number>(65);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const ganttContainerRef = useRef<HTMLDivElement>(null);
  const [expandedView, setExpandedView] = useState(false);

  // Berechnung der Spaltenbreite basierend auf Zoom-Level und View-Mode
  useEffect(() => {
    const baseWidth = viewMode === ViewMode.Day ? 60 : viewMode === ViewMode.Week ? 180 : 250;
    setColumnWidth(Math.round(baseWidth * (zoomLevel / 100)));
  }, [zoomLevel, viewMode]);

  // Filtern und Sortieren der Tasks für die Gantt-Ansicht
  const filteredTasks = tasks
    .filter(task => showArchivedTasks || !task.archived)
    .sort((a, b) => {
      // Nach Status gruppieren
      if (a.status !== b.status) {
        // Benutzerdefinierte Reihenfolge für Status
        const statusOrder = { 'backlog': 0, 'todo': 1, 'in-progress': 2, 'review': 3, 'done': 4 };
        return (statusOrder[a.status as keyof typeof statusOrder] || 99) - 
               (statusOrder[b.status as keyof typeof statusOrder] || 99);
      }
      
      // Bei gleichem Status nach Priorität sortieren
      const priorityOrder = { 'hoch': 0, 'mittel': 1, 'niedrig': 2 };
      if (a.priority !== b.priority) {
        return (priorityOrder[a.priority as keyof typeof priorityOrder] || 99) - 
               (priorityOrder[b.priority as keyof typeof priorityOrder] || 99);
      }
      
      // Zuletzt nach Reihenfolge innerhalb des Status
      return a.order - b.order;
    });

  const ganttTasks = convertToGanttTasks(filteredTasks);

  const handleTaskClick = (task: GanttTask) => {
    const originalTask = tasks.find(t => t.id === parseInt(task.id));
    if (!originalTask) return;
    
    if (onTaskClick) {
      onTaskClick(originalTask);
    } else {
      setSelectedTask(originalTask);
      setIsDialogOpen(true);
    }
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
  };

  const handleZoomIn = () => {
    if (zoomLevel < 200) {
      setZoomLevel(prev => Math.min(prev + 20, 200));
    }
  };

  const handleZoomOut = () => {
    if (zoomLevel > 50) {
      setZoomLevel(prev => Math.max(prev - 20, 50));
    }
  };

  const handleResetZoom = () => {
    setZoomLevel(100);
  };

  const handleNavigateTime = (direction: 'prev' | 'next') => {
    const amount = direction === 'prev' ? -1 : 1;
    let newDate = new Date(currentDate);
    
    switch (viewMode) {
      case ViewMode.Day:
        newDate.setDate(newDate.getDate() + amount);
        break;
      case ViewMode.Week:
        newDate.setDate(newDate.getDate() + amount * 7);
        break;
      case ViewMode.Month:
        newDate.setMonth(newDate.getMonth() + amount);
        break;
      default:
        newDate.setDate(newDate.getDate() + amount);
    }
    
    setCurrentDate(newDate);
  };

  const toggleExpandView = () => {
    setExpandedView(!expandedView);
  };
  
  // Handler für Änderungen am Datum eines Tasks
  const handleTaskDateChange = async (ganttTask: GanttTask) => {
    try {
      // Original-Task finden
      const taskId = parseInt(ganttTask.id);
      const originalTask = tasks.find(t => t.id === taskId);
      if (!originalTask) return;
      
      // Formatieren des Start- und Enddatums
      const startDate = dayjs(ganttTask.start).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
      const dueDate = dayjs(ganttTask.end).format('YYYY-MM-DD 21:59:59.999');
      
      // Aktualisieren des Tasks über die API
      await apiRequest('PATCH', `/api/tasks/${taskId}`, {
        startDate,
        dueDate,
      });
      
      // Cache invalidieren, um die Änderungen zu reflektieren
      queryClient.invalidateQueries({ queryKey: ['/api/boards', originalTask.boardId, 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', taskId] });
      
      toast({
        title: 'Zeitraum aktualisiert',
        description: `Der Zeitraum für "${originalTask.title}" wurde aktualisiert.`,
      });
    } catch (error) {
      console.error('Fehler beim Aktualisieren des Datums:', error);
      toast({
        title: 'Fehler beim Aktualisieren',
        description: 'Das Datum konnte nicht aktualisiert werden. Bitte versuche es erneut.',
        variant: 'destructive',
      });
    }
  };
  
  // Handler für Änderungen am Fortschritt eines Tasks
  const handleTaskProgressChange = async (ganttTask: GanttTask) => {
    try {
      // Original-Task finden
      const taskId = parseInt(ganttTask.id);
      const originalTask = tasks.find(t => t.id === taskId);
      if (!originalTask || !originalTask.checklist || originalTask.checklist.length === 0) return;
      
      // Aktuellen Fortschritt berechnen
      const progress = Math.round(ganttTask.progress);
      const totalItems = originalTask.checklist.length;
      const itemsToCheck = Math.ceil((progress / 100) * totalItems);
      
      // Checkliste aktualisieren
      const updatedChecklist = originalTask.checklist.map((item, index) => {
        try {
          const parsedItem = typeof item === 'string' ? JSON.parse(item) : item;
          return JSON.stringify({
            ...parsedItem,
            checked: index < itemsToCheck, // Die ersten X Items als erledigt markieren
          });
        } catch (e) {
          return item; // Bei Parsing-Fehler das Original behalten
        }
      });
      
      // Aktualisieren des Tasks über die API
      await apiRequest('PATCH', `/api/tasks/${taskId}`, {
        checklist: updatedChecklist,
      });
      
      // Cache invalidieren, um die Änderungen zu reflektieren
      queryClient.invalidateQueries({ queryKey: ['/api/boards', originalTask.boardId, 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', taskId] });
      
      toast({
        title: 'Fortschritt aktualisiert',
        description: `Der Fortschritt für "${originalTask.title}" wurde auf ${progress}% gesetzt.`,
      });
    } catch (error) {
      console.error('Fehler beim Aktualisieren des Fortschritts:', error);
      toast({
        title: 'Fehler beim Aktualisieren',
        description: 'Der Fortschritt konnte nicht aktualisiert werden. Bitte versuche es erneut.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className={cn(
      "border rounded-lg bg-white transition-all duration-300 ease-in-out",
      expandedView ? "fixed inset-4 z-50 shadow-2xl p-6" : "p-4"
    )}>
      {/* Kopfzeile mit Steuerungselementen */}
      <div className="mb-4 flex flex-wrap gap-2 justify-between items-center">
        <div className="flex gap-2 items-center">
          {/* Ansichtsumschalter mit verbesserten Icons */}
          <div className="flex items-center border rounded-md bg-slate-50">
            <Button
              variant={viewMode === ViewMode.Day ? 'default' : 'ghost'}
              onClick={() => handleViewModeChange(ViewMode.Day)}
              size="sm"
              className="rounded-none rounded-l-md"
            >
              <CalendarDays className="h-4 w-4 mr-1" />
              <span className="text-xs">Tag</span>
            </Button>
            <Button
              variant={viewMode === ViewMode.Week ? 'default' : 'ghost'}
              onClick={() => handleViewModeChange(ViewMode.Week)}
              size="sm"
              className="rounded-none"
            >
              <CalendarRange className="h-4 w-4 mr-1" />
              <span className="text-xs">Woche</span>
            </Button>
            <Button
              variant={viewMode === ViewMode.Month ? 'default' : 'ghost'}
              onClick={() => handleViewModeChange(ViewMode.Month)}
              size="sm"
              className="rounded-none rounded-r-md"
            >
              <CalendarIcon className="h-4 w-4 mr-1" />
              <span className="text-xs">Monat</span>
            </Button>
          </div>

          {/* Zeit-Navigation */}
          <div className="flex items-center border rounded-md bg-slate-50">
            <Button
              variant="ghost"
              onClick={() => handleNavigateTime('prev')}
              size="sm"
              className="rounded-none rounded-l-md"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setCurrentDate(new Date());
                toast({ title: "Zum aktuellen Datum zurückgekehrt" });
              }}
              size="sm"
              className="rounded-none"
            >
              <Calendar className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              onClick={() => handleNavigateTime('next')}
              size="sm"
              className="rounded-none rounded-r-md"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Zoom-Steuerung und Vollbild */}
        <div className="flex gap-2 items-center">
          <Badge variant="outline" className="bg-slate-50">
            Zoom: {zoomLevel}%
          </Badge>
          
          <div className="flex items-center border rounded-md bg-slate-50">
            <Button
              variant="ghost"
              onClick={handleZoomOut}
              size="sm"
              className="rounded-none rounded-l-md"
              disabled={zoomLevel <= 50}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              onClick={handleResetZoom}
              size="sm"
              className="rounded-none px-2"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              onClick={handleZoomIn}
              size="sm"
              className="rounded-none rounded-r-md"
              disabled={zoomLevel >= 200}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
          
          <Button
            variant="outline"
            onClick={toggleExpandView}
            size="sm"
            className="bg-slate-50"
          >
            {expandedView ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="mb-2 flex flex-wrap gap-2 text-xs">
        <div className="flex items-center">
          <span className="inline-block w-3 h-3 rounded-sm mr-1" style={{ backgroundColor: '#f44336' }}></span>
          <span>Hoch</span>
        </div>
        <div className="flex items-center">
          <span className="inline-block w-3 h-3 rounded-sm mr-1" style={{ backgroundColor: '#ff9800' }}></span>
          <span>Mittel</span>
        </div>
        <div className="flex items-center">
          <span className="inline-block w-3 h-3 rounded-sm mr-1" style={{ backgroundColor: '#4caf50' }}></span>
          <span>Niedrig</span>
        </div>
        {showArchivedTasks && (
          <div className="flex items-center">
            <span className="inline-block w-3 h-3 rounded-sm mr-1" style={{ backgroundColor: '#999999' }}></span>
            <span>Archiviert</span>
          </div>
        )}
      </div>

      {/* Gantt-Diagramm mit optimierter Container-Höhe für Vollbild-Unterstützung */}
      <div 
        ref={ganttContainerRef}
        className={cn(
          "gantt-container relative border rounded bg-slate-50 overflow-auto transition-all duration-300 ease-in-out",
          expandedView ? "h-[calc(100vh-200px)]" : "h-[calc(100vh-320px)]"
        )}
      >
        {ganttTasks.length > 0 ? (
          <Gantt
            tasks={ganttTasks}
            viewMode={viewMode}
            onDateChange={handleTaskDateChange}
            onProgressChange={handleTaskProgressChange}
            onDoubleClick={handleTaskClick}
            onClick={handleTaskClick}
            columnWidth={columnWidth}
            ListHeaderComponent={() => null}
            TaskListHeader={() => null}
            TaskListTable={() => null}
            rowHeight={40}
            headerHeight={50}
            barCornerRadius={4}
            barFill={80}
            locale="de"
            todayColor="rgba(66, 133, 244, 0.15)"
            projectBackgroundColor="rgba(66, 133, 244, 0.08)"
            TooltipContent={({ task }) => {
              // Original-Task finden, um die Prioritätsfarbe zu bekommen
              const originalTask = tasks.find(t => t.id.toString() === task.id);
              const priorityColor = originalTask ? getTaskColor(originalTask) : '#999';
              
              return (
                <div className="p-3 bg-white shadow-lg rounded-md border min-w-[220px]">
                  {/* Titel ohne Prioritätsindikator */}
                  <div className="font-medium text-sm mb-1">{task.name}</div>
                  
                  {/* Priorität anzeigen */}
                  {originalTask && (
                    <div className="text-xs mt-1 text-gray-500 flex items-center">
                      <span>Priorität: </span>
                      <span 
                        className="ml-1 px-1.5 py-0.5 rounded text-white text-xs font-semibold"
                        style={{ backgroundColor: priorityColor }}
                      >
                        {originalTask.priority === 'high' || originalTask.priority === 'hoch' ? 'Hoch' : 
                         originalTask.priority === 'medium' || originalTask.priority === 'mittel' ? 'Mittel' : 'Niedrig'}
                      </span>
                    </div>
                  )}
                  
                  {/* Datum */}
                  <div className="text-xs mt-2 text-gray-600">
                    {dayjs(task.start).format('DD.MM.YYYY')} - {dayjs(task.end).format('DD.MM.YYYY')}
                  </div>
                  
                  {/* Fortschrittsbalken */}
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Fortschritt</span>
                      <span>{Math.round(task.progress)}%</span>
                    </div>
                    <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full" 
                        style={{ width: `${task.progress}%`, background: getGradientBackground(originalTask || {} as Task) }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            }}
          />
        ) : (
          <div className="flex justify-center items-center h-40 text-muted-foreground">
            Keine Tasks gefunden, die den Filterkriterien entsprechen.
          </div>
        )}
      </div>

      {/* Task-Dialog bei Klick auf eine Aufgabe */}
      {!onTaskClick && (
        <TaskDialog
          task={selectedTask || undefined}
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          mode="details"
        />
      )}
    </div>
  );
}