import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useContext } from "react";
import { insertTaskSchema, type Task } from "@shared/schema";
import { BoardContext } from "@/context/board-context";
import { apiRequest } from "@/lib/api-request";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface TaskDialogProps {
  open: boolean;
  onClose: () => void;
  onUpdate?: (task: Task) => Promise<void>;
  task?: Task | null;
  defaultStatus?: string;
}

export function TaskDialog({
  open,
  onClose,
  onUpdate,
  task,
  defaultStatus = "todo"
}: TaskDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentBoard } = useContext(BoardContext);
  const isEditMode = !!task;

  const form = useForm({
    resolver: zodResolver(insertTaskSchema),
    defaultValues: {
      title: task?.title || "",
      description: task?.description || "",
      status: task?.status || defaultStatus,
      priority: task?.priority || "medium",
      boardId: currentBoard?.id || 0,
      columnId: task?.columnId || 0,
      order: task?.order || 0,
      labels: task?.labels || [],
      assignedUserIds: task?.assignedUserIds || [],
    },
  });

  const onSubmit = async (values: any) => {
    try {
      if (!currentBoard?.id) {
        throw new Error("Kein aktives Board ausgewählt");
      }

      const method = isEditMode ? "PATCH" : "POST";
      const endpoint = isEditMode 
        ? `/api/tasks/${task.id}` 
        : `/api/boards/${currentBoard.id}/tasks`;

      const response = await apiRequest(method, endpoint, {
        ...values,
        boardId: currentBoard.id,
      });

      if (!response.ok) {
        throw new Error("Failed to save task");
      }

      const updatedTask = await response.json();

      await queryClient.invalidateQueries({
        queryKey: ["/api/boards", currentBoard.id, "tasks"],
      });

      if (onUpdate) {
        await onUpdate(updatedTask);
      }

      toast({
        title: isEditMode ? "Aufgabe aktualisiert" : "Aufgabe erstellt",
        description: isEditMode
          ? "Die Aufgabe wurde erfolgreich aktualisiert."
          : "Die Aufgabe wurde erfolgreich erstellt.",
      });

      onClose();
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Die Aufgabe konnte nicht gespeichert werden",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Aufgabe bearbeiten" : "Neue Aufgabe erstellen"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Bearbeiten Sie die Details der ausgewählten Aufgabe."
              : "Erstellen Sie eine neue Aufgabe mit den gewünschten Details."}
          </DialogDescription>
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
                    <Input placeholder="Aufgabentitel" {...field} />
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
                      placeholder="Beschreibung der Aufgabe..."
                      className="min-h-[100px]"
                      {...field}
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

            <Button type="submit" className="w-full">
              {isEditMode ? "Aufgabe aktualisieren" : "Aufgabe erstellen"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}