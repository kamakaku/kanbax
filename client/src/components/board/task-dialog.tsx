import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { type Task } from "@shared/schema";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/lib/store";
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
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { CalendarIcon, PlusCircle, X, Tag, UserPlus } from "lucide-react";

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
  initialColumnId?: number;
}

interface ChecklistItem {
  text: string;
  checked: boolean;
}

export function TaskDialog({
  task,
  open,
  onClose,
  onUpdate,
  onDelete,
  initialColumnId,
}: TaskDialogProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!task;
  const { currentBoard } = useStore();

  // Benutzer abrufen
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    enabled: open,
  });

  const createTaskMutation = useMutation({
    mutationFn: async (newTask: Partial<Task>) => {
      if (!currentBoard?.id) {
        throw new Error("Kein aktives Board ausgewählt");
      }

      try {
        // Convert checklist items to string array for storage
        const formattedTask = {
          ...newTask,
          checklist: checklist.map(item => item.text)
        };

        console.log("Sending task data:", formattedTask);

        const response = await apiRequest(
          "POST", 
          `/api/boards/${currentBoard.id}/tasks`, 
          formattedTask
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to create task: ${errorText}`);
        }

        return response.json();
      } catch (error) {
        console.error("Mutation error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards", currentBoard?.id, "tasks"] });
      onClose();
      toast({ title: "Aufgabe erfolgreich erstellt" });
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Speichern",
        description: error instanceof Error ? error.message : "Die Aufgabe konnte nicht gespeichert werden",
        variant: "destructive",
      });
    },
  });

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "todo",
      priority: "medium",
      columnId: initialColumnId || 0,
      labels: [],
      assignedUserIds: [],
      dueDate: null,
      archived: false,
      order: 0,
    },
  });

  useEffect(() => {
    if (!open) return;

    form.reset({
      title: task?.title || "",
      description: task?.description || "",
      status: task?.status || "todo",
      priority: task?.priority || "medium",
      columnId: task?.columnId || initialColumnId || 0,
      labels: task?.labels || [],
      assignedUserIds: task?.assignedUserIds || [],
      dueDate: task?.dueDate || null,
      archived: task?.archived || false,
      order: task?.order || 0,
    });

    // Initialize checklist from task's string array
    setChecklist(
      (task?.checklist || []).map(text => ({
        text,
        checked: false
      }))
    );
  }, [open, task, initialColumnId, form]);

  const onSubmit = async (data: TaskFormValues) => {
    try {
      if (!currentBoard?.id) {
        toast({
          title: "Fehler",
          description: "Kein aktives Board ausgewählt",
          variant: "destructive",
        });
        return;
      }

      if (isEditing && task && onUpdate) {
        const updatedTask: Task = {
          ...task,
          ...data,
          checklist: checklist.map(item => item.text) // Convert to string array for storage
        };

        await onUpdate(updatedTask);
        onClose();
      } else {
        const newTaskData = {
          ...data,
          boardId: currentBoard.id,
          checklist: checklist.map(item => item.text) // Convert to string array for storage
        };

        await createTaskMutation.mutateAsync(newTaskData);
      }
    } catch (error) {
      console.error("Form submission error:", error);
      toast({
        title: "Fehler beim Speichern",
        description: error instanceof Error ? error.message : "Die Aufgabe konnte nicht gespeichert werden",
        variant: "destructive",
      });
    }
  };

  const addChecklistItem = () => {
    if (!newChecklistItem.trim()) return;

    const newItem = {
      text: newChecklistItem,
      checked: false
    };

    setChecklist(prev => [...prev, newItem]);
    setNewChecklistItem("");
  };

  const toggleChecklistItem = (index: number) => {
    setChecklist(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const deleteChecklistItem = (index: number) => {
    setChecklist(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddLabel = () => {
    if (!newLabel.trim()) return;
    const currentLabels = form.getValues("labels") || [];
    if (!currentLabels.includes(newLabel)) {
      form.setValue("labels", [...currentLabels, newLabel]);
    }
    setNewLabel("");
  };

  const removeLabel = (labelToRemove: string) => {
    const currentLabels = form.getValues("labels") || [];
    form.setValue("labels", currentLabels.filter(label => label !== labelToRemove));
  };

  const handleDelete = () => {
    setIsDeleteDialogOpen(true);
  };

  return (
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
                        onSelect={(date) => {
                          if (date instanceof Date) {
                            field.onChange(date.toISOString());
                          } else {
                            field.onChange(null);
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Labels */}
            <FormField
              control={form.control}
              name="labels"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Labels</FormLabel>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {field.value?.map((label, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-md"
                        >
                          <Tag className="h-3 w-3" />
                          <span className="text-sm">{label}</span>
                          <button
                            type="button"
                            onClick={() => removeLabel(label)}
                            className="text-primary/50 hover:text-primary"
                          >
                            <X className="h-3 w-3" />
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
                            handleAddLabel();
                          }
                        }}
                      />
                      <Button type="button" onClick={handleAddLabel} size="sm">
                        <Tag className="h-4 w-4 mr-1" />
                        Hinzufügen
                      </Button>
                    </div>
                  </div>
                </FormItem>
              )}
            />

            {/* Assigned Users */}
            <FormField
              control={form.control}
              name="assignedUserIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Zugewiesene Benutzer</FormLabel>
                  <Select
                    value={field.value?.toString() || ""}
                    onValueChange={(value) => {
                      const userId = parseInt(value);
                      if (!isNaN(userId)) {
                        const currentIds = field.value || [];
                        if (!currentIds.includes(userId)) {
                          field.onChange([...currentIds, userId]);
                        }
                      }
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Benutzer auswählen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {users.map((user: any) => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {field.value?.map((userId) => {
                      const user = users.find((u: any) => u.id === userId);
                      return user ? (
                        <div
                          key={userId}
                          className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-md"
                        >
                          <UserPlus className="h-3 w-3" />
                          <span className="text-sm">{user.username}</span>
                          <button
                            type="button"
                            onClick={() => {
                              field.onChange(field.value?.filter(id => id !== userId));
                            }}
                            className="text-primary/50 hover:text-primary"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : null;
                    })}
                  </div>
                </FormItem>
              )}
            />

            {/* Checklist */}
            <div className="space-y-2">
              <FormLabel>Checkliste</FormLabel>
              <div className="space-y-2">
                {checklist.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => toggleChecklistItem(index)}
                      className="h-4 w-4"
                    />
                    <span className={item.checked ? "line-through text-muted-foreground" : ""}>
                      {item.text}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteChecklistItem(index)}
                      className="ml-auto text-destructive hover:text-destructive/80"
                    >
                      <X className="h-4 w-4" />
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
                  onClick={() => onDelete && task && onDelete(task.id)}
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
  );
}