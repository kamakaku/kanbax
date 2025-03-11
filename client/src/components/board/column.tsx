import { useState } from "react";
import { type Task } from "@shared/schema";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Droppable } from "react-beautiful-dnd";
import { TaskCard } from "./task-card";
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

  // Ensure id is always a string
  const columnId = id ? String(id) : 'column-' + Math.random().toString(36).substr(2, 9);

  // Formatiere den Status-Text für die Anzeige - with null checks
  const displayTitle = title && typeof title === 'string' ? 
    (statusLabels[title.toLowerCase()] || title) : 
    'Untitled';

  return (
    <Card className="min-w-[280px] max-w-[280px] h-fit">
      <CardHeader className="py-2 px-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {displayTitle}
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {tasks?.length || 0}
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
        <Droppable droppableId={columnId} type="task">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="flex flex-col gap-3"
            >
              {tasks && tasks.map((task, index) => (
                <TaskCard 
                  key={task.id} 
                  task={task} 
                  index={index} 
                  showBoardTitle={isAllTasksView}
                  onClick={() => setSelectedTask(task)}
                />
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </CardContent>

      {selectedTask && (
        <TaskDialog
          open={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          task={selectedTask}
          onUpdate={async () => {
            setSelectedTask(null);
          }}
        />
      )}
    </Card>
  );
}