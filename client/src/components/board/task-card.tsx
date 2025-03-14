import { useState } from "react";
import { type Task, type User } from "@shared/schema";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, PencilIcon } from "lucide-react";
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

const priorityColors = {
  high: "bg-red-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};

export function TaskCard({ task, index }: TaskCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentBoard } = useStore();

  // Fetch users data for assignments
  const { data: users = [], isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }
      return response.json();
    },
  });

  const updateTask = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/tasks/${task.id}`, {
        title: task.title,
        description: task.description,
        priority: task.priority,
        labels: task.labels,
        dueDate: task.dueDate,
        assignedUserIds: task.assignedUserIds,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to update task: ${error}`);
      }

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

  // Calculate checklist progress
  const calculateChecklistProgress = () => {
    if (!task.checklist || task.checklist.length === 0) return 0;

    const completedItems = task.checklist.reduce((count, item) => {
      try {
        // Try to parse the item if it's a JSON string
        let parsedItem;
        if (typeof item === 'string') {
          try {
            parsedItem = JSON.parse(item);
            return count + (parsedItem.checked ? 1 : 0);
          } catch {
            // If parsing fails, assume it's a legacy format or plain text
            return count;
          }
        } else {
          // If it's already an object
          return count + (item.checked ? 1 : 0);
        }
      } catch (e) {
        console.error('Error processing checklist item:', e);
        return count;
      }
    }, 0);

    return Math.round((completedItems / task.checklist.length) * 100);
  };

  const renderAssignedUsers = () => {
    if (isLoadingUsers || !task.assignedUserIds || task.assignedUserIds.length === 0) {
      return null;
    }

    const assignedUsers = task.assignedUserIds
      .map(userId => users.find(u => u.id === userId))
      .filter((user): user is User => user !== undefined);

    if (assignedUsers.length === 0) return null;

    return (
      <div className="flex items-center gap-2">
        <div className="flex -space-x-2">
          {assignedUsers.map((user) => (
            <Avatar key={user.id} className="h-6 w-6 border-2 border-background">
              <AvatarImage src={user.avatarUrl || ''} alt={user.username} />
              <AvatarFallback>
                {user.username.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ))}
        </div>
      </div>
    );
  };

  const progress = calculateChecklistProgress();
  const hasChecklist = task.checklist && task.checklist.length > 0;

  return (
    <>
      <Draggable draggableId={task.id.toString()} index={index}>
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
          >
            <Card className="mb-3 cursor-pointer hover:bg-muted/50 transition-colors">
              <CardHeader className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${priorityColors[task.priority as keyof typeof priorityColors]}`}
                    />
                    <span className="text-sm font-medium">{task.title}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDialogOpen(true);
                    }}
                    className="h-6 w-6 rounded-full p-0"
                  >
                    <PencilIcon className="h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                {task.description && (
                  <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{task.description}</p>
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
                {hasChecklist && (
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Fortschritt</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-1" />
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
                  </div>
                  {renderAssignedUsers()}
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
        onUpdate={updateTask.mutate}
      />
    </>
  );
}