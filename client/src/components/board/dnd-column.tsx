import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Task } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { TaskDialog } from './task-dialog';
import { DndTask } from './dnd-task';

interface ColumnProps {
  id: string;
  title?: string;
  tasks: Task[];
  onTaskUpdate: (task: Task) => Promise<void>;
  onTaskClick?: (task: Task) => void;
}

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  backlog: { 
    bg: "from-slate-50 to-white",
    text: "text-slate-700",
    border: "border-slate-200"
  },
  todo: { 
    bg: "from-blue-50 to-white",
    text: "text-blue-700",
    border: "border-blue-200"
  },
  "in-progress": { 
    bg: "from-amber-50 to-white",
    text: "text-amber-700",
    border: "border-amber-200"
  },
  review: { 
    bg: "from-purple-50 to-white",
    text: "text-purple-700",
    border: "border-purple-200"
  },
  done: { 
    bg: "from-green-50 to-white",
    text: "text-green-700",
    border: "border-green-200"
  }
};

const getColumnStyle = (columnId: string) => {
  const id = columnId.toString().toLowerCase();
  return statusColors[id] || statusColors.backlog;
};

export function DndColumn({ id, title, tasks, onTaskUpdate, onTaskClick }: ColumnProps) {
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const { setNodeRef, isOver } = useDroppable({
    id: `column-${id}`,
  });

  const columnStyle = getColumnStyle(id);
  const displayTitle = title || "Untitled";

  // Task IDs für die SortableContext-Komponente
  const taskIds = tasks.map(task => `task-${task.id}`);

  return (
    <div className={`
      min-w-[280px] max-w-[280px] 
      backdrop-blur-sm 
      rounded-xl 
      border ${columnStyle.border}
      bg-gradient-to-b ${columnStyle.bg}
      shadow-lg
      relative
      overflow-hidden
    `}>
      <div className="relative p-3 pb-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${columnStyle.text.replace("text-", "bg-")}`} />
            <h3 className={`font-medium text-sm ${columnStyle.text}`}>{displayTitle}</h3>
            <div className={`
              px-1.5 rounded text-xs ${columnStyle.text} 
              bg-white backdrop-blur-sm 
              border ${columnStyle.border}
            `}>
              {tasks.length}
            </div>
          </div>
          <Button
            size="sm"
            className="h-6 px-2 py-1 bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white shadow-sm transition-all duration-300 hover:shadow-md"
            onClick={() => {
              setSelectedTask(null);
              setIsTaskDialogOpen(true);
            }}
          >
            <Plus className="h-3 w-3 mr-1" />
            <span className="text-xs">Neu</span>
          </Button>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={`
          relative p-3 
          min-h-[150px]
          h-[calc(100vh-13rem)]
          overflow-auto
          flex flex-col gap-3 
          transition-colors
          ${isOver ? "bg-slate-100/50 border-2 border-dashed border-slate-300" : ""}
        `}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task: Task) => (
            <DndTask
              key={task.id}
              task={task}
              onClick={(task: Task) => {
                if (onTaskClick) {
                  onTaskClick(task);
                } else {
                  setSelectedTask(task);
                  setIsTaskDialogOpen(true);
                }
              }}
            />
          ))}
        </SortableContext>
      </div>

      <TaskDialog
        open={isTaskDialogOpen}
        onOpenChange={setIsTaskDialogOpen}
        task={selectedTask || undefined}
        onUpdate={onTaskUpdate}
        initialColumnId={id !== "string" ? parseInt(id) : undefined}
      />
    </div>
  );
}