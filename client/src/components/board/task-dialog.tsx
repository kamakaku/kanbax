import { useState, useEffect } from "react";
import { z } from "zod";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { CalendarIcon, PlusCircle, Trash } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Task, taskSchema } from "@shared/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-store";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { UserIcon } from "lucide-react";
import { CommentList } from "@/components/comments/comment-list";

const FormSchema = z.object({
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

interface TaskDialogProps {
  mode?: "create" | "edit"; 
  task?: Task;
  open: boolean;
  onClose: () => void;
  onUpdate?: (task: Task) => Promise<void>;
  onDelete?: () => void;
}

export function TaskDialog({
  mode = "edit",
  task,
  open,
  onClose,
  onUpdate,
  onDelete,
}: TaskDialogProps) {
  const { user } = useAuth(); 
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [comment, setComment] = useState("");
  const [checklist, setChecklist] = useState<{ id?: number; title: string; completed: boolean }[]>([]);
  const [comments, setComments] = useState<{ id?: number; content: string; userId: number; createdAt: string; authorId: number }[]>([]);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!task;

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "todo" as const,
      priority: "medium" as const,
      columnId: undefined,
      labels: [],
      assignedUserIds: [],
      dueDate: null,
      archived: false,
      order: 0,
    },
  });

  useEffect(() => {
    if (task?.id) {
      const fetchTaskData = async () => {
        try {
          const checklistResponse = await fetch(`/api/tasks/${task.id}/checklist`);
          if (checklistResponse.ok) {
            const checklistData = await checklistResponse.json();
            setChecklist(checklistData);
          }

          const commentsResponse = await fetch(`/api/tasks/${task.id}/comments`);
          if (commentsResponse.ok) {
            const commentsData = await commentsResponse.json();
            setComments(commentsData);
          }
        } catch (error) {
          console.error("Error fetching task data:", error);
        }
      };

      fetchTaskData();
    }
  }, [task?.id]);

  useEffect(() => {
    if (open) {
      if (task) {
        form.reset({
          title: task.title,
          description: task.description || "",
          status: task.status as any,
          priority: task.priority as any,
          columnId: task.columnId,
          labels: task.labels || [],
          assignedUserIds: task.assignedUserIds || [],
          dueDate: task.dueDate,
          archived: task.archived || false,
          order: task.order,
        });
      } else {
        form.reset({
          title: "",
          description: "",
          status: "todo" as const,
          priority: "medium" as const,
          columnId: undefined,
          labels: [],
          assignedUserIds: [],
          dueDate: null,
          archived: false,
          order: 0,
        });
      }
    }
  }, [form, open, task]);

  const createTask = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("/api/tasks", {
        method: "POST",
        data,
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
      toast({
        title: "Aufgabe erstellt",
        description: "Die Aufgabe wurde erfolgreich erstellt",
      });
      onClose();
    },
    onError: (error) => {
      console.error("Error creating task:", error);
      toast({
        title: "Fehler",
        description: "Die Aufgabe konnte nicht erstellt werden",
        variant: "destructive",
      });
    },
  });

  const addLabel = () => {
    if (newLabel.trim()) {
      const currentLabels = form.getValues("labels") || [];
      if (!currentLabels.includes(newLabel.trim())) {
        form.setValue("labels", [...currentLabels, newLabel.trim()]);
      }
      setNewLabel("");
    }
  };

  const removeLabel = (label: string) => {
    const currentLabels = form.getValues("labels") || [];
    form.setValue(
      "labels",
      currentLabels.filter((l) => l !== label)
    );
  };

  const addChecklistItem = async () => {
    if (newChecklistItem.trim() && task?.id) {
      try {
        const response = await apiRequest("POST", `/api/tasks/${task.id}/checklist`, {
          title: newChecklistItem,
          completed: false
        });

        if (!response.ok) {
          throw new Error("Failed to add checklist item");
        }

        const newItem = await response.json();
        setChecklist([...checklist, newItem]);
        setNewChecklistItem("");
      } catch (error) {
        console.error("Error adding checklist item:", error);
        toast({
          title: "Fehler",
          description: "Das Checklist-Element konnte nicht hinzugefügt werden",
          variant: "destructive",
        });
      }
    }
  };

  const toggleChecklistItem = async (itemId: number, completed: boolean) => {
    if (task?.id) {
      try {
        const response = await apiRequest("PATCH", `/api/tasks/${task.id}/checklist/${itemId}`, {
          completed
        });

        if (!response.ok) {
          throw new Error("Failed to update checklist item");
        }

        setChecklist(
          checklist.map(item => 
            item.id === itemId ? { ...item, completed } : item
          )
        );
      } catch (error) {
        console.error("Error updating checklist item:", error);
        toast({
          title: "Fehler",
          description: "Das Checklist-Element konnte nicht aktualisiert werden",
          variant: "destructive",
        });
      }
    }
  };

  const deleteChecklistItem = async (itemId: number) => {
    if (task?.id) {
      try {
        const response = await apiRequest("DELETE", `/api/tasks/${task.id}/checklist/${itemId}`);

        if (!response.ok) {
          throw new Error("Failed to delete checklist item");
        }

        setChecklist(checklist.filter(item => item.id !== itemId));
      } catch (error) {
        console.error("Error deleting checklist item:", error);
        toast({
          title: "Fehler",
          description: "Das Checklist-Element konnte nicht gelöscht werden",
          variant: "destructive",
        });
      }
    }
  };

  const addComment = async () => {
    if (comment.trim() && task?.id && user?.id) {
      try {
        const response = await apiRequest("POST", `/api/tasks/${task.id}/comments`, {
          content: comment,
          rawContent: comment, 
          authorId: user.id,
          taskId: task.id
        });

        // Alle Kommentare neu laden, um korrekte Benutzerdaten zu erhalten
        await queryClient.invalidateQueries({ queryKey: [`/api/tasks/${task?.id}/comments`] });

        // Kommentare neu laden
        const commentsResponse = await fetch(`/api/tasks/${task?.id}/comments`);
        if (commentsResponse.ok) {
          const updatedComments = await commentsResponse.json();
          setComments(updatedComments);
        }

        setComment("");

      } catch (error) {
        console.error("Error adding comment:", error);
        toast({
          title: "Fehler",
          description: "Der Kommentar konnte nicht hinzugefügt werden",
          variant: "destructive",
        });
      }
    }
  };

  const handleSubmit = async (data: z.infer<typeof FormSchema>) => {
    try {
      const cleanedData = {
        ...data,
        title: data.title.trim(),
        dueDate: data.dueDate,
        assignedTeamId: data.assignedTeamId && data.assignedTeamId > 0 ? data.assignedTeamId : null,
        description: data.description || "",
        labels: data.labels || [],
        assignedUserIds: data.assignedUserIds || [],
      };

      if (isEditing && task && onUpdate) {
        const updateData = {
          id: task.id,
          title: cleanedData.title,
          description: cleanedData.description,
          status: cleanedData.status,
          priority: cleanedData.priority,
          columnId: cleanedData.columnId, 
          boardId: task.boardId, 
          labels: cleanedData.labels,
          assignedUserIds: cleanedData.assignedUserIds,
          assignedTeamId: cleanedData.assignedTeamId,
          dueDate: cleanedData.dueDate,
          archived: cleanedData.archived,
          order: cleanedData.order,
        };

        await onUpdate(updateData);
        onClose();
      } else {
        if (!cleanedData.columnId) {
          throw new Error("Spalte muss ausgewählt werden");
        }

        await createTask.mutateAsync(cleanedData);
        onClose();
      }
    } catch (error) {
      console.error("Form submission error:", error);
      toast({
        title: "Fehler",
        description: "Die Aufgabe konnte nicht gespeichert werden",
        variant: "destructive",
      });
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
      setIsDeleteDialogOpen(false);
      onClose();
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
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Wählen Sie einen Status" />
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
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
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
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
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
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <FormLabel>Labels</FormLabel>
                <div className="flex flex-wrap gap-2 mb-2">
                  {form.watch("labels")?.map((label, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-1 bg-primary/20 px-2 py-1 rounded-md"
                    >
                      <span>{label}</span>
                      <button
                        type="button"
                        onClick={() => removeLabel(label)}
                        className="text-red-500 hover:text-red-700"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Neues Label"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addLabel();
                      }
                    }}
                  />
                  <Button type="button" onClick={addLabel} size="sm">
                    Hinzufügen
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <FormLabel>Benutzer zuweisen</FormLabel>
                <p className="text-sm text-muted-foreground">
                  Benutzerzuweisung noch nicht implementiert
                </p>
              </div>

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

              {isEditing && (
                <FormItem>
                  <FormLabel>Kommentare</FormLabel>
                  <div className="border rounded-md p-2">
                    <CommentList taskId={task.id} />
                  </div>
                </FormItem>
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
                    {isEditing ? "Aktualisieren" : "Erstellen"}
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