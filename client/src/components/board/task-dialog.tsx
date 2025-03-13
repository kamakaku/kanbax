import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Edit2, MessageSquare } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Task } from "@shared/schema";
import { Form, FormField, FormControl, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChecklistCard } from "@/components/board/checklist-card";
import { CommentList } from "@/components/comments/comment-list";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { EmojiPicker } from "./emoji-picker";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar as CalendarIcon, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";


interface TaskDialogProps {
  task?: Task | null;
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: (isOpen?: boolean) => void;
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

export function TaskDialog({ 
  task, 
  open, 
  onOpenChange, 
  onClose,
  onUpdate,
  onDelete 
}: TaskDialogProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const { currentBoard } = useStore();

  if (!task) return null;

  const handleDelete = async () => {
    if (!task || !onDelete) return;

    try {
      await onDelete(task.id);
      if (onClose) {
        onClose(false);
      } else if (onOpenChange) {
        onOpenChange(false);
      }
      toast({
        title: "Aufgabe gelöscht",
        description: "Die Aufgabe wurde erfolgreich gelöscht.",
      });
    } catch (error) {
      console.error("Task delete error:", error);
      toast({
        title: "Löschen fehlgeschlagen",
        variant: "destructive",
      });
    }
  };

  const updateTask = async (updatedTask: Task) => {
    if (!onUpdate) return;

    try {
      await onUpdate(updatedTask);
      toast({
        title: "Aufgabe aktualisiert",
        description: "Die Änderungen wurden erfolgreich gespeichert.",
      });
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

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      if (onClose) {
        onClose(isOpen);
      } else if (onOpenChange) {
        onOpenChange(isOpen);
      }
    }
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

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Description</h3>
                <p className="text-sm text-muted-foreground mt-1">{task.description || "No description provided."}</p>
              </div>

              {task.dueDate && (
                <div>
                  <h3 className="text-sm font-medium">Due Date</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {format(new Date(task.dueDate), "dd.MM.yyyy", { locale: de })}
                  </p>
                </div>
              )}

              {task.priority && (
                <div>
                  <h3 className="text-sm font-medium">Priority</h3>
                  <p className="text-sm text-muted-foreground mt-1">{priorityLabels[task.priority]}</p>
                </div>
              )}

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
                    onUpdate={updateTask}
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

              <div className="flex justify-end">
                <Button variant="outline" onClick={() => {
                  if (onClose) {
                    onClose(false);
                  } else if (onOpenChange) {
                    onOpenChange(false);
                  }
                }}>
                  Close
                </Button>
              </div>
            </div>
          </>
        ) : (
          <Form>
            <DialogHeader>
              <DialogTitle>
                {task ? "Aufgabe bearbeiten" : "Neue Aufgabe erstellen"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={(e) => {
              e.preventDefault();
              setIsEditing(false);
              // Add form submission logic here if needed
            }} 
            className="space-y-4">
              <div className="flex items-center gap-2">
                <EmojiPicker />
                <FormField
                  control={{}}
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
              </div>
              <FormField
                control={{}}
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
                  control={{}}
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
                  control={{}}
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
                control={{}}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fälligkeitsdatum</FormLabel>
                    <Calendar/>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={{}}
                name="labels"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Labels (durch Komma getrennt)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="bug, feature, UI" />
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