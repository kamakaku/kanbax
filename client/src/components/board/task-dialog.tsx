import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type Task, type Project, type Board, type UpdateTask } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Calendar, Edit2 } from "lucide-react";
import { CommentSection } from "@/components/comments/comment-section";
import { ChecklistSection } from "@/components/checklist/checklist-section";
import { Button } from "@/components/ui/button";
import { TaskForm } from "./task-form";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TaskDialogProps {
  task: Task & { boardTitle?: string; projectTitle?: string };
  open: boolean;
  onClose: () => void;
  onUpdate?: () => Promise<void>;
  onDelete?: () => void;
  projects?: Project[];
  boards?: Board[];
}

const priorityColors = {
  high: "bg-red-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};

export function TaskDialog({ task, open, onClose, onUpdate, onDelete, projects = [], boards = [] }: TaskDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleTaskUpdate = async (updatedTask: Task) => {
    try {
      console.log("Updating task with data:", updatedTask); // Debug log

      // Erstelle ein Update-Objekt mit nur den zu aktualisierenden Feldern
      const updateData: UpdateTask = {
        title: updatedTask.title,
        description: updatedTask.description,
        status: updatedTask.status,
        priority: updatedTask.priority,
        labels: updatedTask.labels || [],
        dueDate: updatedTask.dueDate
      };

      console.log("Sending update data:", updateData); // Debug log

      const res = await apiRequest(
        "PATCH",
        `/api/boards/${task.boardId}/tasks/${task.id}`,
        updateData
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Server error response:", errorData);
        throw new Error("Failed to update task");
      }

      // Invalidate queries
      await queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
      await queryClient.refetchQueries({ queryKey: ["all-tasks"] });

      // Invalidate and refetch board-specific queries
      if (boards) {
        for (const board of boards) {
          await queryClient.invalidateQueries({ 
            queryKey: [`/api/boards/${board.id}/tasks`] 
          });
          await queryClient.refetchQueries({ 
            queryKey: [`/api/boards/${board.id}/tasks`] 
          });
        }
      }

      if (onUpdate) {
        await onUpdate();
      }

      toast({ title: "Aufgabe erfolgreich aktualisiert" });
      setIsEditing(false);
    } catch (error) {
      console.error("Task update error:", error);
      toast({
        title: "Fehler",
        description: "Die Aufgabe konnte nicht aktualisiert werden",
        variant: "destructive",
      });
    }
  };

  if (isEditing) {
    return (
      <TaskForm
        open={open}
        onClose={() => {
          setIsEditing(false);
          onClose();
        }}
        existingTask={task}
        onSubmit={handleTaskUpdate}
        projects={projects}
        boards={boards}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DialogTitle>{task.title}</DialogTitle>
              <div className={`h-2 w-2 rounded-full ${priorityColors[task.priority as keyof typeof priorityColors]}`} />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsEditing(true)}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {task.description && (
            <p className="text-muted-foreground">{task.description}</p>
          )}

          {task.projectTitle && task.boardTitle && (
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">{task.projectTitle}</Badge>
              <span>•</span>
              <Badge variant="outline">{task.boardTitle}</Badge>
            </div>
          )}

          {task.labels && task.labels.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {task.labels.map((label) => (
                <Badge key={label} variant="secondary">
                  {label}
                </Badge>
              ))}
            </div>
          )}

          {task.dueDate && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {format(new Date(task.dueDate), 'PPP')}
            </div>
          )}

          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status</span>
              <Badge>
                {task.status === 'todo' ? 'To Do' :
                 task.status === 'in-progress' ? 'In Progress' :
                 task.status === 'review' ? 'Review' :
                 task.status === 'done' ? 'Done' : 'Backlog'}
              </Badge>
            </div>
          </div>

          {task.priority && (
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Priorität</span>
                <Badge variant={
                  task.priority === 'high' ? 'destructive' :
                  task.priority === 'medium' ? 'default' : 'secondary'
                }>
                  {task.priority === 'high' ? 'Hoch' :
                   task.priority === 'medium' ? 'Mittel' : 'Niedrig'}
                </Badge>
              </div>
            </div>
          )}

          <div className="border-t pt-6">
            <ChecklistSection taskId={task.id} />
          </div>

          <div className="border-t pt-6">
            <h3 className="font-semibold mb-4">Kommentare</h3>
            <CommentSection taskId={task.id} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}