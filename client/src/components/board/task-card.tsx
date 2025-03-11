import { useState } from "react";
import { Draggable } from "react-beautiful-dnd";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Card, 
  CardContent, 
  CardFooter, 
  CardHeader 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TaskForm } from "./task-form";
import { TaskDeleteDialog } from "./task-delete-dialog";
import { type Task } from "@shared/schema";

type TaskCardProps = {
  task: Task;
  index: number;
};

export function TaskCard({ task, index }: TaskCardProps) {
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  if (!task) {
    return null;
  }

  const taskId = task.id ? `task-${task.id}` : `task-${index}`;

  return (
    <Draggable draggableId={taskId} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
        >
          <Card className="mb-2">
            <CardHeader className="flex flex-row items-center justify-between p-2">
              <div className="font-medium text-sm">{task.title}</div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setShowEditForm(true)}>
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="text-destructive" 
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent className="p-2 pt-0">
              {task.description && (
                <p className="text-xs text-muted-foreground">
                  {task.description}
                </p>
              )}
            </CardContent>
            <CardFooter className="p-2 pt-0 flex flex-wrap gap-1">
              {task.priority && (
                <Badge 
                  variant={task.priority === "high" ? "destructive" : 
                           task.priority === "medium" ? "default" : "outline"}
                  className="text-xs"
                >
                  {task.priority}
                </Badge>
              )}
              {task.labels && task.labels.map((label, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {label}
                </Badge>
              ))}
            </CardFooter>
          </Card>

          <TaskForm
            open={showEditForm}
            onClose={() => setShowEditForm(false)}
            existingTask={task}
          />

          <TaskDeleteDialog
            open={showDeleteDialog}
            onClose={() => setShowDeleteDialog(false)}
            taskId={task.id}
          />
        </div>
      )}
    </Draggable>
  );
}