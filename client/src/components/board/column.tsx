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

export function Column({ id, title, tasks = [], isAllTasksView = false }: ColumnProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Ensure we have a valid string ID for the droppable
  const droppableId = String(id || 'fallback');

  return (
    <Card className="min-w-[280px] max-w-[280px] h-fit">
      <CardHeader className="py-2 px-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {title}
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {tasks.length}
            </span>
          </CardTitle>
          {!isAllTasksView && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setSelectedTask(null)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="py-2 px-3 flex flex-col gap-3">
        <Droppable droppableId={droppableId}>
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="flex flex-col gap-3"
            >
              {tasks.map((task, index) => (
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