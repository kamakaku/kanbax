import { useState } from "react";
import { type Task } from "@shared/schema";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";
import { Draggable } from "react-beautiful-dnd";
import { format } from "date-fns";

interface TaskCardProps {
  task: Task & { boardTitle?: string; projectTitle?: string };
  index: number;
  showBoardTitle?: boolean;
  onClick?: () => void;
}

const priorityColors = {
  high: "bg-red-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
} as const;

export function TaskCard({ task, index, showBoardTitle, onClick }: TaskCardProps) {
  return (
    <Draggable draggableId={task.id.toString()} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
        >
          <Card className="mb-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <CardHeader className="p-3">
              <h3 className="text-sm font-medium">{task.title}</h3>
              <div className={`h-1 w-8 rounded ${priorityColors[task.priority as keyof typeof priorityColors]}`} />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {task.description && (
                <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
              )}
              {showBoardTitle && task.boardTitle && (
                <div className="flex items-center gap-1 mb-2">
                  <Badge variant="outline" className="text-xs">
                    {task.boardTitle}
                  </Badge>
                </div>
              )}
              {task.labels && task.labels.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {task.labels.map((label) => (
                    <Badge key={label} variant="secondary">
                      {label}
                    </Badge>
                  ))}
                </div>
              )}
              {task.dueDate && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(task.dueDate), "PPP")}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </Draggable>
  );
}