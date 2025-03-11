import { useState } from "react";
import { type Task } from "@shared/schema";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Droppable } from "react-beautiful-dnd";
import { useStore } from "@/lib/store";
import { TaskDialog } from "./task-dialog";
import { cn } from "@/lib/utils";

interface Column {
  id: number;
  title: string;
  tasks: Task[];
}

interface ColumnProps {
  column: Column;
  isAllTasksView?: boolean;
}

const statusColumns = {
  'backlog': 'Backlog',
  'todo': 'To Do',
  'in-progress': 'In Progress',
  'review': 'Review',
  'done': 'Done'
};

const getPriorityStyle = (priority?: string) => {
  switch (priority) {
    case 'high':
      return 'border-t-red-500';
    case 'medium':
      return 'border-t-yellow-500';
    case 'low':
      return 'border-t-green-500';
    default:
      return 'border-t-transparent';
  }
};

export function Column({ column, isAllTasksView = false }: ColumnProps) {
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const { currentBoard } = useStore();

  // Format status text for display
  let displayTitle = 'Untitled';
  if (column && column.title) {
    const titleKey = String(column.title).toLowerCase();
    displayTitle = statusColumns[titleKey] || String(column.title);
  }

  return (
    <div className="bg-muted/50 rounded-lg p-4 min-w-[280px] max-w-[280px]">
      <h3 className="font-semibold mb-4 flex items-center justify-between">
        {displayTitle}
        {!isAllTasksView && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsTaskDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </h3>

      <Droppable 
        droppableId={String(column.id)} 
        type="TASK"
        isDropDisabled={isAllTasksView}
      >
        {(provided) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            className="space-y-4"
          >
            {column.tasks.map((task) => (
              <Card
                key={task.id}
                className={cn(
                  "group hover:shadow-lg transition-all duration-300 cursor-pointer border-t-2",
                  getPriorityStyle(task.priority)
                )}
                onClick={() => setSelectedTask(task)}
              >
                <CardHeader className="p-4 space-y-2">
                  <CardTitle className="text-base line-clamp-1 group-hover:text-primary transition-colors">
                    {task.title}
                  </CardTitle>
                  {task.description && (
                    <CardDescription className="text-sm line-clamp-2">
                      {task.description}
                    </CardDescription>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {currentBoard?.title}
                  </div>
                  {task.labels && task.labels.length > 0 && (
                    <div className="flex gap-2">
                      {task.labels.map((label, index) => (
                        <span
                          key={index}
                          className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  )}
                </CardHeader>
              </Card>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {!isAllTasksView && isTaskDialogOpen && (
        <TaskDialog
          open={isTaskDialogOpen}
          onClose={() => setIsTaskDialogOpen(false)}
          task={selectedTask}
        />
      )}
    </div>
  );
}