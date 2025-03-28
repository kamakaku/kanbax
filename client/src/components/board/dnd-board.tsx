import React, { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  UniqueIdentifier,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { Task } from '@shared/schema';
import { DndColumn } from './dnd-column';
import { DndTask } from './dnd-task';

interface BoardContainerProps {
  columns: { id: string | number; title?: string }[];
  tasks: Task[];
  onTaskUpdate: (task: Task) => Promise<void>;
  showArchivedTasks?: boolean;
  onTaskClick?: (task: Task) => void;
}

export function DndBoard({ 
  columns, 
  tasks, 
  onTaskUpdate, 
  showArchivedTasks = false, 
  onTaskClick 
}: BoardContainerProps) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Sensoren konfigurieren für Maus und Tastatur
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Minimale Bewegung in Pixeln bevor Drag startet
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Aufgabe beginnt gezogen zu werden
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeTaskId = active.id.toString().replace('task-', '');
    const task = tasks.find(t => t.id === parseInt(activeTaskId));
    
    setActiveId(active.id);
    
    if (task) {
      setActiveTask(task);
    }
  };

  // Aufgabe wird über einer Spalte oder Position gehalten
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    
    // Wenn kein Over-Target oder gleiche IDs, nichts tun
    if (!over || active.id === over.id) return;
    
    // Task und Over-Container IDs extrahieren
    const activeTaskId = active.id.toString();
    const overId = over.id.toString();
    
    // Überprüfen, ob wir über einer Spalte (column) sind
    const isOverColumn = overId.includes('column-');
    
    if (isOverColumn && activeTask) {
      // ID der Zielspalte extrahieren (ohne 'column-' Präfix)
      const newStatus = overId.replace('column-', '');
      
      // Task mit neuem Status vorbereiten, aber noch nicht anwenden
      // Das passiert erst bei handleDragEnd
      console.log(`Task ${activeTaskId} wird über Spalte ${newStatus} gehalten`);
    }
  };

  // Aufgabe wird losgelassen
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    // Reset des aktiven Zustands
    setActiveId(null);
    setActiveTask(null);
    
    // Wenn kein Over-Target, nichts tun
    if (!over) return;
    
    // Aktive Task ID extrahieren (ohne 'task-' Präfix)
    const activeTaskId = active.id.toString().replace('task-', '');
    const activeTaskIdNum = parseInt(activeTaskId);
    
    // Die aktive Task finden
    const task = tasks.find(t => t.id === activeTaskIdNum);
    if (!task) return;
    
    // Überprüfen, ob wir über einer Spalte (column) sind
    const isOverColumn = over.id.toString().includes('column-');
    
    if (isOverColumn) {
      // Spalten-ID extrahieren (ohne 'column-' Präfix)
      const newStatus = over.id.toString().replace('column-', '');
      
      // Wenn der Status sich nicht geändert hat, nichts tun
      if (task.status === newStatus) return;
      
      // Die Aufgabe aktualisieren
      const updatedTask = { ...task, status: newStatus };
      
      // Optimistische UI-Aktualisierung
      console.log(`Task ${activeTaskId} verschoben nach Spalte ${newStatus}`);
      
      // Backend-Aktualisierung
      await onTaskUpdate(updatedTask);
    } else {
      // Über einer anderen Task - Reihenfolgeanpassung
      // Hier würden wir die Reihenfolge anpassen
      // Dies ist ein komplexerer Fall, der separate Implementierung erfordert
      console.log("Reihenfolge innerhalb einer Spalte hat sich geändert");
    }
  };

  // Tasks nach Status gruppieren für jede Spalte
  const getTasksByStatus = (status: string | number) => {
    // Filtere nach Status und ob archivierte Aufgaben angezeigt werden sollen
    return tasks.filter((task: Task) => {
      const statusMatches = task.status === status.toString();
      const archiveCondition = showArchivedTasks ? true : !task.archived;
      return statusMatches && archiveCondition;
    });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-6 p-1 overflow-x-auto min-h-[calc(100vh-13rem)]">
        {columns.map((column) => (
          <DndColumn
            key={column.id}
            id={column.id.toString()}
            title={column.title}
            tasks={getTasksByStatus(column.id)}
            onTaskUpdate={onTaskUpdate}
            onTaskClick={onTaskClick}
          />
        ))}
      </div>
    </DndContext>
  );
}