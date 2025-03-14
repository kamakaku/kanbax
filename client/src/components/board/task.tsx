import { type Task as TaskType } from "@shared/schema";
import { Draggable } from "react-beautiful-dnd";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";
import { CalendarIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

interface TaskProps {
  task: TaskType;
  index: number;
  showBoardTitle?: boolean;
  onClick?: (task: TaskType) => void;
}

export function Task({ task, index, showBoardTitle, onClick }: TaskProps) {
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      return response.json();
    },
  });

  return (
    <Draggable draggableId={task.id.toString()} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onClick?.(task)}
          className={cn(
            "bg-white rounded-lg border border-slate-200 p-3",
            "cursor-grab active:cursor-grabbing",
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
            ],
            task.priority === "high" && "border-l-4 border-l-red-500",
            task.priority === "medium" && "border-l-4 border-l-yellow-500",
            task.priority === "low" && "border-l-4 border-l-blue-500"
          )}
          style={{
            ...provided.draggableProps.style,
            transformOrigin: "center center",
            transition: snapshot.isDragging 
              ? undefined 
              : "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)"
          }}
        >
          {task.labels && task.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
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

          <h3 className="font-medium text-sm text-slate-900 line-clamp-2 mb-2">{task.title}</h3>

          {task.checklist && task.checklist.length > 0 && (
            <div className="flex items-center gap-2 mb-2">
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

          <div className="flex items-center justify-between mt-2">
            {task.dueDate && (
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <CalendarIcon className="h-4 w-4" />
                <span>{format(new Date(task.dueDate), "dd.MM.", { locale: de })}</span>
              </div>
            )}

            {task.assignedUserIds && task.assignedUserIds.length > 0 && (
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
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}