import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon, MessageSquare, Users } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/lib/store";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Task, insertTaskSchema, updateTaskSchema, User } from "@shared/schema";
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
  task?: Task;
  open: boolean;
  onClose: () => void;
  onUpdate?: (task: Task) => void;
  onDelete?: () => void;
}

const statusLabels: Record<string, string> = {
  'backlog': 'Backlog',
  'todo': 'Zu erledigen',
  'in-progress': 'In Bearbeitung',
  'review': 'Review',
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
  const { currentBoard } = useStore();
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>(task?.assignedUserIds || []);

  const { data: users = [], isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) {
        throw new Error("Failed to fetch users");
      }
      return res.json();
    },
    enabled: open
  });

  const form = useForm({
    resolver: zodResolver(task ? updateTaskSchema : insertTaskSchema),
    defaultValues: {
      title: task?.title || "",
      description: task?.description || "",
      status: task?.status || "todo",
      priority: task?.priority || "medium",
      labels: task?.labels || [],
      boardId: currentBoard?.id,
      columnId: task?.columnId || 0,
      order: task?.order || 0,
      dueDate: task?.dueDate ? new Date(task.dueDate) : null,
    },
  });

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
      });
      setSelectedUserIds(task.assignedUserIds || []);
    }
  }, [task, open, form]);

  const handleSubmit = async (values: any) => {
    try {
      const method = task ? "PATCH" : "POST";
      const endpoint = task ? `/api/tasks/${task.id}` : "/api/tasks";

      // Format the date if it exists
      let dueDateString = null;
      if (values.dueDate) {
        dueDateString = format(new Date(values.dueDate), "yyyy-MM-dd");
      }

      // Prepare the payload
      const payload = {
        title: values.title,
        description: values.description,
        status: values.status,
        priority: values.priority,
        labels: values.labels || [],
        boardId: currentBoard?.id,
        columnId: values.columnId || 0,
        order: values.order || 0,
        dueDate: dueDateString,
        assignedUserIds: selectedUserIds
      };

      console.log('Submitting task with payload:', payload);

      const response = await apiRequest(method, endpoint, payload);
      const updatedTask = await response.json();

      // Invalidate queries to ensure UI updates
      await queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/boards", currentBoard?.id, "tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/users"] });

      if (onUpdate) {
        await onUpdate(updatedTask);
      }

      toast({ 
        title: task ? "Aufgabe erfolgreich aktualisiert" : "Aufgabe erfolgreich erstellt" 
      });
      onClose();
    } catch (error: any) {
      console.error("Task error:", error);
      toast({
        title: "Fehler",
        description: error.message || `Die Aufgabe konnte nicht ${task ? 'aktualisiert' : 'erstellt'} werden`,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (onDelete) {
      onDelete();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {task ? "Aufgabe bearbeiten" : "Neue Aufgabe erstellen"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
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
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
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
                        {Object.entries(priorityLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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

            <div className="space-y-2">
              <FormLabel>Zugewiesene Benutzer</FormLabel>
              {isLoadingUsers ? (
                <div className="text-sm text-muted-foreground">
                  Lade Benutzer...
                </div>
              ) : Array.isArray(users) && users.length > 0 ? (
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
              ) : (
                <div className="text-sm text-muted-foreground">
                  Keine Benutzer verfügbar.
                </div>
              )}
            </div>

            {/* Checklist and Comments sections - only show for existing tasks */}
            {task && (
              <>
                <Separator className="my-4" />
                <div onClick={(e) => e.stopPropagation()}>
                  <ChecklistCard
                    task={task}
                    onUpdate={(updatedTask) => {
                      if (onUpdate) {
                        onUpdate(updatedTask);
                      }
                    }}
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
              </>
            )}

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
              <div className="flex gap-2 ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
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
      </DialogContent>
    </Dialog>
  );
}