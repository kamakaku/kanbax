import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { type Task } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { CommentList } from "@/components/comments/comment-list";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { CalendarIcon, PlusCircle, Trash } from "lucide-react";

const taskFormSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich"),
  description: z.string().optional(),
  status: z.enum(["todo", "in-progress", "review", "done"]),
  priority: z.enum(["low", "medium", "high"]),
  columnId: z.number(),
  labels: z.array(z.string()).default([]),
  assignedUserIds: z.array(z.number()).default([]),
  dueDate: z.string().nullable(),
  archived: z.boolean().default(false),
  order: z.number().default(0),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

interface TaskDialogProps {
  task?: Task;
  open: boolean;
  onClose: () => void;
  onUpdate?: (task: Task) => Promise<void>;
  onDelete?: (taskId: number) => Promise<void>;
}

export function TaskDialog({
  task,
  open,
  onClose,
  onUpdate,
  onDelete,
}: TaskDialogProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [checklist, setChecklist] = useState<Array<{
    id?: number;
    title: string;
    completed: boolean;
    itemOrder: number;
  }>>([]);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!task;

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: task?.title || "",
      description: task?.description || "",
      status: task?.status || "todo",
      priority: task?.priority || "medium",
      columnId: task?.columnId || 0,
      labels: task?.labels || [],
      assignedUserIds: task?.assignedUserIds || [],
      dueDate: task?.dueDate || null,
      archived: task?.archived || false,
      order: task?.order || 0,
    },
  });

  // Reset form and fetch checklist when dialog opens
  useEffect(() => {
    if (open) {
      // Reset form with task data or default values
      const formData = {
        title: task?.title || "",
        description: task?.description || "",
        status: task?.status || "todo",
        priority: task?.priority || "medium",
        columnId: task?.columnId || 0,
        labels: task?.labels || [],
        assignedUserIds: task?.assignedUserIds || [],
        dueDate: task?.dueDate || null,
        archived: task?.archived || false,
        order: task?.order || 0,
      };

      form.reset(formData);

      // Reset checklist and fetch if editing
      setChecklist([]);
      if (task?.id) {
        fetch(`/api/tasks/${task.id}/checklist`)
          .then(response => response.ok ? response.json() : [])
          .then(items => setChecklist(items.sort((a, b) => a.itemOrder - b.itemOrder)))
          .catch(error => console.error("Error fetching checklist:", error));
      }
    }
  }, [open, task]);

  const addChecklistItem = async () => {
    if (!newChecklistItem.trim() || !task?.id) return;

    try {
      const itemOrder = checklist.length;
      const response = await apiRequest("POST", `/api/tasks/${task.id}/checklist`, {
        title: newChecklistItem,
        completed: false,
        itemOrder,
      });

      if (response.ok) {
        const newItem = await response.json();
        setChecklist(prev => [...prev, newItem]);
        setNewChecklistItem("");
      }
    } catch (error) {
      console.error("Error adding checklist item:", error);
      toast({
        title: "Fehler",
        description: "Das Checklist-Element konnte nicht hinzugefügt werden",
        variant: "destructive",
      });
    }
  };

  const toggleChecklistItem = async (itemId: number, completed: boolean) => {
    if (!task?.id) return;

    try {
      const response = await apiRequest("PATCH", `/api/tasks/${task.id}/checklist/${itemId}`, {
        completed,
      });

      if (response.ok) {
        setChecklist(prev =>
          prev.map(item =>
            item.id === itemId ? { ...item, completed } : item
          )
        );
      }
    } catch (error) {
      console.error("Error updating checklist item:", error);
      toast({
        title: "Fehler",
        description: "Das Checklist-Element konnte nicht aktualisiert werden",
        variant: "destructive",
      });
    }
  };

  const deleteChecklistItem = async (itemId: number) => {
    if (!task?.id) return;

    try {
      const response = await apiRequest("DELETE", `/api/tasks/${task.id}/checklist/${itemId}`);

      if (response.ok) {
        const updatedChecklist = checklist
          .filter(item => item.id !== itemId)
          .map((item, index) => ({ ...item, itemOrder: index }));

        setChecklist(updatedChecklist);

        await Promise.all(
          updatedChecklist.map(item =>
            apiRequest("PATCH", `/api/tasks/${task.id}/checklist/${item.id}`, {
              itemOrder: item.itemOrder,
            })
          )
        );
      }
    } catch (error) {
      console.error("Error deleting checklist item:", error);
      toast({
        title: "Fehler",
        description: "Das Checklist-Element konnte nicht gelöscht werden",
        variant: "destructive",
      });
    }
  };

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
          assignedTeamId: task.assignedTeamId,
          assignedAt: task.assignedAt,
          dueDate: data.dueDate,
          archived: data.archived,
          checklist: task.checklist || [],
        };

        await onUpdate(updatedTask);
        onClose();
      }
    } catch (error) {
      console.error("Form submission error:", error);
      toast({
        title: "Fehler beim Speichern",
        description: "Die Aufgabe konnte nicht gespeichert werden",
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
          description: "Die Aufgabe konnte nicht gelöscht werden",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Aufgabe bearbeiten" : "Neue Aufgabe"}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titel</FormLabel>
                    <FormControl>
                      <Input placeholder="Titel der Aufgabe" {...field} />
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
                        placeholder="Beschreiben Sie die Aufgabe"
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Status auswählen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="todo">Zu erledigen</SelectItem>
                        <SelectItem value="in-progress">In Bearbeitung</SelectItem>
                        <SelectItem value="review">In Überprüfung</SelectItem>
                        <SelectItem value="done">Erledigt</SelectItem>
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
                    <Select onValueChange={field.onChange} value={field.value}>
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
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Fälligkeitsdatum</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={`pl-3 text-left font-normal ${
                              !field.value && "text-muted-foreground"
                            }`}
                          >
                            {field.value ? (
                              format(new Date(field.value), "PPP", { locale: de })
                            ) : (
                              <span>Wählen Sie ein Datum</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(field.value) : undefined}
                          onSelect={(date) => field.onChange(date?.toISOString() || null)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isEditing && (
                <div className="space-y-2">
                  <FormLabel>Checkliste</FormLabel>
                  <div className="space-y-2">
                    {checklist.map((item) => (
                      <div 
                        key={item.id || `item-${Date.now()}-${Math.random()}`} 
                        className="flex items-center gap-2"
                      >
                        <input
                          type="checkbox"
                          checked={item.completed}
                          onChange={(e) => item.id && toggleChecklistItem(item.id, e.target.checked)}
                          className="h-4 w-4"
                        />
                        <span className={item.completed ? "line-through text-muted-foreground" : ""}>
                          {item.title}
                        </span>
                        <button
                          type="button"
                          onClick={() => item.id && deleteChecklistItem(item.id)}
                          className="ml-auto text-red-500 hover:text-red-700"
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Neues Checklist-Element"
                      value={newChecklistItem}
                      onChange={(e) => setNewChecklistItem(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addChecklistItem();
                        }
                      }}
                    />
                    <Button type="button" onClick={addChecklistItem} size="sm">
                      <PlusCircle className="h-4 w-4 mr-1" />
                      Hinzufügen
                    </Button>
                  </div>
                </div>
              )}

              {isEditing && task && (
                <div className="space-y-2">
                  <FormLabel>Kommentare</FormLabel>
                  <CommentList taskId={task.id} />
                </div>
              )}

              <DialogFooter className="flex justify-between items-center">
                {isEditing && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setIsDeleteDialogOpen(true)}
                  >
                    Löschen
                  </Button>
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={onClose}>
                    Abbrechen
                  </Button>
                  <Button type="submit">
                    {isEditing ? "Speichern" : "Erstellen"}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aufgabe löschen</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie diese Aufgabe wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}