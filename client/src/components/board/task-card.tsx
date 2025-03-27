import { useState } from "react";
import { type Task, type User } from "@shared/schema";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, User as UserIcon, Paperclip } from "lucide-react";
import { Draggable } from "react-beautiful-dnd";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
    mutationFn: async (updatedTask: Task): Promise<any> => {
      const response = await apiRequest<any>("PATCH", `/api/tasks/${task.id}`, updatedTask);
      if (!response.ok) {
        throw new Error("Fehler beim Aktualisieren des Tasks");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = Array.isArray(query.queryKey) ? query.queryKey[0] : query.queryKey;
          return (
            queryKey === "/api/boards" ||
            queryKey === "/api/tasks" ||
            queryKey === "/api/users" ||
            queryKey.startsWith(`/api/tasks/${task.id}`)
          );
        }
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
      task.assignedUserIds!.includes(user.id)
    );

    // Finde heraus, wer der Ersteller ist (für blauen Rand)
    const creatorId = currentBoard?.creator_id;
    
    return (
      <div className="flex -space-x-3">
        {assignedUsers.map((user) => {
          const isCreator = user.id === creatorId;
          return (
            <Avatar 
              key={user.id} 
              className={`h-7 w-7 border-2 ${isCreator ? 'border-blue-500' : 'border-background'}`}
            >
              <AvatarImage src={user.avatarUrl || ""} />
              <AvatarFallback className={`${isCreator ? 'bg-blue-100 text-blue-800' : 'bg-slate-100'}`}>
                {user.username.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          );
        })}
      </div>
    );
  };

  const hasChecklist = task.checklist && task.checklist.length > 0;
  
  // Prüfen, ob dies eine persönliche Aufgabe ist (boardId === null)
  const isPersonalTask = task.boardId === null;

  return (
    <Draggable draggableId={`task-${task.id}`} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => setIsDialogOpen(true)}
          className="cursor-pointer"
        >
          <Card className="mb-2 hover:shadow-md transition-shadow relative overflow-hidden">
            {isPersonalTask && (
              <div className="absolute top-0 right-0 w-8 h-8 overflow-hidden">
                <div className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 rotate-45 bg-gradient-to-r from-blue-400 to-blue-600 text-white w-10 h-10"></div>
              </div>
            )}
            <CardHeader className="p-3">
              <div className="flex items-start justify-between">
                <h3 className="text-sm font-medium">
                  {isPersonalTask && (
                    <div className="inline-flex items-center mr-1">
                      <UserIcon className="h-3 w-3 mr-1 text-blue-500" />
                      <span className="text-xs font-medium bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">Persönliche Aufgabe</span>
                    </div>
                  )}
                  {task.title}
                </h3>
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

              {hasChecklist && (
                <div className="mb-2">
                  <Progress 
                    value={
                      (task.checklist.filter(item => {
                        try {
                          const parsed = JSON.parse(item);
                          return parsed.checked;
                        } catch {
                          return false;
                        }
                      }).length / task.checklist.length) * 100
                    } 
                    className="h-1"
                  />
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
                  
                  {/* Anzeige der Dateianhänge */}
                  {task.attachments && task.attachments.length > 0 && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Paperclip className="h-4 w-4" />
                      <span>{task.attachments.length}</span>
                    </div>
                  )}
                  
                  {renderAssignedUsers()}
                </div>
              </div>
            </CardContent>
          </Card>

          <TaskDialog
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            task={task}
            onUpdate={async (updatedTask) => {
              updateTask.mutate(updatedTask);
              return Promise.resolve(); // Liefere eine Promise zurück
            }}
            mode="details"
          />
        </div>
      )}
    </Draggable>
  );
}