import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTaskSchema, type InsertTask, type Project, type Board } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface TaskFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  projects: Project[];
  boards: Board[];
  existingTask?: InsertTask;
}

export function TaskForm({ open, onClose, onSubmit, projects, boards, existingTask }: TaskFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    existingTask?.projectId || null
  );

  const projectBoards = boards.filter(board => board.projectId === selectedProjectId);

  const form = useForm<InsertTask>({
    resolver: zodResolver(insertTaskSchema),
    defaultValues: existingTask || {
      title: "",
      description: "",
      status: "todo",
      order: 0,
      priority: "medium",
      labels: [],
      columnId: 0, // Default columnId
      archived: false
    },
  });

  const createTask = useMutation({
    mutationFn: async (data: InsertTask) => {
      const res = await apiRequest(
        existingTask ? "PATCH" : "POST",
        `/api/boards/${data.boardId}/tasks${existingTask ? `/${existingTask.id}` : ''}`,
        {
          ...data,
          columnId: data.columnId || 0, // Ensure columnId is set
          order: data.order || 0,
          archived: false
        }
      );

      if (!res.ok) {
        throw new Error("Failed to create task");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
      boards.forEach(board => {
        queryClient.invalidateQueries({ 
          queryKey: [`/api/boards/${board.id}/tasks`] 
        });
      });
      toast({ 
        title: existingTask 
          ? "Aufgabe erfolgreich aktualisiert" 
          : "Aufgabe erfolgreich erstellt" 
      });
      form.reset();
      onSubmit();
    },
    onError: (error) => {
      console.error("Task creation error:", error);
      toast({
        title: "Fehler",
        description: existingTask 
          ? "Die Aufgabe konnte nicht aktualisiert werden"
          : "Die Aufgabe konnte nicht erstellt werden",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (data: InsertTask) => {
    try {
      await createTask.mutateAsync(data);
    } catch (error) {
      console.error("Task creation error:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {existingTask ? "Aufgabe bearbeiten" : "Neue Aufgabe erstellen"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField 
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Projekt</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      const projectId = parseInt(value);
                      setSelectedProjectId(projectId);
                      field.onChange(projectId);
                      // Reset board selection when project changes
                      form.setValue("boardId", undefined as any);
                    }}
                    defaultValue={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Wählen Sie ein Projekt" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id.toString()}>
                          {project.title}
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
              name="boardId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Board</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    defaultValue={field.value?.toString()}
                    disabled={!selectedProjectId}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Wählen Sie ein Board" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {projectBoards.map((board) => (
                        <SelectItem key={board.id} value={board.id.toString()}>
                          {board.title}
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
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titel</FormLabel>
                  <FormControl>
                    <Input placeholder="Neue Aufgabe" {...field} />
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
                      placeholder="Beschreiben Sie die Aufgabe..."
                      value={field.value || ""}
                      onChange={field.onChange}
                    />
                  </FormControl>
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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

            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fälligkeitsdatum</FormLabel>
                  <FormControl>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={`w-full justify-start text-left font-normal ${
                            !field.value && "text-muted-foreground"
                          }`}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? (
                            format(new Date(field.value), "PPP")
                          ) : (
                            <span>Datum auswählen</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(field.value) : undefined}
                          onSelect={(date) =>
                            field.onChange(date?.toISOString())
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full">
              {existingTask ? "Aufgabe aktualisieren" : "Aufgabe erstellen"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}