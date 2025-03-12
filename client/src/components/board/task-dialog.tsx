import { useState } from "react";
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

interface TaskDialogProps {
  task?: Task;
  open: boolean;
  onClose: () => void;
  onUpdate?: (updatedTask: Task) => Promise<void>;
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

export function TaskDialog({ task, open, onClose, onUpdate, onDelete }: TaskDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const { currentBoard } = useStore();
  const [newItem, setNewItem] = useState("");

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
      checklist: task?.checklist || [],
    },
  });

  const handleSubmit = async (data: any) => {
    try {
      let response;

      if (task) {
        response = await apiRequest(
          "PATCH",
          `/api/tasks/${task.id}`,
          data
        );
      } else {
        response = await apiRequest(
          "POST",
          `/api/boards/${currentBoard?.id}/tasks`,
          data
        );
      }

      if (!response.ok) {
        throw new Error(task ? "Failed to update task" : "Failed to create task");
      }

      const updatedTask = await response.json();

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["all-tasks"] }),
        queryClient.invalidateQueries({
          queryKey: [`/api/boards/${task?.boardId || currentBoard?.id}/tasks`]
        })
      ]);

      if (onUpdate) {
        await onUpdate(updatedTask);
      }

      setIsEditing(false);
      toast({ title: task ? "Aufgabe aktualisiert" : "Aufgabe erstellt" });
      onClose();
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
    if (!onDelete || !task) return;

    try {
      await onDelete(task.id);
      onClose();
    } catch (error) {
      console.error("Task delete error:", error);
      toast({
        title: "Fehler",
        description: "Die Aufgabe konnte nicht gelöscht werden",
        variant: "destructive",
      });
    }
  };

  const handleChecklistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim() || !task || !onUpdate) return;

    try {
      const updatedChecklist = [
        ...(task.checklist || []),
        { text: newItem.trim(), checked: false }
      ];

      const response = await apiRequest(
        "PATCH",
        `/api/tasks/${task.id}`,
        { checklist: updatedChecklist }
      );

      if (!response.ok) throw new Error("Failed to add checklist item");

      const updatedTask = await response.json();
      await onUpdate(updatedTask);
      setNewItem("");
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Der Checklistenpunkt konnte nicht hinzugefügt werden",
        variant: "destructive",
      });
    }
  };

  const handleChecklistItemToggle = async (index: number) => {
    if (!task?.checklist || !onUpdate) return;

    try {
      const updatedChecklist = task.checklist.map((item, i) => 
        i === index ? { ...item, checked: !item.checked } : item
      );

      const response = await apiRequest(
        "PATCH",
        `/api/tasks/${task.id}`,
        { checklist: updatedChecklist }
      );

      if (!response.ok) throw new Error("Failed to update checklist item");

      const updatedTask = await response.json();
      await onUpdate(updatedTask);
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Der Checklistenpunkt konnte nicht aktualisiert werden",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
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

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm font-medium">Checkliste</div>
                    {task.checklist && task.checklist.length > 0 && (
                      <div className="text-sm text-muted-foreground">
                        {task.checklist.filter(item => item.checked).length} von {task.checklist.length}
                      </div>
                    )}
                  </div>

                  {task.checklist && task.checklist.length > 0 && (
                    <Progress
                      value={(task.checklist.filter(item => item.checked).length / task.checklist.length) * 100}
                      className="mb-4"
                    />
                  )}

                  <div className="space-y-4">
                    <div className="space-y-2">
                      {task.checklist?.map((item, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={() => handleChecklistItemToggle(index)}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <span className={`text-sm flex-1 ${item.checked ? 'line-through text-muted-foreground' : ''}`}>
                            {item.text}
                          </span>
                        </div>
                      ))}
                    </div>

                    <form onSubmit={handleChecklistSubmit} className="flex gap-2">
                      <Input
                        value={newItem}
                        onChange={(e) => setNewItem(e.target.value)}
                        placeholder="Neuer Checklistenpunkt"
                      />
                      <Button type="submit" variant="outline" size="icon">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>

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