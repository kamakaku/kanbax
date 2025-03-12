import { useState } from "react";
import { type Task as TaskType } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Draggable } from "react-beautiful-dnd";
import { TaskDialog } from "./task-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Clock, Users } from "lucide-react";

interface TaskProps {
  task: TaskType & { boardTitle?: string };
  index: number;
  showBoardTitle?: boolean;
}

const priorityColors = {
  low: "bg-blue-500",
  medium: "bg-orange-500", 
  high: "bg-red-500"
} as const;

export function Task({ task, index, showBoardTitle = false }: TaskProps) {
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleUpdate = async (updatedTask: TaskType) => {
    await queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/boards", task.boardId, "tasks"] });
    setIsTaskDialogOpen(false);
    toast({ title: "Aufgabe erfolgreich aktualisiert" });
  };

  const handleDelete = async (taskId: number) => {
    await queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/boards", task.boardId, "tasks"] });
    setIsTaskDialogOpen(false);
    toast({ title: "Aufgabe erfolgreich gelöscht" });
  };

  return (
    <>
      <Draggable 
        draggableId={task.id.toString()} 
        index={index}
        key={task.id}
      >
        {(provided, snapshot) => (
          <div
            className="cursor-pointer"
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            ref={provided.innerRef}
            onClick={() => setIsTaskDialogOpen(true)}
          >
            <Card className={`bg-white shadow-sm hover:shadow-md transition-shadow duration-200 ${
              snapshot.isDragging ? "shadow-lg ring-2 ring-primary/20" : "hover:ring-1 hover:ring-primary/10"
            }`}>
              <CardContent className="p-4 space-y-3">
                {/* Priority Indicator */}
                <div className="flex items-start justify-between">
                  <div className={`h-2 w-2 rounded-full mt-1 ${priorityColors[task.priority || "medium"]}`} />
                  {task.assignedTeamId && (
                    <Users className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>

                {/* Task Title */}
                <h3 className="font-medium text-sm line-clamp-2">{task.title}</h3>

                {/* Task Description */}
                {task.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {task.description}
                  </p>
                )}

                {/* Labels */}
                {task.labels && task.labels.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {task.labels.map((label, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="px-2 py-0.5 text-[10px] bg-secondary/20 hover:bg-secondary/30"
                      >
                        {label}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Footer Info */}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  {task.dueDate && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>
                        {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {showBoardTitle && task.boardTitle && (
                    <span className="text-[10px] font-medium text-primary/80">
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
        task={task}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </>
  );
}