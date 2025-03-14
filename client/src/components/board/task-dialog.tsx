import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { type Task } from "@shared/schema";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CalendarIcon, PlusCircle, X, Tag, UserPlus, Pencil } from "lucide-react";
import { CommentList, CommentEditor } from "@/components/comments/comment-list";
import classnames from 'classnames';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
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
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { User } from "@shared/schema";

interface ChecklistItem {
  text: string;
  checked: boolean;
}

interface TaskDialogProps {
  task?: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: (task: Task) => Promise<void>;
  mode?: "edit" | "details";
  initialColumnId?: number;
}

const taskFormSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich"),
  description: z.string().optional(),
  status: z.enum(["backlog", "todo", "in-progress", "review", "done"]),
  priority: z.enum(["low", "medium", "high"]),
  columnId: z.number(),
  labels: z.array(z.string()).default([]),
  assignedUserIds: z.array(z.number()).default([]),
  dueDate: z.string().nullable(),
  archived: z.boolean().default(false),
  order: z.number().default(0),
});

export function TaskDialog({
  task,
  open,
  onOpenChange,
  onUpdate,
  mode = task ? "details" : "edit",
  initialColumnId,
}: TaskDialogProps) {
  const [newLabel, setNewLabel] = useState("");
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const { toast } = useToast();
  const { currentBoard } = useStore();
  const queryClient = useQueryClient();
  const isEditing = !!task;

  const form = useForm<z.infer<typeof taskFormSchema>>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: task?.title || "",
      description: task?.description || "",
      status: (task?.status || "todo") as "backlog" | "todo" | "in-progress" | "review" | "done",
      priority: (task?.priority || "medium") as "low" | "medium" | "high",
      columnId: task?.columnId || initialColumnId || 0,
      labels: task?.labels || [],
      assignedUserIds: task?.assignedUserIds || [],
      dueDate: task?.dueDate || null,
      archived: task?.archived || false,
      order: task?.order || 0,
    },
  });

  useEffect(() => {
    if (open && task) {
      form.reset({
        title: task.title,
        description: task.description || "",
        status: task.status as "backlog" | "todo" | "in-progress" | "review" | "done",
        priority: task.priority as "low" | "medium" | "high",
        columnId: task.columnId,
        labels: task.labels || [],
        assignedUserIds: task.assignedUserIds || [],
        dueDate: task.dueDate,
        archived: task.archived,
        order: task.order,
      });
    }
  }, [open, task, form]);

  useEffect(() => {
    if (open) {
      setIsEditMode(mode === "edit");
    }
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;

    if (task?.checklist) {
      try {
        const parsedChecklist = task.checklist.map(item => {
          if (typeof item === 'string') {
            return JSON.parse(item);
          }
          return item;
        });
        setChecklist(parsedChecklist);
      } catch (error) {
        console.error('Error parsing checklist:', error);
        setChecklist([]);
      }
    } else {
      setChecklist([]);
    }
  }, [open, task]);

  const { data: usersResponse = [] } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Benutzer");
      }
      return response.json();
    },
  });

  const users = Array.isArray(usersResponse) ? usersResponse : Object.values(usersResponse);

  const updateTaskMutation = useMutation({
    mutationFn: async (updatedTask: Task) => {
      const response = await apiRequest("PATCH", `/api/tasks/${task?.id}`, updatedTask);
      if (!response.ok) {
        throw new Error("Fehler beim Aktualisieren des Tasks");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards", currentBoard?.id, "tasks"] });
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Speichern",
        description: error instanceof Error ? error.message : "Die Aufgabe konnte nicht gespeichert werden",
        variant: "destructive",
      });
    },
  });

  const saveChecklist = async (newChecklist: ChecklistItem[]) => {
    if (!task) return;

    const formattedChecklist = newChecklist.map(item => JSON.stringify(item));
    const updatedTask: Task = {
      ...task,
      checklist: formattedChecklist,
    };

    await updateTaskMutation.mutateAsync(updatedTask);
  };

  const toggleChecklistItem = async (index: number) => {
    const newChecklist = checklist.map((item, i) =>
      i === index ? { ...item, checked: !item.checked } : item
    );
    setChecklist(newChecklist);
    await saveChecklist(newChecklist);
  };

  const deleteChecklistItem = async (index: number) => {
    const newChecklist = checklist.filter((_, i) => i !== index);
    setChecklist(newChecklist);
    await saveChecklist(newChecklist);
  };

  const addChecklistItem = async () => {
    if (!newChecklistItem.trim()) return;
    const newChecklist = [...checklist, { text: newChecklistItem, checked: false }];
    setChecklist(newChecklist);
    setNewChecklistItem("");
    await saveChecklist(newChecklist);
  };

  const handleAddLabel = () => {
    if (!newLabel.trim()) return;
    const currentLabels = form.getValues("labels");
    if (!currentLabels.includes(newLabel)) {
      form.setValue("labels", [...currentLabels, newLabel]);
    }
    setNewLabel("");
  };

  const removeLabel = (labelToRemove: string) => {
    const currentLabels = form.getValues("labels");
    form.setValue(
      "labels",
      currentLabels.filter(label => label !== labelToRemove)
    );
  };

  const onSubmit = async (data: z.infer<typeof taskFormSchema>) => {
    if (!currentBoard?.id) {
      toast({
        title: "Fehler",
        description: "Kein aktives Board ausgewählt",
        variant: "destructive",
      });
      return;
    }

    try {
      const formattedChecklist = checklist.map(item => JSON.stringify(item));

      if (isEditing && task && onUpdate) {
        const updatedTask: Task = {
          ...task,
          ...data,
          checklist: formattedChecklist,
          boardId: currentBoard.id,
        };
        await onUpdate(updatedTask);
        setIsEditMode(false);
      } else {
        const response = await apiRequest(
          "POST",
          `/api/boards/${currentBoard.id}/tasks`,
          {
            ...data,
            boardId: currentBoard.id,
            checklist: formattedChecklist,
          }
        );

        if (!response.ok) {
          throw new Error("Fehler beim Erstellen der Aufgabe");
        }

        queryClient.invalidateQueries({ queryKey: ["/api/boards", currentBoard.id, "tasks"] });
        onOpenChange(false);
        toast({ title: "Aufgabe erfolgreich erstellt" });
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

  const renderAssignedUsers = (isEditMode: boolean, field?: any) => {
    return (
      <div className="space-y-2">
        <div className="text-sm font-medium text-muted-foreground">Zugewiesene Benutzer</div>
        <div className="flex flex-wrap gap-3">
          {users.map((user) => (
            <Button
              key={user.id}
              type="button"
              variant={
                isEditMode
                  ? field?.value?.includes(user.id) ? "default" : "outline"
                  : task?.assignedUserIds?.includes(user.id) ? "default" : "outline"
              }
              className="flex items-center gap-2"
              onClick={() => {
                if (isEditMode) {
                  const currentValue = field?.value || [];
                  const newValue = currentValue.includes(user.id)
                    ? currentValue.filter(id => id !== user.id)
                    : [...currentValue, user.id];
                  field.onChange(newValue);
                }
              }}
              disabled={!isEditMode}
            >
              <Avatar className="h-6 w-6">
                <AvatarImage src={user.avatarUrl || ''} />
                <AvatarFallback>
                  {user.username.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span>{user.username}</span>
            </Button>
          ))}
        </div>
      </div>
    );
  };

  const renderDetailView = () => {
    const priorityConfig = {
      high: {
        color: "text-red-600",
        bg: "bg-red-50",
        border: "border-red-200",
        label: "Hoch",
        dot: "bg-red-600"
      },
      medium: {
        color: "text-yellow-600",
        bg: "bg-yellow-50",
        border: "border-yellow-200",
        label: "Mittel",
        dot: "bg-yellow-600"
      },
      low: {
        color: "text-blue-600",
        bg: "bg-blue-50",
        border: "border-blue-200",
        label: "Niedrig",
        dot: "bg-blue-600"
      }
    };

    const priority = task?.priority ? priorityConfig[task.priority as keyof typeof priorityConfig] : priorityConfig.medium;

    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className={classnames(
              "flex items-center gap-1.5 px-2 py-0.5 rounded-full",
              "border border-current/20",
              priority.color,
            )}>
              <div className={classnames("w-1.5 h-1.5 rounded-full", priority.dot)} />
              <span className="text-xs font-medium">{priority.label}</span>
            </div>

            {task?.labels && task.labels.map((label, index) => (
              <div
                key={index}
                className={classnames(
                  "px-1.5 py-0.5 bg-slate-100 rounded text-xs text-slate-600",
                  "transition-colors hover:bg-slate-200"
                )}
              >
                {label}
              </div>
            ))}
          </div>

          <div className="text-lg font-medium">{task?.title}</div>
          {task?.description && (
            <div className="text-sm text-muted-foreground whitespace-pre-wrap">
              {task.description}
            </div>
          )}

          {task?.dueDate && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarIcon className="h-4 w-4" />
              {format(new Date(task.dueDate), "PPP", { locale: de })}
            </div>
          )}

          {task?.assignedUserIds && task.assignedUserIds.length > 0 && renderAssignedUsers(false)}

          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Checkliste</div>
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

          {task && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Kommentare</div>
              <CommentList taskId={task.id} />
              <CommentEditor
                taskId={task.id}
                onCommentAdded={() => {
                  queryClient.invalidateQueries({
                    queryKey: [`/api/tasks/${task.id}/comments`]
                  });
                }}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsEditMode(true)}
            className="gap-2"
          >
            <Pencil className="h-4 w-4" />
            Bearbeiten
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Schließen
          </Button>
        </DialogFooter>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? (task ? "Aufgabe bearbeiten" : "Neue Aufgabe") : "Aufgabendetails"}
          </DialogTitle>
        </DialogHeader>

        {isEditMode ? (
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
                  <FormItem>
                    <FormLabel>Fälligkeitsdatum</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={`w-full pl-3 text-left font-normal ${
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
                          onSelect={(date) =>
                            field.onChange(date ? date.toISOString() : null)
                          }
                          disabled={(date) =>
                            date < new Date(new Date().setHours(0, 0, 0, 0))
                          }
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

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

              <FormField
                control={form.control}
                name="assignedUserIds"
                render={({ field }) => (
                  <FormItem>
                    {renderAssignedUsers(true, field)}
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                  <CommentEditor taskId={task.id} onCommentAdded={() => {
                    queryClient.invalidateQueries({ queryKey: [`/api/tasks/${task.id}/comments`] });
                  }} />
                </div>
              )}

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Abbrechen
                </Button>
                <Button type="submit">
                  {isEditing ? "Speichern" : "Erstellen"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          renderDetailView()
        )}
      </DialogContent>
    </Dialog>
  );
}