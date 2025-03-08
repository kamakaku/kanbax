import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type Task } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowRight, ArrowDown } from "lucide-react";
import { CommentSection } from "@/components/comments/comment-section";
import { ChecklistSection } from "@/components/checklist/checklist-section";

interface TaskDialogProps {
  task: Task;
  open: boolean;
  onClose: () => void;
}

const priorityIcons = {
  high: <ArrowUp className="h-4 w-4 text-red-500" />,
  medium: <ArrowRight className="h-4 w-4 text-yellow-500" />,
  low: <ArrowDown className="h-4 w-4 text-green-500" />,
};

export function TaskDialog({ task, open, onClose }: TaskDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{task.title}</DialogTitle>
            {priorityIcons[task.priority as keyof typeof priorityIcons]}
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