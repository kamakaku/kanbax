import { useState, useEffect } from "react";
import { type Task as TaskType, ChecklistItem } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Draggable } from "react-beautiful-dnd";
import { TaskDialog } from "./task-dialog";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, MessageSquare, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";

interface TaskProps {
  task: TaskType & { boardTitle?: string };
  index: number;
  showBoardTitle?: boolean;
  onClick?: (task: TaskType) => void;
}

const priorityColors = {
  low: "border-t-blue-400",
  medium: "border-t-orange-400",
  high: "border-t-red-400"
} as const;

const labelColors: Record<string, { bg: string, text: string }> = {
  bug: { bg: "bg-red-100", text: "text-red-700" },
  feature: { bg: "bg-green-100", text: "text-green-700" },
  ui: { bg: "bg-purple-100", text: "text-purple-700" },
  docs: { bg: "bg-blue-100", text: "text-blue-700" },
  default: { bg: "bg-gray-100", text: "text-gray-700" }
};

export function Task({ task, index, showBoardTitle = false, onClick }: TaskProps) {
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Query für Kommentare
  const { data: comments = [] } = useQuery({
    queryKey: [`/api/tasks/${task.id}/comments`],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${task.id}/comments`);
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

  // Checklist-Daten vom Server laden
  const { data: checklistItems = [] } = useQuery<ChecklistItem[]>({
    queryKey: ['/api/tasks', task.id, 'checklist'],
    queryFn: async () => {
      if (!task._hasChecklist) return [];
      const res = await fetch(`/api/tasks/${task.id}/checklist`);
      if (!res.ok) {
        throw new Error('Failed to fetch checklist items');
      }
      return res.json();
    },
    enabled: !!task._hasChecklist,
  });

  // Checklist Progress Calculation
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
              border-t-2 border-slate-200 ${priorityColors[task.priority || "medium"]} ${
              snapshot.isDragging ? "shadow-lg ring-1 ring-primary/20" : ""
            }`}>
              <CardContent className="p-3">
                {/* Labels */}
                {task.labels && task.labels.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {task.labels.map((label, i) => {
                      const color = getLabelColor(label);
                      return (
                        <Badge
                          key={i}
                          variant="secondary"
                          className={`px-1.5 py-0.5 text-[10px] ${color.bg} ${color.text} hover:${color.bg}`}
                        >
                          {label}
                        </Badge>
                      );
                    })}
                  </div>
                )}

                {/* Task Title */}
                <div className="flex flex-col gap-1">
                  <h3 className="font-medium text-sm line-clamp-2 mb-2">{task.title}</h3>
                  {task.description && (
                    <p className="text-xs text-muted-foreground truncate">
                      {task.description.substring(0, 50)}
                      {task.description.length > 50 ? "..." : ""}
                    </p>
                  )}

                  {task._hasChecklist && totalCount > 0 && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1">
                          <CheckSquare className="h-3 w-3" />
                          <span className="text-xs text-muted-foreground">
                            {completedCount} von {totalCount} ({percentage}%)
                          </span>
                        </div>
                      </div>
                      <Progress value={percentage} className="h-1.5" />
                    </div>
                  )}
                </div>


                {/* Footer Info */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    {/* User Avatar */}
                    {task.assignedUserId && (
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[10px]">
                          <User className="h-3 w-3" />
                        </AvatarFallback>
                      </Avatar>
                    )}

                    {/* Comment Count */}
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      <span>{comments.length}</span>
                    </div>
                  </div>

                  {showBoardTitle && task.boardTitle && (
                    <span className="text-[10px] font-medium text-primary/80">
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
        open={isTaskDialogOpen}
        onClose={() => setIsTaskDialogOpen(false)}
        task={task}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        defaultTab="info"
      />
    </>
  );
}