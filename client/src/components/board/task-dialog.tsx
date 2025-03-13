import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon, Edit2, MessageSquare, Users } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/lib/store";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { Task, updateTaskSchema, User } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ChecklistCard } from "./checklist-card";
import { Separator } from "@/components/ui/separator";
import { CommentList } from "@/components/comments/comment-list";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TaskDialogProps {
  task: Task;
  open: boolean;
  onClose: () => void;
  onUpdate?: (task: Task) => Promise<void>;
  onDelete?: () => void;
}

const statusLabels: Record<string, string> = {
  'todo': 'Zu erledigen',
  'in-progress': 'In Bearbeitung',
  'done': 'Erledigt'
};

const priorityLabels: Record<string, string> = {
  'low': 'Niedrig',
  'medium': 'Mittel',
  'high': 'Hoch'
};

export function TaskDialog({ task, open, onClose, onUpdate, onDelete }: TaskDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const { currentBoard } = useStore();
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>(task?.assignedUserIds || []);

  // Fetch users for assignment
  const { data: users = [], isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: open // Only fetch when dialog is open
  });

  const form = useForm({
    resolver: zodResolver(updateTaskSchema),
    defaultValues: {
      title: task?.title || "",
      description: task?.description || "",
      status: task?.status || "todo",
      priority: task?.priority || "medium",
      labels: task?.labels || [],
      boardId: task?.boardId || currentBoard?.id || 0,
      columnId: task?.columnId || 0,
      order: task?.order || 0,
      dueDate: task?.dueDate ? new Date(task?.dueDate) : null,
      assignedUserIds: task?.assignedUserIds || [],
    },
  });

  // Update form values when task changes
  useEffect(() => {
    if (task && open) {
      form.reset({
        title: task.title,
        description: task.description || "",
        status: task.status,
        priority: task.priority,
        labels: task.labels || [],
        boardId: task.boardId,
        columnId: task.columnId,
        order: task.order,
        dueDate: task.dueDate ? new Date(task.dueDate) : null,
        assignedUserIds: task.assignedUserIds || [],
      });
      setSelectedUserIds(task.assignedUserIds || []);
    }
  }, [task, open, form]);

  const updateTask = useMutation({
    mutationFn: async () => {
      const values = form.getValues();
      
      // Update form with selected user IDs
      values.assignedUserIds = selectedUserIds;
      
      const response = await apiRequest("PATCH", `/api/tasks/${task.id}`, {
        ...values,
        dueDate: values.dueDate ? values.dueDate.toISOString() : null,
      });

      if (!response.ok) {
        throw new Error("Failed to update task");
      }

      return await response.json();
    },
    onSuccess: async (updatedTask) => {
      await queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
      
      if (onUpdate) {
        await onUpdate(updatedTask);
      }
      
      toast({ title: "Aufgabe erfolgreich aktualisiert" });
      setIsEditing(false);
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: "Die Aufgabe konnte nicht aktualisiert werden",
        variant: "destructive",
      });
      console.error("Task update error:", error);
    },
  });

  const handleSubmit = async (data: any) => {
    // Set the assignedUserIds before submitting
    form.setValue("assignedUserIds", selectedUserIds);
    updateTask.mutate();
  };

  const handleDelete = async () => {
    if (onDelete) {
      onDelete();
    }
  };

  const onOpenChange = (open: boolean) => {
    if (!open) {
      setIsEditing(false);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {task && !isEditing ? (
          <>
            <DialogHeader className="pb-4">
              <div className="space-y-2">
                <DialogTitle className="text-xl">
                  {task.title}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsEditing(true)}
                    className="h-8 w-8 float-right -mt-1"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </DialogTitle>
                {task.labels && task.labels.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {task.labels.map((label, i) => (
                      <Badge key={i} variant="secondary">
                        {label}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </DialogHeader>

            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="capitalize">
                  {statusLabels[task.status]}
                </Badge>
                <Badge variant="outline" className="capitalize">
                  {priorityLabels[task.priority]}
                </Badge>
                {task.dueDate && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarIcon className="h-4 w-4" />
                    <span>{format(new Date(task.dueDate), "dd.MM.yyyy", { locale: de })}</span>
                  </div>
                )}
                {task.assignedUserIds && task.assignedUserIds.length > 0 && (
                  <div className="flex items-center gap-2 ml-auto">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div className="flex -space-x-2">
                      {task.assignedUserIds.map((userId) => {
                        const user = users.find(u => u.id === userId);
                        return user ? (
                          <Avatar key={user.id} className="h-6 w-6 border-2 border-background">
                            <AvatarImage src={user.avatarUrl || ''} />
                            <AvatarFallback>
                              {user.username.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>

              {task.description && (
                <div className="text-sm text-muted-foreground">
                  {task.description}
                </div>
              )}

              {/* Checklist */}
              <div onClick={(e) => e.stopPropagation()}>
                <ChecklistCard
                  task={task}
                  onUpdate={updateTask}
                />
              </div>

              <Separator className="my-4" />

              <div>
                <div className="flex items-center gap-2 text-sm font-medium mb-3">
                  <MessageSquare className="h-4 w-4" />
                  <span>Kommentare</span>
                </div>
                <CommentList taskId={task.id} />
              </div>
            </div>
          </>
        ) : (
          <Form {...form}>
            <DialogHeader>
              <DialogTitle>
                {task ? "Aufgabe bearbeiten" : "Neue Aufgabe erstellen"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 mt-4">
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
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
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
              </div>

              {/* Labels input */}
              <FormField
                control={form.control}
                name="labels"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Labels (durch Komma getrennt)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Feature, Bug, UI..."
                        value={field.value?.join(", ") || ""}
                        onChange={(e) => {
                          const labels = e.target.value
                            .split(",")
                            .map((label) => label.trim())
                            .filter(Boolean);
                          field.onChange(labels);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Due date */}
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
                              format(field.value, "dd.MM.yyyy", { locale: de })
                            ) : (
                              <span>Wähle ein Datum</span>
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

              {/* Assigned Users section */}
              <div className="space-y-2">
                <FormLabel>Zugewiesene Benutzer</FormLabel>
                <div className="flex flex-wrap gap-2">
                  {users.map((user) => (
                    <Button
                      key={user.id}
                      type="button"
                      variant={selectedUserIds.includes(user.id) ? "default" : "outline"}
                      className="flex items-center gap-2"
                      onClick={() => {
                        setSelectedUserIds(prev =>
                          prev.includes(user.id)
                            ? prev.filter(id => id !== user.id)
                            : [...prev, user.id]
                        );
                      }}
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

              <div className="flex justify-between gap-2">
                {task && onDelete && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDelete}
                  >
                    Löschen
                  </Button>
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                  >
                    Abbrechen
                  </Button>
                  <Button type="submit">
                    {task ? "Speichern" : "Erstellen"}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}