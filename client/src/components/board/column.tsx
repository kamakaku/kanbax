import React, { useState } from "react";
import { Droppable } from "react-beautiful-dnd";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Task } from "@shared/schema";
import { useStore } from "@/lib/store";
import { Task as TaskComponent } from "./task"; // Changed import here
import { TaskDialog } from "./task-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

interface ColumnProps {
  column: {
    id: string | number;
    title?: string;
  };
  tasks: Task[];
  isAllTasksView?: boolean;
  onUpdate?: (task: Task) => Promise<void>;
  onDelete?: (taskId: number) => Promise<void>;
}

const statusColors: Record<string, { bg: string, border: string, text: string }> = {
  'backlog': { 
    bg: 'bg-slate-50',
    border: 'border-slate-100',
    text: 'text-slate-600'
  },
  'todo': { 
    bg: 'bg-blue-50',
    border: 'border-blue-100',
    text: 'text-blue-600'
  },
  'in-progress': { 
    bg: 'bg-amber-50',
    border: 'border-amber-100',
    text: 'text-amber-600'
  },
  'review': { 
    bg: 'bg-purple-50',
    border: 'border-purple-100',
    text: 'text-purple-600'
  },
  'done': { 
    bg: 'bg-green-50',
    border: 'border-green-100',
    text: 'text-green-600'
  }
};

const statusLabels: Record<string, string> = {
  'backlog': 'Backlog',
  'todo': 'To Do',
  'in-progress': 'In Progress',
  'review': 'Review',
  'done': 'Done'
};

export function Column({ column, tasks = [], isAllTasksView = false, onUpdate, onDelete }: ColumnProps) {
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const { currentBoard } = useStore();
  const queryClient = useQueryClient();

  const columnId = typeof column.id === 'string' ? column.id.toLowerCase() : 'backlog';
  const columnStyle = statusColors[columnId] || statusColors.backlog;
  const displayTitle = typeof column.title === 'string' ? 
    (statusLabels[column.title.toLowerCase()] || column.title) : 
    'Untitled';

  const handleTaskUpdate = async (task: Task) => {
    if (onUpdate) {
      await onUpdate(task);
    }
    queryClient.invalidateQueries({ queryKey: ["/api/boards", currentBoard?.id, "tasks"] });
  };

  return (
    <Card className={`min-w-[260px] max-w-[260px] h-fit ${columnStyle.bg} border-0 shadow-none`}>
      <CardHeader className="p-3 pb-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${columnStyle.text.replace('text-', 'bg-')}`} />
            <h3 className={`font-medium text-sm ${columnStyle.text}`}>
              {displayTitle}
            </h3>
            <div className={`px-1.5 rounded text-xs ${columnStyle.text} ${columnStyle.bg} border ${columnStyle.border}`}>
              {tasks.length}
            </div>
          </div>
          {!isAllTasksView && (
            <Button
              variant="ghost"
              size="icon"
              className={`h-6 w-6 hover:bg-white/50 ${columnStyle.text}`}
              onClick={() => {
                setSelectedTask({
                  id: 0,
                  title: "",
                  description: "",
                  status: column.title?.toLowerCase() || "todo",
                  boardId: currentBoard?.id || 0,
                  columnId: 0,
                  order: 0,
                  priority: "medium",
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                });
                setIsTaskDialogOpen(true);
              }}
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-2">
        <Droppable droppableId={column.title || ""} type="TASK">
          {(provided, snapshot) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className={`flex flex-col gap-2 min-h-[50px] transition-colors rounded-lg p-1 ${
                snapshot.isDraggingOver ? 'bg-white/50' : ''
              }`}
            >
              {tasks.map((task, index) => (
                <TaskComponent
                  key={task.id} 
                  task={task} 
                  index={index}
                  showBoardTitle={isAllTasksView}
                  onUpdate={handleTaskUpdate}
                  onDelete={onDelete}
                  onClick={(clickedTask) => {
                    setSelectedTask(clickedTask);
                    setIsTaskDialogOpen(true);
                  }}
                />
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </CardContent>
      <TaskDialog
        task={selectedTask}
        open={isTaskDialogOpen}
        onClose={() => {
          setIsTaskDialogOpen(false);
          setSelectedTask(null);
        }}
        onUpdate={handleTaskUpdate}
        onDelete={onDelete}
      />
    </Card>
  );
}