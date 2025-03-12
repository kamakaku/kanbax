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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";

interface TaskDialogProps {
  task: Task & { boardTitle?: string; projectTitle?: string };
  open: boolean;
  onClose: () => void;
  onUpdate?: (updatedTask: Task) => Promise<void>;
  onDelete?: (taskId: number) => Promise<void>;
}

const statusLabels = {
  'backlog': 'Backlog',
  'todo': 'To Do',
  'in-progress': 'In Progress',
  'review': 'Review',
  'done': 'Done'
};

const priorityZones = [
  { id: "high", label: "Hoch", color: "bg-red-500" },
  { id: "medium", label: "Mittel", color: "bg-yellow-500" },
  { id: "low", label: "Niedrig", color: "bg-blue-500" }
];

export function TaskDialog({ task, open, onClose, onUpdate, onDelete }: TaskDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("details");

  const form = useForm({
    resolver: zodResolver(updateTaskSchema),
    defaultValues: {
      title: task.title,
      description: task.description || "",
      status: task.status,
      priority: task.priority,
      labels: task.labels || [],
      boardId: task.boardId,
      columnId: task.columnId,
      order: task.order,
    },
  });

  const handleUpdate = async (data: any) => {
    try {
      const res = await apiRequest(
        "PATCH",
        `/api/tasks/${task.id}`,
        data
      );

      if (!res.ok) {
        throw new Error("Failed to update task");
      }

      const updatedTask = await res.json();

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["all-tasks"] }),
        queryClient.invalidateQueries({ 
          queryKey: [`/api/boards/${task.boardId}/tasks`] 
        })
      ]);

      if (onUpdate) {
        await onUpdate(updatedTask);
      }

      toast({ title: "Aufgabe erfolgreich aktualisiert" });
      onClose();
    } catch (error) {
      console.error("Task update error:", error);
      toast({
        title: "Fehler",
        description: "Die Aufgabe konnte nicht aktualisiert werden",
        variant: "destructive",
      });
    }
  };

  const handlePriorityDrop = async (result: any) => {
    if (!result.destination) return;

    // Die destination.droppableId ist die neue Priorität
    const newPriority = result.destination.droppableId;

    try {
      // Nur die Priorität aktualisieren, andere Werte bleiben unverändert
      const res = await apiRequest("PATCH", `/api/tasks/${task.id}`, {
        priority: newPriority,
        status: task.status,
        boardId: task.boardId,
        columnId: task.columnId,
        order: task.order
      });

      if (!res.ok) {
        throw new Error("Failed to update task priority");
      }

      const updatedTask = await res.json();
      form.setValue("priority", newPriority);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["all-tasks"] }),
        queryClient.invalidateQueries({ 
          queryKey: [`/api/boards/${task.boardId}/tasks`] 
        })
      ]);

      if (onUpdate) {
        await onUpdate(updatedTask);
      }

      toast({ title: "Priorität erfolgreich aktualisiert" });
    } catch (error) {
      console.error("Priority update error:", error);
      toast({
        title: "Fehler",
        description: "Die Priorität konnte nicht aktualisiert werden",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;

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
          <DialogTitle>Aufgabe bearbeiten</DialogTitle>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="priority">Priorität</TabsTrigger>
            <TabsTrigger value="comments">Kommentare</TabsTrigger>
          </TabsList>
          <TabsContent value="details">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleUpdate)} className="space-y-4">
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
                  <Button 
                    type="button" 
                    variant="destructive"
                    onClick={handleDelete}
                  >
                    Löschen
                  </Button>
                  <Button type="submit">
                    Speichern
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
          <TabsContent value="priority" className="pt-4">
            <DragDropContext onDragEnd={handlePriorityDrop}>
              <div className="space-y-4">
                {/* Draggable current priority marker */}
                <Droppable droppableId="current-priority">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="mb-8"
                    >
                      <Draggable
                        draggableId="priority-marker"
                        index={0}
                      >
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className="p-3 rounded-lg border border-primary bg-primary/10 cursor-move"
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${
                                priorityZones.find(p => p.id === task.priority)?.color
                              }`} />
                              <span className="font-medium">Aktuelle Priorität</span>
                            </div>
                          </div>
                        )}
                      </Draggable>
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>

                {/* Priority drop zones */}
                {priorityZones.map((zone) => (
                  <Droppable key={zone.id} droppableId={zone.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`p-4 rounded-lg border-2 ${
                          snapshot.isDraggingOver 
                            ? "border-primary bg-primary/5" 
                            : "border-dashed border-muted"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${zone.color}`} />
                          <span className="font-medium">{zone.label}</span>
                        </div>
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                ))}
              </div>
            </DragDropContext>
          </TabsContent>
          <TabsContent value="comments" className="pt-4">
            <CommentList taskId={task.id} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}