import { useState } from "react";
import { type Task } from "@shared/schema";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowRight, ArrowDown, Calendar, CheckSquare, MessageSquare } from "lucide-react";
import { Draggable } from "react-beautiful-dnd";
import { TaskDialog } from "./task-dialog";
import { format } from "date-fns";

interface TaskCardProps {
  task: Task;
  index: number;
}

const priorityIcons = {
  high: <ArrowUp className="h-4 w-4 text-red-500" />,
  medium: <ArrowRight className="h-4 w-4 text-yellow-500" />,
  low: <ArrowDown className="h-4 w-4 text-green-500" />,
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
            <Card className="mb-3 cursor-pointer hover:bg-muted/50 transition-colors shadow-sm hover:shadow-md">
              {task.coverType && (
                <div 
                  className="h-32 w-full rounded-t-lg" 
                  style={{
                    backgroundColor: task.coverType === 'color' ? task.coverValue : undefined,
                    backgroundImage: task.coverType === 'image' ? `url(${task.coverValue})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                />
              )}
              <CardHeader className="p-3 pb-2">
                {task.labels && task.labels.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {task.labels.map((label) => (
                      <Badge key={label} variant="secondary" className="px-2 py-0.5 text-xs">
                        {label}
                      </Badge>
                    ))}
                  </div>
                )}
                <h3 className="text-sm font-medium line-clamp-2">{task.title}</h3>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-2">
                {task.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {task.description}
                  </p>
                )}
                <div className="flex items-center gap-3 text-muted-foreground">
                  {task.dueDate && (
                    <div className="flex items-center gap-1 text-xs">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(task.dueDate), 'MMM d')}
                    </div>
                  )}
                  <div className="flex items-center gap-1 ml-auto">
                    {priorityIcons[task.priority as keyof typeof priorityIcons]}
                  </div>
                </div>
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