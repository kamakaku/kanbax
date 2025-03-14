import { useState } from "react";
import { type Task, type User } from "@shared/schema";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, PencilIcon, CheckSquare } from "lucide-react";
import { Draggable } from "react-beautiful-dnd";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { TaskDialog } from "./task-dialog";

interface TaskCardProps {
  task: Task;
  index: number;
}

export function TaskCard({ task, index }: TaskCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const currentBoard = useStore((state) => state.currentBoard);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      return response.json();
    },
  });

  const updateTask = useMutation({
    mutationFn: async (updatedTask: Task) => {
      const response = await apiRequest("PATCH", `/api/tasks/${task.id}`, updatedTask);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/boards", currentBoard?.id, "tasks"],
      });
      toast({ title: "Task updated successfully" });
      setIsDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to update task",
        description: error.message,
        variant: "destructive",
      });
    },
  });


  const renderAssignedUsers = () => {
    if (!task.assignedUserIds || task.assignedUserIds.length === 0) return null;

    const assignedUsers = users.filter(user => 
      task.assignedUserIds.includes(user.id)
    );

    return (
      <div className="flex -space-x-2">
        {assignedUsers.map((user) => (
          <Avatar key={user.id} className="h-6 w-6 border-2 border-background">
            <AvatarImage src={user.avatarUrl || ""} alt={user.username} />
            <AvatarFallback>
              {user.username.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
    );
  };

  const hasChecklist = task.checklist && task.checklist.length > 0;

  return (
    <Draggable draggableId={`task-${task.id}`} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
        >
          <Card className="mb-2">
            <CardHeader className="p-3">
              <div className="flex items-start justify-between">
                <h3 className="text-sm font-medium">{task.title}</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4"
                  onClick={() => setIsDialogOpen(true)}
                >
                  <PencilIcon className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {task.labels && task.labels.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {task.labels.map((label) => (
                    <Badge key={label} variant="secondary">
                      {label}
                    </Badge>
                  ))}
                </div>
              )}


              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {task.dueDate && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <CalendarIcon className="h-4 w-4" />
                      {format(new Date(task.dueDate), "dd.MM.yyyy", { locale: de })}
                    </div>
                  )}
                  {task.assignedUserIds && task.assignedUserIds.length > 0 && (
                    <div className="flex -space-x-2">
                      {task.assignedUserIds.map((userId) => {
                        const user = users.find((u) => u.id === userId);
                        return user ? (
                          <Avatar key={user.id} className="h-6 w-6 border-2 border-background">
                            <AvatarImage src={user.avatarUrl || ""} />
                            <AvatarFallback>
                              {user.username.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <TaskDialog
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            task={task}
            onUpdate={(updatedTask) => updateTask.mutate(updatedTask)}
          />
        </div>
      )}
    </Draggable>
  );
}