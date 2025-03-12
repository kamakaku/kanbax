import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type Task } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateTaskSchema } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CommentList } from "@/components/comments/comment-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/lib/store";
import { Clock, Edit2, MessageSquare } from "lucide-react";

interface TaskDialogProps {
  task?: Task;
  open: boolean;
  onClose: () => void;
  onUpdate?: (updatedTask: Task) => Promise<void>;
  onDelete?: (taskId: number) => Promise<void>;
  defaultTab?: string;
}

const statusLabels: Record<string, string> = {
  'backlog': 'Backlog',
  'todo': 'To Do',
  'in-progress': 'In Progress',
  'review': 'Review',
  'done': 'Done'
};

export function TaskDialog({ task, open, onClose, onUpdate, onDelete, defaultTab = "edit" }: TaskDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState(defaultTab);
  const { currentBoard } = useStore();

  // Query für Aktivitäten
  const { data: activities = [] } = useQuery({
    queryKey: [`/api/tasks/${task?.id}/activities`],
    queryFn: async () => {
      if (!task) return [];
      const res = await fetch(`/api/tasks/${task.id}/activities`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!task
  });

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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {task ? "Aufgabe bearbeiten" : "Neue Aufgabe erstellen"}
          </DialogTitle>
        </DialogHeader>

        {task ? (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="edit" className="flex items-center gap-2">
                <Edit2 className="h-4 w-4" />
                <span>Bearbeiten</span>
              </TabsTrigger>
              <TabsTrigger value="comments" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                <span>Kommentare</span>
              </TabsTrigger>
              <TabsTrigger value="activities" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Aktivitäten</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="edit">
              <EditForm
                form={form}
                onSubmit={handleSubmit}
                onDelete={handleDelete}
                task={task}
              />
            </TabsContent>

            <TabsContent value="comments" className="pt-4">
              <CommentList taskId={task.id} />
            </TabsContent>

            <TabsContent value="activities" className="pt-4">
              <div className="space-y-4">
                {activities.map((activity: any) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 text-sm text-muted-foreground"
                  >
                    <Clock className="h-4 w-4 mt-0.5" />
                    <div>
                      <p>{activity.description}</p>
                      <time className="text-xs">
                        {new Date(activity.createdAt).toLocaleString()}
                      </time>
                    </div>
                  </div>
                ))}
                {activities.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Keine Aktivitäten vorhanden
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <EditForm
            form={form}
            onSubmit={handleSubmit}
            task={task}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditForm({ form, onSubmit, onDelete, task }: any) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

        <div className="flex justify-between gap-2">
          {task && onDelete && (
            <Button 
              type="button" 
              variant="destructive"
              onClick={onDelete}
            >
              Löschen
            </Button>
          )}
          <Button type="submit" className={task ? "" : "w-full"}>
            {task ? "Speichern" : "Erstellen"}
          </Button>
        </div>
      </form>
    </Form>
  );
}