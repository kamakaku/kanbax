import { useState } from "react";
import { type Task as TaskType } from "@shared/schema";
import { Draggable } from "react-beautiful-dnd";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";
import { CalendarIcon, MessageSquare, LayoutDashboard, FolderKanban } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

interface TaskProps {
  task: TaskType;
  index: number;
  onClick?: (task: TaskType) => void;
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

export function Task({ task, index, onClick }: TaskProps) {
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
  const users = Array.isArray(usersResponse) ? usersResponse : Object.values(usersResponse);
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
              className="h-5 w-5 border-2 border-background 
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
            `bg-white rounded-lg border border-slate-200 p-3 cursor-grab active:cursor-grabbing`,
            "transition-all duration-200",
            "hover:border-slate-300 hover:shadow-sm hover:-translate-y-[2px]",
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
          <div className="flex flex-col gap-2">
            {/* Priority and Labels in one row */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className={cn(
                "flex items-center gap-1.5 px-2 py-0.5 rounded-full",
                "border border-current/20",
                priority.color,
              )}>
                <div className={cn("w-1.5 h-1.5 rounded-full", priority.dot)} />
                <span className="text-xs font-medium">{priority.label}</span>
              </div>

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

            <h3 className="font-medium text-sm text-slate-900 line-clamp-2">{task.title}</h3>
            
            {/* Board und Projekt Informationen mit Icons */}
            {(task.board || task.project) && (
              <div className="flex flex-col gap-1 mt-2 text-xs border-t pt-2 border-slate-100">
                {task.board && (
                  <div className="flex items-center gap-1 text-slate-600">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
                      <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
                      <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
                      <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                    <span>{task.board.title}</span>
                  </div>
                )}
                {task.project && (
                  <div className="flex items-center gap-1 text-slate-600">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 18V9C4 8.44772 4.44772 8 5 8H19C19.5523 8 20 8.44772 20 9V18C20 18.5523 19.5523 19 19 19H5C4.44772 19 4 18.5523 4 18Z" stroke="currentColor" strokeWidth="2"/>
                      <path d="M8 8V5C8 4.44772 8.44772 4 9 4H15C15.5523 4 16 4.44772 16 5V8" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                    <span>{task.project.title}</span>
                  </div>
                )}
              </div>
            )}

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

            <div className="flex items-center justify-between mt-1">
              <div className="flex items-center gap-2">
                {task.dueDate && (
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <CalendarIcon className="h-3 w-3" />
                    <span>{format(new Date(task.dueDate), "dd.MM.", { locale: de })}</span>
                  </div>
                )}

                {comments.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <MessageSquare className="h-3 w-3" />
                    <span>{comments.length}</span>
                  </div>
                )}
              </div>

              {renderAssignedUsers()}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}