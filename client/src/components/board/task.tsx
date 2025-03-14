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
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      return response.json();
    },
  });

  const priority = priorityConfig[task.priority as keyof typeof priorityConfig];

  return (
    <Draggable draggableId={task.id.toString()} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onClick?.(task)}
          className={cn(
            `bg-white rounded-lg border p-3 cursor-grab active:cursor-grabbing`,
            "transition-all duration-200",
            "hover:border-slate-300 hover:shadow-sm hover:-translate-y-[2px]",
            priority.bg,
            priority.border,
            snapshot.isDragging && [
              "shadow-2xl",
              "scale-[1.02]",
              "rotate-3",
              "border-2",
              "border-primary",
              "!bg-white",
              "z-50"
            ],
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
            {/* Priority Label */}
            <div className="flex items-center gap-2">
              <div className={cn(
                "flex items-center gap-1.5 px-2 py-0.5 rounded-full",
                "border border-current/20",
                priority.color,
              )}>
                <div className={cn("w-1.5 h-1.5 rounded-full", priority.dot)} />
                <span className="text-xs font-medium">{priority.label}</span>
              </div>
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

            <h3 className="font-medium text-sm text-slate-900 line-clamp-2">{task.title}</h3>

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
              {task.dueDate && (
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <CalendarIcon className="h-3 w-3" />
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
        </div>
      )}
    </Draggable>
  );
}