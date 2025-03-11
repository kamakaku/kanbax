import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type Task, type Project, type Board, type UpdateTask } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Calendar, Edit2 } from "lucide-react";
import { CommentSection } from "@/components/comments/comment-section";
import { ChecklistSection } from "@/components/checklist/checklist-section";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateTaskSchema } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  const form = useForm<UpdateTask>({
    resolver: zodResolver(updateTaskSchema),
    defaultValues: {
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      labels: task.labels,
    },
  });

  const handleUpdate = async (data: UpdateTask) => {
    try {
      const res = await apiRequest(
        "PATCH",
        `/api/boards/${task.boardId}/tasks/${task.id}`,
        data
      );

      if (!res.ok) {
        throw new Error("Failed to update task");
      }

      // Aktualisiere Queries
      await queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
      await queryClient.refetchQueries({ queryKey: ["all-tasks"] });

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
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aufgabe bearbeiten</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUpdate)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titel</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Beschreibung</FormLabel>
                    <FormControl>
                      <Textarea
                        className="min-h-[100px]"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Status auswählen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="backlog">Backlog</SelectItem>
                        <SelectItem value="todo">To Do</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="review">Review</SelectItem>
                        <SelectItem value="done">Done</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priorität</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Priorität auswählen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Niedrig</SelectItem>
                        <SelectItem value="medium">Mittel</SelectItem>
                        <SelectItem value="high">Hoch</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="labels"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Labels (durch Komma getrennt)</FormLabel>
                    <FormControl>
                      <Input
                        value={field.value?.join(", ") || ""}
                        onChange={(e) => {
                          const labels = e.target.value
                            .split(",")
                            .map((label) => label.trim())
                            .filter(Boolean);
                          field.onChange(labels);
                        }}
                        placeholder="bug, feature, UI"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full">
                Speichern
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
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