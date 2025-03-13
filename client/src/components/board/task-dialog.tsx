
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Task } from "@shared/schema";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

// Schema für die Formularvalidierung
const taskSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]),
  status: z.enum(["todo", "in-progress", "done"]),
  boardId: z.number().positive("Board ID ist erforderlich"),
  columnId: z.number().optional(),
  labels: z.array(z.string()).optional()
});

type TaskFormValues = z.infer<typeof taskSchema>;

type TaskDialogProps = {
  task?: Task;
  open: boolean;
  onClose: () => void;
  onUpdate?: (task: Task) => void;
  onDelete?: (taskId: number) => void;
  defaultBoardId?: number;
};

export function TaskDialog({ task, open, onClose, onUpdate, onDelete, defaultBoardId }: TaskDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  // Abrufen der Boards für die Auswahl
  const { data: boards = [] } = useQuery({
    queryKey: ["/api/boards"],
    queryFn: async () => {
      const res = await fetch("/api/boards");
      if (!res.ok) return [];
      return res.json();
    }
  });

  // Form initialisieren
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: task ? {
      ...task,
      labels: task.labels || []
    } : {
      title: "",
      description: "",
      priority: "medium",
      status: "todo",
      boardId: defaultBoardId || (boards[0]?.id || 0),
      labels: []
    }
  });

  // Task erstellen Mutation
  const createTask = useMutation({
    mutationFn: async (values: TaskFormValues) => {
      const response = await fetch(`/api/boards/${values.boardId}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(values)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Fehler beim Erstellen der Aufgabe");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards", data.boardId, "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
      toast({ title: "Aufgabe erfolgreich erstellt" });
      onClose();
    },
    onError: (error) => {
      console.error("Fehler beim Erstellen der Aufgabe:", error);
      toast({ 
        title: "Fehler beim Erstellen der Aufgabe", 
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive" 
      });
    }
  });

  // Task aktualisieren Mutation
  const updateTask = useMutation({
    mutationFn: async (values: TaskFormValues) => {
      if (!task) return null;
      
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(values)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Fehler beim Aktualisieren der Aufgabe");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      if (!data) return;
      queryClient.invalidateQueries({ queryKey: ["/api/boards", data.boardId, "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
      toast({ title: "Aufgabe erfolgreich aktualisiert" });
      if (onUpdate) onUpdate(data);
      onClose();
    },
    onError: (error) => {
      console.error("Fehler beim Aktualisieren der Aufgabe:", error);
      toast({ 
        title: "Fehler beim Aktualisieren der Aufgabe", 
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive" 
      });
    }
  });

  // Task löschen Mutation
  const deleteTask = useMutation({
    mutationFn: async () => {
      if (!task) return null;
      
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "DELETE"
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Fehler beim Löschen der Aufgabe");
      }
      
      return task.id;
    },
    onSuccess: (taskId) => {
      if (!taskId || !task) return;
      queryClient.invalidateQueries({ queryKey: ["/api/boards", task.boardId, "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
      toast({ title: "Aufgabe erfolgreich gelöscht" });
      if (onDelete) onDelete(taskId);
      onClose();
    },
    onError: (error) => {
      console.error("Fehler beim Löschen der Aufgabe:", error);
      toast({ 
        title: "Fehler beim Löschen der Aufgabe", 
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive" 
      });
    }
  });

  // Form-Submit-Handler
  const onSubmit = (values: TaskFormValues) => {
    if (task) {
      updateTask.mutate(values);
    } else {
      createTask.mutate(values);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {task ? "Aufgabe bearbeiten" : "Neue Aufgabe erstellen"}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Board-Auswahl */}
            <FormField
              control={form.control}
              name="boardId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Board</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    value={field.value?.toString()}
                    disabled={!!task}
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
            
            {/* Titel */}
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
            
            {/* Beschreibung */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beschreibung</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Beschreibung der Aufgabe" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Priorität */}
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priorität</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Wählen Sie eine Priorität" />
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
            
            {/* Status */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Wählen Sie einen Status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="todo">Zu erledigen</SelectItem>
                      <SelectItem value="in-progress">In Bearbeitung</SelectItem>
                      <SelectItem value="done">Erledigt</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end gap-2 pt-2">
              {task && (
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={() => deleteTask.mutate()}
                  disabled={deleteTask.isPending}
                >
                  Löschen
                </Button>
              )}
              <Button 
                type="submit" 
                disabled={createTask.isPending || updateTask.isPending}
              >
                {task ? "Aktualisieren" : "Erstellen"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
