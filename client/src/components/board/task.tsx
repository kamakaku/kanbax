
import { type Task as TaskType } from "@shared/schema";
import { Draggable } from "react-beautiful-dnd";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { CalendarIcon, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
            "bg-white rounded-lg border border-slate-200 shadow-sm p-3 cursor-pointer hover:border-slate-300 transition-colors relative",
            snapshot.isDragging && "shadow-lg",
            task.priority === "high" && "border-t-[5px] border-t-red-500",
            task.priority === "medium" && "border-t-[5px] border-t-yellow-500",
            task.priority === "low" && "border-t-[5px] border-t-blue-500"
          )}
        >
          <h3 className="font-medium text-sm text-slate-900 line-clamp-2 mb-2">{task.title}</h3>
          
          {task.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {task.labels.map((label) => (
                <span key={label} className="px-1.5 py-0.5 bg-slate-100 rounded text-xs text-slate-600">{label}</span>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2">
              {task.dueDate && (
                <div className="flex items-center gap-1">
                  <CalendarIcon className="h-4 w-4" />
                  <span>{format(new Date(task.dueDate), "dd.MM.", { locale: de })}</span>
                </div>
              )}
              {task.dueDate && (
                <span>{format(new Date(task.dueDate), "dd.MM.", { locale: de })}</span>
              )}
              {task.assignedUserIds && task.assignedUserIds.length > 0 && (
                <div className="flex -space-x-2">
                  {task.assignedUserIds.map((userId) => {
                    const user = users.find((u) => u.id === userId);
                    return user ? (
                      <Avatar key={userId} className="h-5 w-5 border-2 border-background">
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

            {showBoardTitle && task.boardTitle && (
              <span className="text-xs text-slate-400">{task.boardTitle}</span>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}
