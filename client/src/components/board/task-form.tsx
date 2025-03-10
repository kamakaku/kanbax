import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTaskSchema, type InsertTask, type Project, type Board, type Task } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TaskFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  projects: Project[];
  boards: Board[];
  existingTask?: Task;
}

export function TaskForm({ open, onClose, onSubmit, projects, boards, existingTask }: TaskFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertTask>({
    resolver: zodResolver(insertTaskSchema),
    defaultValues: {
      title: existingTask?.title || "",
      description: existingTask?.description || "",
      status: existingTask?.status || "todo",
      boardId: existingTask?.boardId,
      priority: existingTask?.priority || "medium",
      labels: existingTask?.labels || [],
      columnId: existingTask?.columnId || 0,
      order: existingTask?.order || 0,
      archived: existingTask?.archived || false,
    },
  });

  const saveTask = useMutation({
    mutationFn: async (data: InsertTask) => {
      const endpoint = existingTask 
        ? `/api/boards/${data.boardId}/tasks/${existingTask.id}`
        : `/api/boards/${data.boardId}/tasks`;

      const method = existingTask ? "PATCH" : "POST";

      console.log(`${method} request to ${endpoint}`, data); // Debug-Log

      const res = await apiRequest(
        method,
        endpoint,
        {
          ...data,
          columnId: data.columnId || 0,
          order: existingTask?.order || 0,
          archived: false,
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Server response:", errorData); // Debug-Log
        throw new Error(errorData.message || "Failed to save task");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
      boards.forEach(board => {
        queryClient.invalidateQueries({ 
          queryKey: [`/api/boards/${board.id}/tasks`] 
        });
      });
      toast({ 
        title: existingTask 
          ? "Aufgabe erfolgreich aktualisiert" 
          : "Aufgabe erfolgreich erstellt" 
      });
      form.reset();
      onSubmit();
      onClose();
    },
    onError: (error) => {
      console.error("Task save error:", error);
      toast({
        title: "Fehler",
        description: existingTask 
          ? "Die Aufgabe konnte nicht aktualisiert werden"
          : "Die Aufgabe konnte nicht erstellt werden",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (data: InsertTask) => {
    try {
      if (!data.boardId || !data.title) {
        toast({
          title: "Fehlende Angaben",
          description: "Bitte wählen Sie ein Board aus und geben Sie einen Titel ein",
          variant: "destructive",
        });
        return;
      }

      // Stelle sicher, dass alle erforderlichen Felder vorhanden sind
      const taskData: InsertTask = {
        ...data,
        columnId: data.columnId || 0,
        order: existingTask?.order || 0,
        archived: false,
        status: data.status || "todo",
        priority: data.priority || "medium",
        labels: data.labels || [],
      };

      console.log("Submitting task:", taskData); // Debug-Log
      await saveTask.mutateAsync(taskData);
    } catch (error) {
      console.error("Form submission error:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existingTask ? "Aufgabe bearbeiten" : "Neue Aufgabe erstellen"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="boardId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Board</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    defaultValue={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Wählen Sie ein Board" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {boards.map((board) => (
                        <SelectItem key={board.id} value={board.id.toString()}>
                          {board.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titel</FormLabel>
                  <FormControl>
                    <Input placeholder="Aufgabentitel" {...field} />
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
                      placeholder="Beschreiben Sie die Aufgabe..."
                      className="min-h-[100px]"
                      value={field.value || ""}
                      onChange={field.onChange}
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
              {existingTask ? "Aufgabe aktualisieren" : "Aufgabe erstellen"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}