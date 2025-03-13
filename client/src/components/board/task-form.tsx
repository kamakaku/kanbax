import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTaskSchema, type InsertTask, type Project, type Board, type Task, type User } from "@shared/schema";
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
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TaskFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (task: Task) => Promise<void>;
  projects: Project[];
  boards: Board[];
  existingTask?: Task;
}

export function TaskForm({ open, onClose, onSubmit, projects, boards, existingTask }: TaskFormProps) {
  const form = useForm<InsertTask>({
    resolver: zodResolver(insertTaskSchema),
    defaultValues: {
      title: existingTask?.title || "",
      description: existingTask?.description || "",
      status: existingTask?.status || "todo",
      boardId: existingTask?.boardId,
      priority: existingTask?.priority || "medium",
      labels: existingTask?.labels || [],
      columnId: existingTask?.columnId || 0,
      order: existingTask?.order || 0,
      archived: existingTask?.archived || false,
      assignedUserIds: existingTask?.assignedUserIds || [],
      checklist: existingTask?.checklist || [],
      dueDate: existingTask?.dueDate ? new Date(existingTask.dueDate) : undefined,
    },
  });

  // Fetch users for assignment
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: open
  });

  const handleSubmit = async (data: InsertTask) => {
    try {
      if (!data.boardId || !data.title) {
        return;
      }

      const taskData: Task = {
        id: existingTask?.id || 0,
        title: data.title,
        description: data.description || null,
        status: data.status as "backlog" | "todo" | "in-progress" | "review" | "done",
        order: existingTask?.order || 0,
        boardId: existingTask?.boardId || data.boardId,
        columnId: existingTask?.columnId || 0,
        priority: data.priority as "low" | "medium" | "high",
        labels: data.labels || [],
        dueDate: data.dueDate?.toISOString() || null,
        archived: existingTask?.archived || false,
        assignedUserIds: data.assignedUserIds || [],
        assignedTeamId: null,
        assignedAt: null,
        checklist: data.checklist || [],
      };

      await onSubmit(taskData);
      onClose();
    } catch (error) {
      console.error("Form submission error:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existingTask ? "Aufgabe bearbeiten" : "Neue Aufgabe erstellen"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="boardId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Board</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    defaultValue={field.value?.toString()}
                    disabled={!!existingTask}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Wählen Sie ein Board" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {boards.map((board) => (
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
                      placeholder="Beschreiben Sie die Aufgabe..."
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
              name="assignedUserIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Zugewiesene Benutzer</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {users.map((user) => (
                      <Button
                        key={user.id}
                        type="button"
                        variant={field.value?.includes(user.id) ? "default" : "outline"}
                        className="flex items-center gap-2"
                        onClick={() => {
                          const currentValue = field.value || [];
                          field.onChange(
                            currentValue.includes(user.id)
                              ? currentValue.filter(id => id !== user.id)
                              : [...currentValue, user.id]
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