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
  // Directly enter edit mode
  const [isEditing, setIsEditing] = useState(true);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Check if task is null or undefined
  if (!task) {
    return null;
  }

  const form = useForm<UpdateTask>({
    resolver: zodResolver(updateTaskSchema),
    defaultValues: {
      title: task.title || "",
      description: task.description || "",
      status: task.status || "",
      priority: task.priority || "medium",
      labels: task.labels || [],
    },
  });

  const handleUpdate = async (data: UpdateTask) => {
    try {
      const res = await apiRequest(
        "PATCH",
        `/api/tasks/${task.id}`,
        data
      );

      if (!res.ok) {
        throw new Error("Failed to update task");
      }

      // Aktualisiere Queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["all-tasks"] }),
        queryClient.invalidateQueries({ 
          queryKey: [`/api/boards/${task.boardId}/tasks`] 
        })
      ]);

      if (onUpdate) {
        await onUpdate();
      }

      toast({ title: "Aufgabe erfolgreich aktualisiert" });
      onClose();
    } catch (error) {
      console.error("Task update error:", error);
      toast({
        title: "Fehler",
        description: "Die Aufgabe konnte nicht aktualisiert werden",
        variant: "destructive",
      });
    }
  };

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