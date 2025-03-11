import { useState } from "react";
import { type Task as TaskType } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Draggable } from "react-beautiful-dnd";
import { TaskDialog } from "./task-dialog";

interface TaskProps {
  task: TaskType & { boardTitle?: string };
  index: number;
  showBoardTitle?: boolean;
}

export function Task({ task, index, showBoardTitle = false }: TaskProps) {
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);

  const priorityColor = {
    low: "border-blue-500",
    medium: "border-yellow-500", 
    high: "border-red-500"
  }[task.priority || "medium"] || "border-blue-500";

  return (
    <>
      <Draggable draggableId={task.id.toString()} index={index}>
        {(provided) => (
          <div
            className="cursor-pointer"
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            ref={provided.innerRef}
            onClick={() => setIsTaskDialogOpen(true)}
          >
            <Card className={`shadow-sm hover:shadow border-l-4 ${priorityColor} hover:border-primary/20 mb-2`}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-sm font-medium line-clamp-2">
                    {task.title}
                  </CardTitle>
                </div>
                {task.description && (
                  <CardDescription className="text-xs line-clamp-2">
                    {task.description}
                  </CardDescription>
                )}
                <div className="flex flex-wrap gap-1 mt-2">
                  {task.labels && task.labels.length > 0 && 
                    task.labels.map((label, i) => (
                      <span
                        key={i}
                        className="px-1.5 py-0.5 text-[10px] rounded-sm bg-primary/10 text-primary font-medium"
                      >
                        {label}
                      </span>
                    ))
                  }
                  {showBoardTitle && task.boardTitle && (
                    <span
                      className="px-1.5 py-0.5 text-[10px] rounded-sm bg-secondary/30 text-secondary-foreground font-medium"
                    >
                      {task.boardTitle}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </Draggable>

      <TaskDialog
        open={isTaskDialogOpen}
        onClose={() => setIsTaskDialogOpen(false)}
        existingTask={task}
      />
    </>
  );
}