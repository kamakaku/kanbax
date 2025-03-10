import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type Task } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Calendar, Edit2 } from "lucide-react";
import { CommentSection } from "@/components/comments/comment-section";
import { ChecklistSection } from "@/components/checklist/checklist-section";
import { Button } from "@/components/ui/button";
import { TaskForm } from "./task-form";
import { format } from "date-fns";

interface TaskDialogProps {
  task: Task;
  open: boolean;
  onClose: () => void;
  onSubmit?: (task:Task) => void; // Added onSubmit prop with type
}

const priorityColors = {
  high: "bg-red-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};

export function TaskDialog({ task, open, onClose, onSubmit }: TaskDialogProps) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <TaskForm
        open={open}
        onClose={() => {
          setIsEditing(false);
          onClose();
        }}
        existingTask={task}
        onSubmit={onSubmit} // Pass onSubmit prop to TaskForm
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

          <div className="border-t pt-6">
            <ChecklistSection taskId={task.id} />
          </div>

          <div className="border-t pt-6">
            <h3 className="font-semibold mb-4">Comments</h3>
            <CommentSection taskId={task.id} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}