import { useState } from "react";
import { type Task as TaskType } from "@shared/schema";
import { Draggable } from "react-beautiful-dnd";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";
import { CalendarIcon, MessageSquare, KanbanSquare, Folder, User as UserIcon, RotateCcw, Archive, Paperclip } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient"; 
import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/schema";

interface TaskProps {
  task: TaskType;
  index: number;
  onClick?: (task: TaskType) => void;
  onUpdate?: (task: TaskType) => Promise<void>;
}

const priorityConfig = {
  high: {
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    label: "Hoch",
    dot: "bg-red-600"
  },
  medium: {
    color: "text-yellow-600",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    label: "Mittel",
    dot: "bg-yellow-600"
  },
  low: {
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    label: "Niedrig",
    dot: "bg-blue-600"
  }
};

export function Task({ task, index, onClick, onUpdate }: TaskProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: usersResponse = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Benutzer");
      }
      return response.json();
    },
  });

  // Mutation zum Wiederherstellen einer archivierten Aufgabe
  const restoreTask = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/tasks/${task.id}`, { 
        ...task,
        archived: false 
      });
    },
    onSuccess: () => {
      toast({
        title: "Aufgabe wiederhergestellt",
        description: "Die Aufgabe wurde erfolgreich wiederhergestellt.",
        variant: "success",
      });

      // Aktualisiere die verschiedenen Caches
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
      queryClient.invalidateQueries({ queryKey: [`/api/boards/${task.boardId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/boards/${task.boardId}/tasks`] });
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${task.id}`] });

      // Wenn onUpdate bereitgestellt wurde, rufe es mit der aktualisierten Aufgabe auf
      if (onUpdate) {
        onUpdate({
          ...task,
          archived: false
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: `Fehler beim Wiederherstellen der Aufgabe: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
        variant: "destructive"
      });
    }
  });

  const handleRestore = (e: React.MouseEvent) => {
    e.stopPropagation(); // Verhindert, dass der Click-Event zum Task-Dialog propagiert
    restoreTask.mutate();
  };

  // Load comments count
  const { data: comments = [] } = useQuery({
    queryKey: [`/api/tasks/${task.id}/comments`],
    queryFn: async () => {
      const response = await fetch(`/api/tasks/${task.id}/comments`);
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Kommentare");
      }
      return response.json();
    },
  });

  // Ensure users is always an array
  const users: User[] = Array.isArray(usersResponse) ? usersResponse : [];
  const priority = priorityConfig[task.priority as keyof typeof priorityConfig];

  const renderAssignedUsers = () => {
    if (!task.assignedUserIds || task.assignedUserIds.length === 0) return null;

    return (
      <div className="flex -space-x-2">
        {task.assignedUserIds.map((userId) => {
          const user = users.find((u) => u.id === userId);
          return user ? (
            <Avatar 
              key={userId} 
              className="h-6 w-6 border-2 border-white 
                       transition-transform hover:scale-110 hover:z-10"
            >
              <AvatarImage src={user.avatarUrl || ""} />
              <AvatarFallback className="text-[10px] bg-slate-100 text-slate-600">
                {user.username.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : null;
        })}
      </div>
    );
  };

  return (
    <Draggable draggableId={task.id.toString()} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onClick?.(task)}
          className={cn(
            `rounded-lg border p-3 cursor-grab active:cursor-grabbing`,
            "transition-all duration-200",
            "hover:border-slate-300 hover:shadow-sm hover:-translate-y-[2px]",
            // Persönliche Aufgaben haben nur einen subtilen Hinweis, keine vollständige Färbung
            task.isPersonal 
              ? "bg-white border-slate-200 relative overflow-hidden" 
              : "bg-white border-slate-200",
            // Archivierte Aufgaben haben einen roten Rahmen
            task.archived && "border-red-200 bg-red-50/30 relative",
            snapshot.isDragging && [
              "shadow-2xl",
              "scale-[1.02]",
              "rotate-3",
              "border-2",
              "border-primary",
              "!bg-white",
              "z-50"
            ]
          )}
          style={{
            ...provided.draggableProps.style,
            transformOrigin: "center center",
            transition: snapshot.isDragging 
              ? undefined 
              : "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)"
          }}
        >
          {/* Farbige Ecke für persönliche Aufgaben */}
          {task.isPersonal && (
            <div className="absolute top-0 right-0 w-8 h-8 overflow-hidden">
              <div className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 rotate-45 bg-gradient-to-r from-blue-400 to-blue-600 text-white w-10 h-10"></div>
            </div>
          )}
          <div className="flex flex-col gap-2">
            {/* Priority and Labels in one row mit Archivierungs-Badge */}
            <div className="flex items-center gap-2 flex-wrap justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <div className={cn(
                  "flex items-center gap-1.5 px-2 py-0.5 rounded-full",
                  "border border-current/20",
                  priority.color,
                )}>
                  <div className={cn("w-1.5 h-1.5 rounded-full", priority.dot)} />
                  <span className="text-xs font-medium">{priority.label}</span>
                </div>

                {/* Archiviert Badge */}
                {task.archived && (
                  <div className="px-2 py-0.5 rounded-full border border-red-200 bg-red-50 text-red-600">
                    <span className="text-xs font-medium">Archiviert</span>
                  </div>
                )}

                {/* Other Labels */}
                {task.labels && task.labels.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {task.labels.map((label) => (
                      <span 
                        key={label} 
                        className="px-1.5 py-0.5 bg-slate-100 rounded text-xs text-slate-600 
                                  transition-colors hover:bg-slate-200"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Wiederherstellungs-Button für archivierte Aufgaben */}
              {task.archived && onUpdate && (
                <Button
                  onClick={handleRestore}
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 bg-gradient-to-r from-blue-400 to-blue-600 text-white rounded-full hover:from-blue-500 hover:to-blue-700"
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
              )}
            </div>

            <h3 className="font-medium text-sm text-slate-900 line-clamp-2">{task.title}</h3>
            
            {/* Beschreibung */}
            {(task.description || task.richDescription) && (
              <div className="mt-1 text-xs text-slate-500 line-clamp-2">
                {task.richDescription ? (
                  <div dangerouslySetInnerHTML={{ __html: task.richDescription }} />
                ) : (
                  task.description
                )}
              </div>
            )}

            {/* Projekt und Board Informationen mit Icons oder "Persönliche Aufgabe" für persönliche Aufgaben */}
            <div className="flex flex-col gap-1 mt-2 text-xs border-t pt-2 border-slate-100">
              {task.isPersonal ? (
                <div className="flex items-center gap-1">
                  <KanbanSquare className="h-3 w-3 text-blue-500" />
                  <span className="bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent font-medium">Persönliche Aufgabe</span>
                </div>
              ) : (
                <>
                  {task.project && (
                    <div className="flex items-center gap-1 text-slate-600">
                      <Folder className="h-3 w-3" />
                      <span>{task.project.title}</span>
                    </div>
                  )}
                  {task.board && (
                    <div className="flex items-center gap-1 text-slate-600">
                      <KanbanSquare className="h-3 w-3" />
                      <span>{task.board.title}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {task.checklist && task.checklist.length > 0 && (
              <div className="flex items-center gap-2">
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
                  className="h-1 flex-1"
                />
                <span className="text-xs text-slate-500">
                  {Math.round((task.checklist.filter(item => {
                    try {
                      const parsed = JSON.parse(item);
                      return parsed.checked;
                    } catch {
                      return false;
                    }
                  }).length / task.checklist.length) * 100)}%
                </span>
              </div>
            )}

            {/* Untere Leiste mit allen Informationen */}
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                {/* Erstelldatum */}
                <div>
                  {task.createdAt && format(new Date(task.createdAt), "dd.MM.yyyy", { locale: de })}
                </div>

                {/* Fälligkeitsdatum */}
                {task.dueDate && (
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3" />
                    <span>{format(new Date(task.dueDate), "dd.MM.", { locale: de })}</span>
                  </div>
                )}

                {/* Kommentare */}
                {comments.length > 0 && (
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    <span>{comments.length}</span>
                  </div>
                )}
                {/* Anhänge */}
                {task.attachments && task.attachments.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Paperclip className="h-3 w-3" />
                    <span>{task.attachments.length}</span>
                  </div>
                )}
              </div>

              {/* Zugewiesene Benutzer */}
              {renderAssignedUsers()}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}