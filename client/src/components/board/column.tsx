import { useState } from "react";
import { type Task } from "@shared/schema";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Droppable } from "react-beautiful-dnd";
import { useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { Task as TaskComponent } from "./task";
import { TaskDialog } from "./task-dialog";

interface ColumnProps {
  id: string | number;
  title: string;
  tasks: Task[];
  isAllTasksView?: boolean;
}

const statusLabels: Record<string, string> = {
  'backlog': 'Backlog',
  'todo': 'To Do',
  'in-progress': 'In Progress',
  'review': 'Review',
  'done': 'Done'
};

export function Column({ id, title = 'Untitled', tasks = [], isAllTasksView = false }: ColumnProps) {
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const { currentBoard } = useStore();
  const queryClient = useQueryClient();

  // Format status text for display - safely handle undefined or null titles
  let displayTitle = 'Untitled';
  
  if (title) {
    const titleKey = String(title).toLowerCase();
    displayTitle = statusLabels[titleKey] || String(title);
  }

  return (
    <Card className="min-w-[280px] max-w-[280px] h-fit">
      <CardHeader className="py-2 px-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {displayTitle}
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {tasks.length}
            </span>
          </CardTitle>
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
        </div>
      </CardHeader>
      <CardContent className="py-2 px-3 flex flex-col gap-3">
        <Droppable 
          droppableId={id !== undefined && id !== null ? String(id) : `column-${Math.random().toString(36).substring(2, 9)}`} 
          type="TASK"
          isDropDisabled={isAllTasksView} 
        >
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="flex flex-col gap-3 min-h-[50px]"
            >
              {tasks.map((task, index) => (
                <TaskComponent 
                  key={task.id} 
                  task={task} 
                  index={index}
                  showBoardTitle={isAllTasksView}
                />
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </CardContent>

      {!isAllTasksView && isTaskDialogOpen && selectedTask && (
        <TaskDialog
          open={isTaskDialogOpen}
          onClose={() => setIsTaskDialogOpen(false)}
          task={selectedTask}
        />
      )}
    </Card>
  );
}