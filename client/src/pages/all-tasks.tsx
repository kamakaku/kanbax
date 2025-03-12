import { useEffect } from "react";
import { DragDropContext, type DropResult } from "react-beautiful-dnd";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type Project, type Board, type Task } from "@shared/schema";
import { Column as ColumnComponent } from "@/components/board/column";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { TaskDialog } from "@/components/board/task-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTaskSchema } from "@shared/schema";

interface TaskWithDetails extends Task {
  boardTitle: string;
  projectTitle: string;
  projectId: number;
}

const defaultColumns = [
  { id: "backlog", title: "backlog" },
  { id: "todo", title: "todo" },
  { id: "in-progress", title: "in-progress" },
  { id: "review", title: "review" },
  { id: "done", title: "done" }
];

const statusLabels = {
  'backlog': 'Backlog',
  'todo': 'To Do',
  'in-progress': 'In Progress',
  'review': 'Review',
  'done': 'Done'
};

export default function AllTasks() {
  const [, setLocation] = useLocation();
  const { setCurrentBoard, setCurrentProject } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTask, setSelectedTask] = useState<TaskWithDetails | null>(null);
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all projects
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Fetch all boards
  const { data: boards = [] } = useQuery<(Board & { projectTitle: string; projectId: number })[]>({
    queryKey: ["all-boards"],
    queryFn: async () => {
      const allBoards = await Promise.all(
        projects.map(async (project) => {
          const res = await fetch(`/api/projects/${project.id}/boards`);
          if (!res.ok) return [];
          const boards = await res.json();
          return boards.map((board: Board) => ({
            ...board,
            projectTitle: project.title,
            projectId: project.id
          }));
        })
      );
      return allBoards.flat();
    },
    enabled: projects.length > 0
  });

  // Fetch tasks from all boards
  const { data: tasks = [], isLoading: tasksLoading } = useQuery<TaskWithDetails[]>({
    queryKey: ["all-tasks"],
    queryFn: async () => {
      const allTasks = await Promise.all(
        boards.map(async (board) => {
          const res = await fetch(`/api/boards/${board.id}/tasks`);
          if (!res.ok) return [];
          const tasks = await res.json();
          return tasks.map((task: Task) => ({
            ...task,
            boardTitle: board.title,
            projectTitle: board.projectTitle,
            projectId: board.projectId
          }));
        })
      );
      return allTasks.flat();
    },
    enabled: boards.length > 0
  });

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;
    const taskId = parseInt(draggableId);

    // Get the task being moved
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Get all tasks in source column before the move
    const tasksInSourceColumn = tasks
      .filter(t => t.status === source.droppableId)
      .sort((a, b) => a.order - b.order);

    // Get all tasks in destination column before the move
    const tasksInDestColumn = tasks
      .filter(t => t.status === destination.droppableId)
      .sort((a, b) => a.order - b.order);

    // Remove task from source array
    tasksInSourceColumn.splice(source.index, 1);

    // Insert task at new position
    if (source.droppableId === destination.droppableId) {
      tasksInSourceColumn.splice(destination.index, 0, task);
    } else {
      tasksInDestColumn.splice(destination.index, 0, task);
    }

    try {
      // Prepare updates for all affected tasks
      const updates = [];

      // Update order for source column tasks
      if (source.droppableId === destination.droppableId) {
        updates.push(...tasksInSourceColumn.map((t, index) => ({
          id: t.id,
          order: index,
          status: t.status,
          boardId: t.boardId,
          columnId: t.columnId
        })));
      } else {
        // Update both columns
        updates.push(
          ...tasksInSourceColumn.map((t, index) => ({
            id: t.id,
            order: index,
            status: source.droppableId,
            boardId: t.boardId,
            columnId: t.columnId
          })),
          ...tasksInDestColumn.map((t, index) => ({
            id: t.id,
            order: index,
            status: destination.droppableId,
            boardId: t.boardId,
            columnId: t.columnId
          }))
        );
      }

      // Execute all updates
      await Promise.all(
        updates.map(update =>
          apiRequest("PATCH", `/api/tasks/${update.id}`, update)
        )
      );

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
      boards.forEach(board => {
        queryClient.invalidateQueries({
          queryKey: [`/api/boards/${board.id}/tasks`]
        });
      });

      toast({ title: "Aufgabenreihenfolge aktualisiert" });
    } catch (error) {
      console.error("Order update error:", error);
      toast({
        title: "Fehler",
        description: "Die Reihenfolge konnte nicht aktualisiert werden",
        variant: "destructive"
      });
    }
  };

  const handleTaskUpdate = async (updatedTask: Task) => {
    try {
      const res = await apiRequest(
        "PATCH",
        `/api/tasks/${updatedTask.id}`,
        updatedTask
      );

      if (!res.ok) {
        throw new Error("Failed to update task");
      }

      queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
      boards.forEach(board => {
        queryClient.invalidateQueries({
          queryKey: [`/api/boards/${board.id}/tasks`]
        });
      });

      toast({ title: "Aufgabe erfolgreich aktualisiert" });
    } catch (error) {
      console.error("Task update error:", error);
      toast({
        title: "Fehler beim Aktualisieren der Aufgabe",
        variant: "destructive"
      });
    }
  };

  const handleTaskDelete = async (taskId: number) => {
    try {
      const res = await apiRequest("DELETE", `/api/tasks/${taskId}`);
      if (!res.ok) {
        throw new Error("Failed to delete task");
      }

      queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
      boards.forEach(board => {
        queryClient.invalidateQueries({
          queryKey: [`/api/boards/${board.id}/tasks`]
        });
      });

      setSelectedTask(null);
      toast({ title: "Aufgabe erfolgreich gelöscht" });
    } catch (error) {
      console.error("Task delete error:", error);
      toast({
        title: "Fehler beim Löschen der Aufgabe",
        variant: "destructive"
      });
    }
  };

  const filteredTasks = tasks.filter(task =>
    task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.boardTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.projectTitle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const form = useForm({
    resolver: zodResolver(insertTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "todo",
      priority: "medium",
      labels: [],
      boardId: undefined,
      columnId: 0,
      order: 0,
      archived: false,
    },
  });

  const projectBoards = boards.filter(board => board.projectId === selectedProjectId);

  const createTask = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest(
        "POST",
        `/api/boards/${data.boardId}/tasks`,
        data
      );
      if (!res.ok) {
        throw new Error("Failed to create task");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-tasks"] });
      toast({ title: "Aufgabe erfolgreich erstellt" });
      form.reset();
      setShowNewTaskForm(false);
    },
    onError: (error) => {
      toast({
        title: "Fehler",
        description: "Die Aufgabe konnte nicht erstellt werden",
        variant: "destructive",
      });
    },
  });

  if (tasksLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Alle Aufgaben</h1>
        <Button onClick={() => setShowNewTaskForm(true)} className="bg-primary/10 hover:bg-primary/20">
          <Plus className="mr-2 h-4 w-4" />
          Neue Aufgabe
        </Button>
      </div>

      <div className="max-w-sm mb-6">
        <Label htmlFor="search">Suche</Label>
        <Input
          id="search"
          placeholder="Nach Aufgaben, Boards oder Projekten suchen..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-x-auto">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-6 pb-4">
            {defaultColumns.map((column) => (
              <ColumnComponent
                key={column.id}
                column={column}
                tasks={filteredTasks.filter(task => task.status === column.title)}
                isAllTasksView={true}
                onUpdate={handleTaskUpdate}
                onDelete={handleTaskDelete}
              />
            ))}
          </div>
        </DragDropContext>
      </div>

      {selectedTask && (
        <TaskDialog
          open={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          task={selectedTask}
          onUpdate={handleTaskUpdate}
          onDelete={handleTaskDelete}
        />
      )}

      <Dialog open={showNewTaskForm} onOpenChange={setShowNewTaskForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neue Aufgabe erstellen</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => createTask.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="boardId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Board</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
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
                      <Textarea {...field} />
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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

              <Button type="submit" disabled={createTask.isPending}>
                {createTask.isPending ? "Wird erstellt..." : "Aufgabe erstellen"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}