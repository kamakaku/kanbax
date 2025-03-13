import { useState } from "react";
import { type Task as TaskType } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Draggable } from "react-beautiful-dnd";
import { TaskDialog } from "./task-dialog";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, MessageSquare, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";

interface TaskProps {
  task: TaskType;
  index: number;
  showBoardTitle?: boolean;
  onClick?: (task: TaskType) => void;
}

const priorityColors = {
  low: "border-l-blue-400",
  medium: "border-l-orange-400",
  high: "border-l-red-400"
} as const;

const labelColors: Record<string, { bg: string, text: string }> = {
  bug: { bg: "bg-red-50", text: "text-red-700" },
  feature: { bg: "bg-emerald-50", text: "text-emerald-700" },
  ui: { bg: "bg-violet-50", text: "text-violet-700" },
  docs: { bg: "bg-blue-50", text: "text-blue-700" },
  default: { bg: "bg-slate-50", text: "text-slate-700" }
};

export function Task({ task, index, showBoardTitle = false, onClick }: TaskProps) {
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Query for comments
  const { data: comments = [] } = useQuery({
    queryKey: [`/api/tasks/${task.id}/comments`],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${task.id}/comments`);
      if (!res.ok) return [];
      return res.json();
    }
  });

  // Query for checklist items
  const { data: checklistItems = [] } = useQuery({
    queryKey: [`/api/tasks/${task.id}/checklist`],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${task.id}/checklist`);
      if (!res.ok) return [];
      return res.json();
    }
  });

  const handleUpdate = async (updatedTask: TaskType) => {
    await queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/boards", task.boardId, "tasks"] });
    setIsTaskDialogOpen(false);
    toast({ title: "Aufgabe erfolgreich aktualisiert" });
  };

  const handleDelete = async (taskId: number) => {
    await queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/boards", task.boardId, "tasks"] });
    setIsTaskDialogOpen(false);
    toast({ title: "Aufgabe erfolgreich gelöscht" });
  };

  // Get color for label
  const getLabelColor = (label: string) => {
    const normalizedLabel = label.toLowerCase();
    return labelColors[normalizedLabel] || labelColors.default;
  };

  // Calculate checklist progress
  const completedCount = checklistItems.filter(item => item.completed).length;
  const totalCount = checklistItems.length;
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <>
      <Draggable
        draggableId={task.id.toString()}
        index={index}
        key={task.id}
      >
        {(provided, snapshot) => (
          <div
            className="cursor-pointer"
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            ref={provided.innerRef}
            onClick={() => {
              if (onClick) {
                onClick(task);
              } else {
                setIsTaskDialogOpen(true);
              }
            }}
          >
            <Card className={`bg-white shadow-sm hover:shadow-md transition-shadow duration-200 
              border-l-2 ${priorityColors[task.priority]} ${
              snapshot.isDragging ? "shadow-lg ring-1 ring-primary/20" : ""
            }`}>
              <CardContent className="p-3">
                <h3 className="font-medium text-sm text-slate-900 line-clamp-2 mb-2">{task.title}</h3>

                {/* Labels */}
                {task.labels && task.labels.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {task.labels.map((label, i) => {
                      const color = getLabelColor(label);
                      return (
                        <Badge
                          key={i}
                          variant="secondary"
                          className={`px-1.5 py-0.5 text-[10px] ${color.bg} ${color.text} border-none`}
                        >
                          {label}
                        </Badge>
                      );
                    })}
                  </div>
                )}

                {/* Checklist Progress Bar */}
                {checklistItems.length > 0 && (
                  <div className="mt-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <Progress value={percentage} className="h-1.5" />
                      </div>
                      <span className="text-xs text-slate-500 whitespace-nowrap">
                        {percentage}%
                      </span>
                    </div>
                  </div>
                )}

                {/* Footer Info */}
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    {/* User Avatar */}
                    {task.assignedUserId && (
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[10px] bg-slate-100 text-slate-600">
                          <User className="h-3 w-3" />
                        </AvatarFallback>
                      </Avatar>
                    )}

                    {/* Comment Count */}
                    {comments.length > 0 && (
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        <span>{comments.length}</span>
                      </div>
                    )}
                  </div>

                  {showBoardTitle && task.boardTitle && (
                    <span className="text-[10px] font-medium text-slate-600">
                      {task.boardTitle}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </Draggable>

      <TaskDialog
        task={task}
        open={isTaskDialogOpen}
        onClose={() => setIsTaskDialogOpen(false)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </>
  );
}