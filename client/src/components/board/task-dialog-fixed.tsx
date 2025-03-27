import React, { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { type Task, type UpdateTask } from "@shared/schema";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/lib/store";
import { getErrorMessage } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CalendarIcon, PlusCircle, X, Tag, Pencil, User as UserIcon, Upload, ImageIcon, FileIcon, FileText, Paperclip, Archive, RotateCcw } from "lucide-react";
import { CommentList } from "@/components/comments/comment-list";
import { CommentEditor } from "@/components/comments/comment-editor";
import classnames from 'classnames';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
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
import { format, startOfDay, endOfDay } from "date-fns";
import { de } from "date-fns/locale";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";

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
  mode = task ? "details" : "edit",
  initialColumnId,
  personalTask = false,
  isPersonalTask = personalTask,
}: TaskDialogProps) {
  const [isEditMode, setIsEditMode] = useState(mode === "edit");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [attachments, setAttachments] = useState<string[]>(task?.attachments || []);

  // Form schema for task validation
  const formSchema = z.object({
    title: z.string().min(1, { message: "Titel ist erforderlich" }),
    description: z.string().optional(),
    richDescription: z.string().optional().nullable(),
    status: z.string().optional(),
    priority: z.string().optional(),
    dueDate: z.date().optional().nullable(),
    assignedUserIds: z.array(z.number()).optional(),
    assignedTeamId: z.number().optional().nullable(),
    labels: z.array(z.string()).optional(),
    checklist: z.array(z.string()).optional(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: task?.title || "",
      description: task?.description || "",
      richDescription: task?.richDescription || null,
      status: task?.status || "todo",
      priority: task?.priority || "medium",
      dueDate: task?.dueDate ? new Date(task.dueDate) : null,
      assignedUserIds: task?.assignedUserIds || [],
      assignedTeamId: task?.assignedTeamId || null,
      labels: task?.labels || [],
      checklist: task?.checklist || [],
    },
  });

  // Laden der verfügbaren Benutzer
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
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
            queryKey === "/api/users" ||
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
        : "/api/boards/{boardId}/tasks".replace("{boardId}", String(newTask.boardId || ""));

      const response = await apiRequest<any>("POST", endpoint, newTask);
      
      if (!response.ok) {
        throw new Error("Fehler beim Erstellen des Tasks");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
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
      // Füge boardId und columnId hinzu, wenn es ein neuer Task ist
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

  // Rendere den Dialog
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-6">
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