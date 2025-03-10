import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type Task } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Calendar, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface TaskDialogProps {
  task: Task & { boardTitle?: string; projectTitle?: string };
  open: boolean;
  onClose: () => void;
}

const priorityColors = {
  high: "bg-red-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};

export function TaskDialog({ task, open, onClose }: TaskDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DialogTitle>{task.title}</DialogTitle>
              <div className={`h-2 w-2 rounded-full ${priorityColors[task.priority as keyof typeof priorityColors]}`} />
            </div>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}