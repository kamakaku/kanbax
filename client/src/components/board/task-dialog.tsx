import { useState, useEffect } from "react";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, PlusCircle, Trash } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Task, taskSchema } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/auth"; // Import useAuth hook

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

const FormSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich"),
  description: z.string().optional(),
  status: z.enum(["todo", "in-progress", "review", "done"]),
  priority: z.enum(["low", "medium", "high"]),
  columnId: z.number().int().optional(),
  boardId: z.number().int().optional(),
  order: z.number().int().optional(),
  labels: z.array(z.string()).optional(),
  assignedUserIds: z.array(z.number()).optional(),
  assignedTeamId: z.number().int().optional().nullable(),
  dueDate: z.date().optional().nullable(),
  archived: z.boolean().optional(),
});

interface TaskDialogProps {
  mode?: "create" | "edit"; // Added mode prop
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
  const { user } = useAuth(); // Get user object from useAuth hook
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [comment, setComment] = useState("");
  const [checklist, setChecklist] = useState<{ id?: number; title: string; completed: boolean }[]>([]);
  const [comments, setComments] = useState<{ id?: number; content: string; userId: number; createdAt: string }[]>([]);

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
      boardId: undefined,
      order: 0,
      labels: [],
      assignedUserIds: [],
      assignedTeamId: null,
      dueDate: null,
      archived: false,
    },
  });

  // Fetch checklist and comments when editing an existing task
  useEffect(() => {
    if (task?.id) {
      const fetchTaskData = async () => {
        try {
          // Fetch checklist items
          const checklistResponse = await fetch(`/api/tasks/${task.id}/checklist`);
          if (checklistResponse.ok) {
            const checklistData = await checklistResponse.json();
            setChecklist(checklistData);
          }

          // Fetch comments
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

  // Reset form when dialog opens or task changes
  useEffect(() => {
    if (open) {
      if (task) {
        form.reset({
          title: task.title,
          description: task.description || "",
          status: task.status as any,
          priority: task.priority as any,
          columnId: task.columnId,
          boardId: task.boardId,
          order: task.order,
          labels: task.labels || [],
          assignedUserIds: task.assignedUserIds || [],
          assignedTeamId: task.assignedTeamId,
          dueDate: task.dueDate ? new Date(task.dueDate) : null,
          archived: task.archived || false,
        });
      } else {
        form.reset({
          title: "",
          description: "",
          status: "todo" as const,
          priority: "medium" as const,
          columnId: undefined,
          boardId: undefined,
          order: 0,
          labels: [],
          assignedUserIds: [],
          assignedTeamId: null,
          dueDate: null,
          archived: false,
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
        const response = await apiRequest(`/api/tasks/${task.id}/checklist`, {
          method: "POST",
          data: {
            title: newChecklistItem,
            completed: false
          }
        });

        setChecklist([...checklist, response]);
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
        await apiRequest(`/api/tasks/${task.id}/checklist/${itemId}`, {
          method: "PATCH",
          data: { completed }
        });

        setChecklist(
          checklist.map(item => 
            item.id === itemId ? { ...item, completed } : item
          )
        );
      } catch (error) {
        console.error("Error updating checklist item:", error);
      }
    }
  };

  const deleteChecklistItem = async (itemId: number) => {
    if (task?.id) {
      try {
        await apiRequest(`/api/tasks/${task.id}/checklist/${itemId}`, {
          method: "DELETE"
        });

        setChecklist(checklist.filter(item => item.id !== itemId));
      } catch (error) {
        console.error("Error deleting checklist item:", error);
      }
    }
  };

  const addComment = async () => {
    if (comment.trim() && task?.id && user?.id) {
      try {
        const response = await apiRequest("POST", `/api/tasks/${task.id}/comments`, {
          content: comment,
          rawContent: comment, // Für einfache Kommentare setzen wir rawContent = content
          authorId: user.id,
          taskId: task.id
        });

        setComments([...comments, response]);
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
        dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
        assignedTeamId: data.assignedTeamId && data.assignedTeamId > 0 ? data.assignedTeamId : null,
        description: data.description || "",
        labels: data.labels || [],
        assignedUserIds: data.assignedUserIds || [],
      };

      if (isEditing && task && onUpdate) {
        // Wir erstellen ein Update-Objekt mit nur den Feldern, die wir aktualisieren wollen
        const updateData = {
          id: task.id,
          title: cleanedData.title,
          description: cleanedData.description,
          status: cleanedData.status,
          priority: cleanedData.priority,
          columnId: cleanedData.columnId || task.columnId, // Behalte columnId bei, wenn nicht angegeben
          boardId: task.boardId, // Behalte die ursprüngliche boardId
          labels: cleanedData.labels,
          assignedUserIds: cleanedData.assignedUserIds,
          assignedTeamId: cleanedData.assignedTeamId,
          dueDate: cleanedData.dueDate,
          archived: cleanedData.archived || false
        };

        await onUpdate(updateData);
        onClose();
      } else {
        // Für neue Aufgaben muss columnId definiert sein
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
              {/* Title Field */}
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

              {/* Description Field */}
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

              {/* Status Field */}
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

              {/* Priority Field */}
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

              {/* Due Date Field */}
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
                              format(field.value, "PPP")
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
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Labels Section */}
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

              {/* User Assignment Field - PLACEHOLDER */}
              <div className="space-y-2">
                <FormLabel>Benutzer zuweisen</FormLabel>
                <p className="text-sm text-muted-foreground">
                  Benutzerzuweisung noch nicht implementiert
                </p>
              </div>

              {/* Checklist Section - Only visible when editing */}
              {isEditing && (
                <div className="space-y-2">
                  <FormLabel>Checkliste</FormLabel>
                  <div className="space-y-2">
                    {checklist.map((item) => (
                      <div key={item.id || item.title} className="flex items-center gap-2">
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

              {/* Comments Section - Only visible when editing */}
              {isEditing && (
                <div className="space-y-2">
                  <FormLabel>Kommentare</FormLabel>
                  <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
                    {comments.length > 0 ? (
                      comments.map((comment) => (
                        <div key={comment.id} className="text-sm border-b pb-2 last:border-0">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>Benutzer #{comment.userId}</span>
                            <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
                          </div>
                          <div dangerouslySetInnerHTML={{ __html: comment.content }} />
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        Keine Kommentare vorhanden
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Kommentar hinzufügen"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      className="min-h-20"
                    />
                  </div>
                  <Button type="button" onClick={addComment} size="sm" className="w-full">
                    Kommentar hinzufügen
                  </Button>
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
                    {isEditing ? "Aktualisieren" : "Erstellen"}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
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