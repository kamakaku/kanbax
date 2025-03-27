import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { type Task } from "@shared/schema";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil, CalendarIcon } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Interface erweitern, um persönliche Aufgaben zu unterstützen
interface TaskDialogProps {
  task?: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: (task: Task) => Promise<void>;
  mode?: "edit" | "details";
  initialColumnId?: number;
  personalTask?: boolean;
  isPersonalTask?: boolean;
}

export function TaskDialog({
  task,
  open,
  onOpenChange,
  onUpdate,
  mode = "details",
  initialColumnId,
  personalTask = false,
  isPersonalTask = personalTask,
}: TaskDialogProps) {
  const [isEditMode, setIsEditMode] = useState(mode === "edit");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form schema for task validation
  const formSchema = z.object({
    title: z.string().min(1, { message: "Titel ist erforderlich" }),
    description: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    dueDate: z.date().optional().nullable(),
    assignedUserIds: z.array(z.number()).optional(),
    labels: z.array(z.string()).optional(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: task?.title || "",
      description: task?.description || "",
      status: task?.status || "todo",
      priority: task?.priority || "medium",
      dueDate: task?.dueDate ? new Date(task.dueDate) : null,
      assignedUserIds: task?.assignedUserIds || [],
      labels: task?.labels || [],
    },
  });

  // Laden der verfügbaren Benutzer
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
  });

  // Mutation für Tasks
  const updateTask = useMutation({
    mutationFn: async (updatedTask: Task): Promise<any> => {
      if (!task) return null;
      
      const response = await apiRequest<any>(
        "PATCH",
        `/api/tasks/${task.id}`,
        updatedTask
      );
      
      if (!response.ok) {
        throw new Error("Fehler beim Aktualisieren des Tasks");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = Array.isArray(query.queryKey) ? query.queryKey[0] : query.queryKey;
          return (
            queryKey === "/api/boards" ||
            queryKey === "/api/tasks" ||
            queryKey === "/api/user/tasks/assigned" ||
            (task && queryKey.toString().startsWith(`/api/tasks/${task.id}`))
          );
        }
      });
      
      toast({ title: "Aufgabe erfolgreich aktualisiert" });
      setIsEditMode(false);
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Aktualisieren",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  // Mutation für das Erstellen neuer Tasks
  const createTask = useMutation({
    mutationFn: async (newTask: any): Promise<any> => {
      const endpoint = isPersonalTask
        ? "/api/user/tasks"
        : `/api/boards/${newTask.boardId}/tasks`;

      const response = await apiRequest<any>("POST", endpoint, newTask);
      
      if (!response.ok) {
        throw new Error("Fehler beim Erstellen des Tasks");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = Array.isArray(query.queryKey) ? query.queryKey[0] : query.queryKey;
          return (
            queryKey === "/api/boards" ||
            queryKey === "/api/tasks" ||
            queryKey === "/api/user/tasks/assigned" ||
            (initialColumnId && typeof initialColumnId === 'number' && 
             queryKey.toString().includes(`/api/boards/${initialColumnId}`))
          );
        }
      });
      
      toast({ title: "Aufgabe erfolgreich erstellt" });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Erstellen",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (data: z.infer<typeof formSchema>) => {
    // Bereite die Daten für die Übermittlung vor
    const taskData = {
      ...data,
      ...(task ? {} : { 
        boardId: isPersonalTask ? null : initialColumnId, 
        columnId: isPersonalTask ? null : initialColumnId 
      }),
      // Für bestehende Tasks
      ...(task ? { id: task.id, boardId: task.boardId } : {}),
    };

    try {
      if (task) {
        // Aktualisiere existierenden Task
        if (onUpdate) {
          await onUpdate(taskData as Task);
        } else {
          await updateTask.mutateAsync(taskData as Task);
        }
      } else {
        // Erstelle neuen Task
        await createTask.mutateAsync(taskData);
      }
    } catch (error) {
      console.error("Fehler beim Speichern:", error);
    }
  };

  // Prioritäten-Optionen
  const priorityOptions = [
    { value: "low", label: "Niedrig", color: "bg-green-500" },
    { value: "medium", label: "Mittel", color: "bg-yellow-500" },
    { value: "high", label: "Hoch", color: "bg-red-500" },
  ];

  // Rendere den Dialog
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-6 overflow-y-auto max-h-[90vh]">
        <DialogTitle>
          {task ? (isEditMode ? "Aufgabe bearbeiten" : "Aufgabe Details") : "Neue Aufgabe"}
        </DialogTitle>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4 py-2"
          >
            {/* Titel */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base">Titel</FormLabel>
                  <FormControl>
                    {isEditMode ? (
                      <Input {...field} className="text-base" />
                    ) : (
                      <div className="text-xl font-medium mt-1">{field.value}</div>
                    )}
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
                  <FormLabel className="text-base">Beschreibung</FormLabel>
                  <FormControl>
                    {isEditMode ? (
                      <Textarea
                        {...field}
                        className="min-h-[100px] resize-y"
                      />
                    ) : (
                      <div className="text-sm whitespace-pre-wrap border p-3 rounded-md bg-slate-50">
                        {field.value || "Keine Beschreibung"}
                      </div>
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Priority */}
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priorität</FormLabel>
                  <FormControl>
                    {isEditMode ? (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Wähle eine Priorität" />
                        </SelectTrigger>
                        <SelectContent>
                          {priorityOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <div className="flex items-center">
                                <div
                                  className={`w-3 h-3 rounded-full mr-2 ${option.color}`}
                                />
                                <span>{option.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex items-center space-x-2">
                        {field.value && (
                          <>
                            <div
                              className={`w-3 h-3 rounded-full ${
                                priorityOptions.find(
                                  (option) => option.value === field.value
                                )?.color || "bg-gray-400"
                              }`}
                            />
                            <span>
                              {
                                priorityOptions.find(
                                  (option) => option.value === field.value
                                )?.label || field.value
                              }
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Fälligkeitsdatum */}
            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fälligkeitsdatum</FormLabel>
                  <FormControl>
                    {isEditMode ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? (
                              format(field.value, "PPP", { locale: de })
                            ) : (
                              <span>Wähle ein Datum</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={field.value || undefined}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <div>
                        {field.value
                          ? format(field.value, "PPP", { locale: de })
                          : "Kein Fälligkeitsdatum gesetzt"}
                      </div>
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Zugewiesene Benutzer */}
            <FormField
              control={form.control}
              name="assignedUserIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Zugewiesen an</FormLabel>
                  <FormControl>
                    {isEditMode ? (
                      <Select
                        value={field.value?.length > 0 ? field.value[0].toString() : undefined}
                        onValueChange={(value) => field.onChange([parseInt(value)])}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Benutzer auswählen" />
                        </SelectTrigger>
                        <SelectContent>
                          {users.map((user: any) => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.username}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {field.value && field.value.length > 0 ? (
                          field.value.map((userId) => {
                            const user = users.find((u: any) => u.id === userId);
                            return user ? (
                              <div key={userId} className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={user.avatarUrl} />
                                  <AvatarFallback>
                                    {user.username.substring(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span>{user.username}</span>
                              </div>
                            ) : null;
                          })
                        ) : (
                          <span className="text-gray-500">Keine Benutzer zugewiesen</span>
                        )}
                      </div>
                    )}
                  </FormControl>
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
                  <FormControl>
                    {isEditMode ? (
                      <div className="flex flex-wrap gap-2">
                        {field.value && field.value.map((label) => (
                          <Badge key={label} variant="outline" className="px-2 py-1">
                            {label}
                            <button
                              type="button"
                              className="ml-1 text-gray-500 hover:text-gray-700"
                              onClick={() => {
                                field.onChange(field.value?.filter((l) => l !== label) || []);
                              }}
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                        <div className="flex items-center">
                          <Input
                            placeholder="Neues Label hinzufügen"
                            className="w-full"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const input = e.currentTarget;
                                const value = input.value.trim();
                                if (value && !field.value?.includes(value)) {
                                  field.onChange([...(field.value || []), value]);
                                  input.value = '';
                                }
                              }
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {field.value && field.value.length > 0 ? (
                          field.value.map((label) => (
                            <Badge key={label} variant="outline" className="px-2 py-1">
                              {label}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-gray-500">Keine Labels</span>
                        )}
                      </div>
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Aktionen */}
            <div className="flex justify-end pt-4 space-x-2">
              {isEditMode ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (task) {
                        setIsEditMode(false);
                        form.reset();
                      } else {
                        onOpenChange(false);
                      }
                    }}
                  >
                    Abbrechen
                  </Button>
                  <Button type="submit" disabled={createTask.isPending || updateTask.isPending}>
                    {createTask.isPending || updateTask.isPending ? "Speichern..." : "Speichern"}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    onClick={() => setIsEditMode(true)}
                    className="flex items-center gap-1"
                  >
                    <Pencil className="h-4 w-4" />
                    Bearbeiten
                  </Button>
                </>
              )}
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}