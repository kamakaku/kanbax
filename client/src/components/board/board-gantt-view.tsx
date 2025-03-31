import React, { useState } from 'react';
import { Gantt, Task as GanttTask, ViewMode } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import dayjs from 'dayjs';
import { type Task } from '@shared/schema';
import { TaskDialog } from './task-dialog';

interface BoardGanttViewProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  showArchivedTasks?: boolean;
}

// Hilfsfunktion zum Konvertieren der Task-Daten in das für Gantt erforderliche Format
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

    return {
      id: `${task.id}`,
      name: task.title,
      start: start,
      end: actualEnd,
      progress: task.checklist && task.checklist.length > 0 
        ? task.checklist.filter(item => {
            try {
              const parsedItem = typeof item === 'string' ? JSON.parse(item) : item;
              return parsedItem.checked === true;
            } catch (e) {
              return false;
            }
          }).length / task.checklist.length * 100
        : 0,
      type: 'task',
      isDisabled: false,
      styles: { 
        progressColor: getTaskColor(task),
        progressSelectedColor: getTaskColor(task, true),
        backgroundColor: getBackgroundColor(task),
        backgroundSelectedColor: getBackgroundColor(task, true),
      },
      project: task.status,
      dependencies: [],
      hideChildren: false
    } as GanttTask;
  });
};

// Hilfsfunktionen für die Styling der Gantt-Balken basierend auf Priorität
const getTaskColor = (task: Task, isSelected: boolean = false): string => {
  if (task.archived) {
    return isSelected ? '#666666' : '#999999';
  }
  
  switch (task.priority) {
    case 'niedrig':
      return isSelected ? '#4caf50' : '#81c784';
    case 'mittel':
      return isSelected ? '#ff9800' : '#ffb74d';
    case 'hoch':
      return isSelected ? '#f44336' : '#e57373';
    default:
      return isSelected ? '#03a9f4' : '#4fc3f7';
  }
};

const getBackgroundColor = (task: Task, isSelected: boolean = false): string => {
  if (task.archived) {
    return isSelected ? '#e0e0e0' : '#f5f5f5';
  }
  
  const baseColor = getTaskColor(task, false);
  // Hellere Version der Farbe für den Hintergrund
  return isSelected 
    ? baseColor + '33' // 20% Opazität für den ausgewählten Zustand
    : baseColor + '1A'; // 10% Opazität für den normalen Zustand
};

export function BoardGanttView({ tasks, onTaskClick, showArchivedTasks = false }: BoardGanttViewProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Day);

  // Filtern und Sortieren der Tasks für die Gantt-Ansicht
  const filteredTasks = tasks
    .filter(task => showArchivedTasks || !task.archived)
    .sort((a, b) => {
      // Nach Status gruppieren
      if (a.status !== b.status) {
        return a.status.localeCompare(b.status);
      }
      
      // Dann nach Reihenfolge innerhalb des Status
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

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="mb-4 flex gap-2">
        <button 
          onClick={() => handleViewModeChange(ViewMode.Day)} 
          className={`px-2 py-1 rounded-md text-xs ${viewMode === ViewMode.Day ? 'bg-primary text-white' : 'bg-gray-100'}`}
        >
          Tag
        </button>
        <button 
          onClick={() => handleViewModeChange(ViewMode.Week)} 
          className={`px-2 py-1 rounded-md text-xs ${viewMode === ViewMode.Week ? 'bg-primary text-white' : 'bg-gray-100'}`}
        >
          Woche
        </button>
        <button 
          onClick={() => handleViewModeChange(ViewMode.Month)} 
          className={`px-2 py-1 rounded-md text-xs ${viewMode === ViewMode.Month ? 'bg-primary text-white' : 'bg-gray-100'}`}
        >
          Monat
        </button>
      </div>

      <div className="gantt-container" style={{ height: 'calc(100vh - 280px)', overflow: 'auto' }}>
        {ganttTasks.length > 0 ? (
          <Gantt
            tasks={ganttTasks}
            viewMode={viewMode}
            onDateChange={(task) => console.log("Date changed", task)}
            onProgressChange={(task) => console.log("Progress changed", task)}
            onDoubleClick={handleTaskClick}
            onClick={handleTaskClick}
            columnWidth={viewMode === ViewMode.Day ? 60 : viewMode === ViewMode.Week ? 250 : 300}
            listCellWidth={'180px'}
            locale="de"
            todayColor="#3498db1a"
          />
        ) : (
          <div className="flex justify-center items-center h-40 text-muted-foreground">
            Keine Tasks gefunden, die den Filterkriterien entsprechen.
          </div>
        )}
      </div>

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