import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type Task } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateTaskSchema } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CommentList } from "@/components/comments/comment-list";
import { useStore } from "@/lib/store";
import { Calendar as CalendarIcon, Edit2, MessageSquare, Plus, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {ChecklistCard} from "@/components/board/checklist-card";
import { EmojiPicker } from "./emoji-picker";

interface TaskDialogProps {
  task?: Task | null;
  open: boolean;
  onClose: (isOpen?: boolean) => void;
  onUpdate?: (task: Task) => Promise<void>;
  onDelete?: (taskId: number) => Promise<void>;
}

const statusLabels: Record<string, string> = {
  'backlog': 'Backlog',
  'todo': 'To Do',
  'in-progress': 'In Progress',
  'review': 'Review',
  'done': 'Done'
};

const priorityLabels: Record<string, string> = {
  'low': 'Niedrig',
  'medium': 'Mittel',
  'high': 'Hoch'
};

export function TaskDialog({ task: initialTask, open, onClose, onUpdate, onDelete }: TaskDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const { currentBoard } = useStore();
  const [task, setTask] = useState<Task | null>(initialTask || null);

  useEffect(() => {
    if (initialTask) {
      setTask(initialTask);
    } else if (!open) {
      setTask(null);
    }
  }, [open, initialTask]);

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
      dueDate: task?.dueDate || null,
      icon: task?.icon || null, // Added icon to defaultValues
    },
  });

  const handleSubmit = async (data: any) => {
    try {
      let response;
      if (task) {
        response = await apiRequest("PATCH", `/api/tasks/${task.id}`, data);
      } else {
        response = await apiRequest("POST", `/api/boards/${currentBoard?.id}/tasks`, data);
      }

      if (!response.ok) {
        throw new Error(task ? "Failed to update task" : "Failed to create task");
      }

      const updatedTask = await response.json();
      await queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
      await queryClient.invalidateQueries({
        queryKey: [`/api/boards/${task?.boardId || currentBoard?.id}/tasks`]
      });

      if (onUpdate) {
        await onUpdate(updatedTask);
      }

      setIsEditing(false);
      toast({ title: task ? "Aufgabe aktualisiert" : "Aufgabe erstellt" });
      onClose(false);
    } catch (error) {
      console.error("Task operation error:", error);
      toast({
        title: "Fehler",
        description: task ? "Die Aufgabe konnte nicht aktualisiert werden" : "Die Aufgabe konnte nicht erstellt werden",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!task || !onDelete) return;

    try {
      await onDelete(task.id);
      onClose(false);
    } catch (error) {
      console.error("Task delete error:", error);
      toast({
        title: "Fehler",
        description: "Die Aufgabe konnte nicht gelöscht werden",
        variant: "destructive",
      });
    }
  };

  const updateTask = async (updateData: Task) => {
    if (!task || !task.id) return;

    try {
      if (onUpdate) {
        // Verhindere, dass der Dialog geschlossen wird während des Updates
        await onUpdate(updateData);

        // Wichtig: KEIN onClose aufrufen nach der Aktualisierung!
        toast({
          title: "Aufgabe aktualisiert",
          description: "Die Änderungen wurden erfolgreich gespeichert.",
        });
      }
    } catch (error) {
      console.error("Task update error:", error);
      toast({
        title: "Aktualisierung fehlgeschlagen",
        variant: "destructive",
      });
    }
  };

  const stopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // Funktion, die verhindert, dass der Dialog bei bestimmten Updates geschlossen wird
  const handleOpenChange = (isOpen: boolean) => {
    // Wenn der Benutzer den Dialog explizit schließt, rufen wir onClose auf
    if (!isOpen) {
      onClose(isOpen);
    }
    // Andernfalls ignorieren wir den Versuch, den Zustand zu ändern
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {task && !isEditing ? (
          <>
            <DialogHeader className="flex flex-row items-center justify-between pb-6">
              <DialogTitle className="text-xl">
                {task.title}
              </DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditing(true)}
                className="h-8 w-8"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            </DialogHeader>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm font-medium mb-1">Status</div>
                    <Badge variant="outline" className="capitalize">
                      {statusLabels[task.status]}
                    </Badge>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm font-medium mb-1">Priorität</div>
                    <Badge variant="outline" className="capitalize">
                      {priorityLabels[task.priority]}
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              {task.description && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Beschreibung</h4>
                  <p className="text-sm text-muted-foreground">{task.description}</p>
                </div>
              )}

              <div className="flex items-center justify-between">
                {task.dueDate && (
                  <div className="flex items-center gap-2 text-sm">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <span>Fällig am {format(new Date(task.dueDate), "dd.MM.yyyy", { locale: de })}</span>
                  </div>
                )}
                {task.assignedUserId && (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">Zugewiesen an</span>
                  </div>
                )}
              </div>

              {task.labels && task.labels.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Labels</h4>
                  <div className="flex flex-wrap gap-1">
                    {task.labels.map((label, i) => (
                      <Badge key={i} variant="secondary">
                        {label}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Checklist */}
              {task && task.id && (
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    stopPropagation(e);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <ChecklistCard
                    task={task}
                    onUpdate={(updatedTask) => {
                      // Stille Aktualisierung ohne Dialog-Schließung
                      updateTask(updatedTask);
                    }}
                  />
                </div>
              )}

              <Separator />

              <div>
                <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  <span>Kommentare</span>
                </h4>
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
              <div className="flex items-center gap-2">
                <EmojiPicker
                  onEmojiSelect={(emoji) => {
                    form.setValue("icon", emoji);
                  }}
                  currentEmoji={form.getValues("icon")}
                />
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Titel</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Beschreibung</FormLabel>
                    <FormControl>
                      <Textarea
                        className="min-h-[100px]"
                        {...field}
                        value={field.value || ""}
                      />
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
                            <SelectValue placeholder="Status auswählen" />
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
                            <SelectValue placeholder="Priorität auswählen" />
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
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fälligkeitsdatum</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={`w-full justify-start text-left font-normal ${
                              !field.value && "text-muted-foreground"
                            }`}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? (
                              format(new Date(field.value), "PPP", { locale: de })
                            ) : (
                              <span>Datum auswählen</span>
                            )}
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

              <FormField
                control={form.control}
                name="labels"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Labels (durch Komma getrennt)</FormLabel>
                    <FormControl>
                      <Input
                        value={field.value?.join(", ") || ""}
                        onChange={(e) => {
                          const labels = e.target.value
                            .split(",")
                            .map((label) => label.trim())
                            .filter(Boolean);
                          field.onChange(labels);
                        }}
                        placeholder="bug, feature, UI"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Task } from "@shared/schema";

interface TaskDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskDialog({ task, open, onOpenChange }: TaskDialogProps) {
  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{task.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <h3 className="font-medium">Description</h3>
            <p className="text-sm text-muted-foreground">{task.description || "No description provided."}</p>
          </div>
          
          {task.dueDate && (
            <div>
              <h3 className="font-medium">Due Date</h3>
              <p className="text-sm text-muted-foreground">
                {new Date(task.dueDate).toLocaleDateString()}
              </p>
            </div>
          )}
          
          <div>
            <h3 className="font-medium">Priority</h3>
            <p className="text-sm text-muted-foreground">{task.priority || "None"}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
