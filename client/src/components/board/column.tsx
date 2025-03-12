import { useState } from "react";
import { type Task } from "@shared/schema";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Droppable } from "react-beautiful-dnd";
import { useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { Task as TaskComponent } from "./task";
import { TaskDialog } from "./task-dialog";

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
    bg: 'bg-slate-100',
    border: 'border-slate-200',
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

  return (
    <Card className={`min-w-[300px] max-w-[300px] h-fit ${columnStyle.bg} border-0 shadow-none`}>
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${columnStyle.text.replace('text-', 'bg-')}`} />
            <h3 className={`font-medium ${columnStyle.text}`}>
              {displayTitle}
            </h3>
          </div>
          {!isAllTasksView && (
            <Button
              variant="ghost"
              size="icon"
              className={`h-7 w-7 hover:bg-white/50 ${columnStyle.text}`}
              onClick={() => setIsTaskDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className={`inline-flex px-2 py-0.5 rounded text-xs ${columnStyle.text} ${columnStyle.bg} border ${columnStyle.border}`}>
          {tasks.length} {tasks.length === 1 ? 'Aufgabe' : 'Aufgaben'}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <Droppable droppableId={column.title} type="TASK">
          {(provided, snapshot) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className={`flex flex-col gap-3 min-h-[50px] transition-colors rounded-lg p-2 ${
                snapshot.isDraggingOver ? 'bg-white/50' : ''
              }`}
            >
              {tasks.map((task, index) => (
                <TaskComponent 
                  key={task.id} 
                  task={task} 
                  index={index}
                  showBoardTitle={isAllTasksView}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                />
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </CardContent>

      {!isAllTasksView && selectedTask && (
        <TaskDialog
          open={isTaskDialogOpen}
          onClose={() => setIsTaskDialogOpen(false)}
          task={selectedTask}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      )}
    </Card>
  );
}