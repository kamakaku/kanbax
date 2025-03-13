import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { type Task } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  SelectValue
} from "@/components/ui/select";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/lib/store";

// Task Form Schema
const taskFormSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]),
  status: z.string().default("todo"),
  columnId: z.number(),
  labels: z.array(z.string()).default([]),
  assignedUserIds: z.array(z.number()).default([]),
  dueDate: z.string().nullable(),
  archived: z.boolean().default(false),
  order: z.number().default(0),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

interface TaskDialogProps {
  open: boolean;
  onClose: () => void;
  task?: Task;
  onUpdate?: (task: Task) => Promise<void>;
  onDelete?: (taskId: number) => Promise<void>;
  defaultColumnId?: string | number;
}

export function TaskDialog({ 
  open, 
  onClose, 
  task,
  onUpdate,
  onDelete,
  defaultColumnId 
}: TaskDialogProps) {
  const { currentBoard } = useStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEditing = !!task;

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: task?.title || "",
      description: task?.description || "",
      priority: (task?.priority || "medium") as "low" | "medium" | "high",
      status: task?.status || "todo",
      columnId: task?.columnId || 0,
      labels: task?.labels || [],
      assignedUserIds: task?.assignedUserIds || [],
      dueDate: task?.dueDate || null,
      archived: task?.archived || false,
      order: task?.order || 0,
    },
  });

  // Spalten für das aktuelle Board abrufen
  const { data: columns = [] } = useQuery({
    queryKey: ["/api/boards", currentBoard?.id, "columns"],
    queryFn: async () => {
      const response = await fetch(`/api/boards/${currentBoard?.id}/columns`);
      if (!response.ok) throw new Error("Failed to fetch columns");
      return response.json();
    },
    enabled: !!currentBoard && open
  });

  // Zurücksetzen des Formulars, wenn der Dialog geöffnet wird
  useEffect(() => {
    if (open) {
      if (isEditing && task) {
        form.reset({
          title: task.title,
          description: task.description || "",
          priority: task.priority as "low" | "medium" | "high",
          status: task.status,
          columnId: task.columnId,
          labels: task.labels || [],
          assignedUserIds: task.assignedUserIds || [],
          dueDate: task.dueDate || null,
          archived: task.archived || false,
          order: task.order || 0,
        });
      } else if (columns.length > 0) {
        const selectedColumnId = defaultColumnId 
          ? columns.find((col: any) => col.id === defaultColumnId)?.id || columns[0].id
          : columns[0].id;

        form.reset({
          title: "",
          description: "",
          priority: "medium",
          status: "todo",
          columnId: selectedColumnId,
          labels: [],
          assignedUserIds: [],
          dueDate: null,
          archived: false,
          order: 0,
        });
      }
    }
  }, [open, form, columns, defaultColumnId, task, isEditing]);

  const createTask = useMutation({
    mutationFn: async (data: TaskFormValues) => {
      if (!currentBoard) {
        throw new Error("Kein Board ausgewählt");
      }

      let columnId = data.columnId;
      if (!columnId && columns.length > 0) {
        columnId = columns[0].id;
      }

      if (!columnId) {
        throw new Error("Keine Spalte verfügbar oder ausgewählt");
      }

      const taskData = {
        ...data,
        boardId: currentBoard.id,
        order: 0,
        columnId: columnId
      };

      const response = await fetch(`/api/boards/${currentBoard.id}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(taskData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Fehler beim Erstellen der Aufgabe: ${errorText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/boards", currentBoard?.id, "tasks"],
      });
      onClose();
      toast({ title: "Aufgabe erfolgreich erstellt" });
    },
    onError: (error: Error) => {
      console.error("Fehler beim Erstellen der Aufgabe:", error);
      toast({
        title: "Fehler beim Erstellen der Aufgabe",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: TaskFormValues) => {
    try {
      if (isEditing && task && onUpdate) {
        const updatedTask: Task = {
          id: task.id,
          boardId: task.boardId,
          title: data.title,
          description: data.description || "",
          status: data.status,
          priority: data.priority,
          columnId: data.columnId,
          order: data.order,
          labels: data.labels || [],
          assignedUserIds: data.assignedUserIds || [],
          assignedTeamId: task.assignedTeamId, // Keep existing assignedTeamId
          assignedAt: task.assignedAt || null,
          dueDate: data.dueDate,
          archived: data.archived,
          checklist: task.checklist || []
        };
        await onUpdate(updatedTask);
        onClose();
      } else {
        await createTask.mutateAsync(data);
      }
    } catch (error) {
      console.error("Form submission error:", error);
      toast({
        title: "Fehler beim Speichern",
        description: "Bitte überprüfen Sie Ihre Eingaben und versuchen Sie es erneut.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (task && onDelete) {
      try {
        await onDelete(task.id);
        onClose();
      } catch (error) {
        console.error("Delete error:", error);
        toast({
          title: "Fehler beim Löschen",
          description: "Die Aufgabe konnte nicht gelöscht werden.",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Aufgabe bearbeiten" : "Neue Aufgabe erstellen"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {currentBoard && (
              <div className="flex items-center space-x-2 mb-4">
                <span className="text-sm font-medium">Board:</span>
                <span className="text-sm">{currentBoard.title}</span>
              </div>
            )}

            <FormField
              control={form.control}
              name="columnId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Spalte</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    value={field.value?.toString()}
                    defaultValue={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Spalte auswählen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {columns?.map((column: any) => (
                        <SelectItem key={column.id} value={column.id.toString()}>
                          {column.title}
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
                    <Input placeholder="Aufgabentitel eingeben..." {...field} />
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
                      {...field}
                    />
                  </FormControl>
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

            <div className="flex justify-between gap-2">
              <Button 
                type="submit" 
                className="flex-1"
                disabled={createTask.isPending}
              >
                {isEditing ? "Speichern" : "Erstellen"}
              </Button>

              {isEditing && onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  className="flex-1"
                >
                  Löschen
                </Button>
              )}
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}