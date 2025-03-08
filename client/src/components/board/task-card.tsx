import { useState } from "react";
import { type Task } from "@shared/schema";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";
import { Draggable } from "react-beautiful-dnd";
import { TaskDialog } from "./task-dialog";
import { format } from "date-fns";

interface TaskCardProps {
  task: Task;
  index: number;
}

const priorityColors = {
  high: "bg-red-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};

export function TaskCard({ task, index }: TaskCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <Draggable draggableId={task.id.toString()} index={index}>
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            onClick={() => setIsDialogOpen(true)}
          >
            <Card className="mb-3 cursor-pointer hover:bg-muted/50 transition-colors shadow-sm hover:shadow-md relative overflow-hidden">
              <div 
                className={`absolute top-0 left-0 w-full h-1 ${priorityColors[task.priority as keyof typeof priorityColors]}`} 
              />
              <CardHeader className="p-3 pb-2">
                <h3 className="text-sm font-medium line-clamp-2">{task.title}</h3>
                {task.labels && task.labels.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {task.labels.map((label) => (
                      <Badge key={label} variant="secondary" className="px-2 py-0.5 text-xs">
                        {label}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-2">
                {task.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {task.description}
                  </p>
                )}
                {task.dueDate && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(task.dueDate), 'MMM d')}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </Draggable>

      <TaskDialog
        task={task}
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
    </>
  );
}