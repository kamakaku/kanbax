import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '@shared/schema';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { CalendarIcon, User as UserIcon, Paperclip } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface DndTaskProps {
  task: Task;
  isDragging?: boolean; 
  onClick: (task: Task) => void;
}

export function DndTask({ task, isDragging = false, onClick }: DndTaskProps) {
  const { 
    attributes, 
    listeners, 
    setNodeRef, 
    transform, 
    transition,
    isDragging: isSortableDragging
  } = useSortable({
    id: `task-${task.id}`,
    data: {
      type: 'task',
      task,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      return response.json();
    },
  });

  const renderAssignedUsers = () => {
    if (!task.assignedUserIds || task.assignedUserIds.length === 0) return null;

    const assignedUsers = users.filter((user: any) => 
      task.assignedUserIds!.includes(user.id)
    );
    
    return (
      <div className="flex -space-x-3">
        {assignedUsers.map((user: any) => (
          <Avatar 
            key={user.id} 
            className="h-7 w-7 border-2 border-background"
          >
            <AvatarImage src={user.avatarUrl || ""} />
            <AvatarFallback className="bg-slate-100">
              {user.username.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
    );
  };

  const hasChecklist = task.checklist && task.checklist.length > 0;
  const isPersonalTask = task.boardId === null;
  const actualDragging = isDragging || isSortableDragging;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onClick(task)}
      className={cn(
        "rounded-lg border p-3 mb-2 cursor-grab active:cursor-grabbing transition-all",
        "bg-white border-slate-200 relative overflow-hidden",
        actualDragging && "border-primary shadow-xl scale-[1.02] rotate-3 z-50"
      )}
      style={style}
    >
      {isPersonalTask && (
        <div className="absolute top-0 right-0 w-8 h-8 overflow-hidden">
          <div className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 rotate-45 bg-gradient-to-r from-blue-400 to-blue-600 text-white w-10 h-10"></div>
        </div>
      )}
      
      {/* Header mit Titel */}
      <div className="mb-2">
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
        
      {/* Labels */}
      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.labels.map((label) => (
            <Badge key={label} variant="secondary">
              {label}
            </Badge>
          ))}
        </div>
      )}

      {/* Checklist Progress */}
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

      {/* Footer mit Datum, Anhängen und Benutzern */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          {task.dueDate && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <CalendarIcon className="h-4 w-4" />
              {format(new Date(task.dueDate), "dd.MM.yyyy", { locale: de })}
            </div>
          )}
          
          {/* Anzeige der Dateianhänge */}
          {task.attachments && Array.isArray(task.attachments) && task.attachments.length > 0 && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Paperclip className="h-4 w-4" />
              <span>{task.attachments.length}</span>
            </div>
          )}
        </div>
        
        {renderAssignedUsers()}
      </div>
    </div>
  );
}