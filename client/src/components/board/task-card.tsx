import { useState } from "react";
import { type Task } from "@shared/schema";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";
import { Draggable } from "react-beautiful-dnd";
import { TaskDialog } from "./task-dialog";
import { format } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStore } from "@/lib/store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface TaskCardProps {
  task: Task;
  index: number;
}

const priorityColors = {
  high: "bg-red-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};

const priorityLabels = {
  high: "High Priority",
  medium: "Medium Priority",
  low: "Low Priority",
};

export function TaskCard({ task, index }: TaskCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentBoard } = useStore();

  const updatePriority = useMutation({
    mutationFn: async (newPriority: "high" | "medium" | "low") => {
      const res = await apiRequest("PATCH", `/api/tasks/${task.id}`, {
        priority: newPriority,
      });
      if (!res.ok) {
        const error = await res.text();
        throw new Error(`Failed to update priority: ${error}`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/boards", currentBoard?.id, "tasks"],
      });
      toast({ title: "Priority updated" });
    },
    onError: (error) => {
      toast({
        title: "Failed to update priority",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePriorityChange = (e: React.MouseEvent, priority: "high" | "medium" | "low") => {
    e.stopPropagation(); // Prevent opening the task dialog
    updatePriority.mutate(priority);
  };

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
            <Card className="mb-3 cursor-pointer hover:bg-muted/50 transition-colors shadow-sm hover:shadow-md relative overflow-hidden group">
              <div
                className={`absolute top-0 left-0 w-full h-1 ${priorityColors[task.priority as keyof typeof priorityColors]}`}
              />
              <CardHeader className="p-3 pb-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium line-clamp-2">{task.title}</h3>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <div
                        className={`h-2 w-2 rounded-full ${
                          priorityColors[task.priority as keyof typeof priorityColors]
                        } cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity`}
                      />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => handlePriorityChange(e, "high")}>
                        High Priority
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => handlePriorityChange(e, "medium")}>
                        Medium Priority
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => handlePriorityChange(e, "low")}>
                        Low Priority
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
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
                    {format(new Date(task.dueDate), "MMM d")}
                  </div>
                )}
                {task.assignedUserId && (
                  <div className="flex items-center gap-2 mt-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {task.assignedUser?.username?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground">
                      Assigned to: {task.assignedUser?.username}
                    </span>
                  </div>
                )}
                {task.assignedTeamId && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-muted-foreground">
                      Team: {task.assignedTeam?.name}
                    </span>
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