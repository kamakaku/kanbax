import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTaskSchema, type InsertTask, type Task, type UpdateTask } from "@shared/schema";
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
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useStore } from "@/lib/store";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface TaskFormProps {
  open: boolean;
  onClose: () => void;
  status?: "backlog" | "todo" | "in-progress" | "done";
  existingTask?: Task;
}

export function TaskForm({ open, onClose, status, existingTask }: TaskFormProps) {
  const { toast } = useToast();
  const { currentBoard } = useStore();
  const queryClient = useQueryClient();

  const form = useForm<InsertTask>({
    resolver: zodResolver(insertTaskSchema),
    defaultValues: {
      title: existingTask?.title || "",
      description: existingTask?.description || "",
      status: existingTask?.status || status || "todo",
      order: existingTask?.order || 0,
      boardId: existingTask?.boardId || currentBoard?.id || 0,
      columnId: existingTask?.columnId || 0,
      priority: existingTask?.priority || "medium",
      labels: existingTask?.labels || [],
      dueDate: existingTask?.dueDate || null,
      archived: existingTask?.archived || false,
      assignedUserId: existingTask?.assignedUserId || null,
      assignedTeamId: existingTask?.assignedTeamId || null,
    },
  });

  const updateTask = useMutation({
    mutationFn: async (data: UpdateTask) => {
      const res = await apiRequest(
        "PATCH",
        `/api/tasks/${existingTask?.id}`,
        data
      );
      if (!res.ok) {
        const error = await res.text();
        throw new Error(`Failed to update task: ${error}`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards", currentBoard?.id, "tasks"] });
      toast({ title: "Task updated successfully" });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Failed to update task",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createTask = useMutation({
    mutationFn: async (data: InsertTask) => {
      const res = await apiRequest(
        "POST",
        `/api/boards/${currentBoard?.id}/tasks`,
        data
      );
      if (!res.ok) {
        const error = await res.text();
        throw new Error(`Failed to create task: ${error}`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards", currentBoard?.id, "tasks"] });
      toast({ title: "Task created successfully" });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Failed to create task",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (data: InsertTask) => {
    try {
      if (existingTask) {
        await updateTask.mutateAsync(data);
      } else {
        await createTask.mutateAsync({
          ...data,
          boardId: currentBoard?.id || 0,
          status: status || "todo",
        });
      }
      form.reset();
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existingTask ? "Edit Task" : "Add New Task"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 mt-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
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
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
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
                  <FormLabel>Priority</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
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
                  <FormLabel>Labels (comma-separated)</FormLabel>
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
                  <FormLabel>Due Date</FormLabel>
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
                            <span>Pick a date</span>
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
              {existingTask ? "Save Changes" : "Create Task"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}