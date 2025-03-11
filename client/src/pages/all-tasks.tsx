import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type Project, type Board, type Task } from "@shared/schema";
import { useLocation } from "wouter";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { LayoutGrid, LayoutList, Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { TaskDialog } from "@/components/board/task-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTaskSchema, type InsertTask } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface TaskWithDetails extends Task {
  boardTitle: string;
  projectTitle: string;
  projectId: number;
}

const statusColumns = {
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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertTask>({
    resolver: zodResolver(insertTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "todo",
      priority: "medium",
      labels: [],
      order: 0,
      columnId: 0,
      archived: false,
      boardId: 0,
      projectId: 0,
    },
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<TaskWithDetails[]>({
    queryKey: ["all-tasks"],
    queryFn: async () => {
      const projectsRes = await fetch("/api/projects");
      if (!projectsRes.ok) throw new Error("Failed to fetch projects");
      const projects = await projectsRes.json();

      const allTasks = await Promise.all(
        projects.map(async (project: Project) => {
          const boardsRes = await fetch(`/api/projects/${project.id}/boards`);
          if (!boardsRes.ok) return [];
          const boards = await boardsRes.json();

          const tasksPromises = boards.map(async (board: Board) => {
            const tasksRes = await fetch(`/api/boards/${board.id}/tasks`);
            if (!tasksRes.ok) return [];
            const tasks = await tasksRes.json();
            return tasks.map((task: Task) => ({
              ...task,
              boardTitle: board.title,
              projectTitle: project.title,
              projectId: project.id
            }));
          });

          return (await Promise.all(tasksPromises)).flat();
        })
      );

      return allTasks.flat();
    }
  });

  const filteredTasks = (tasks || []).filter(task =>
    task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.boardTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.projectTitle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const tasksByStatus = Object.keys(statusColumns).reduce((acc, status) => {
    acc[status] = filteredTasks.filter(task => task.status === status);
    return acc;
  }, {} as Record<string, TaskWithDetails[]>);

  const getPriorityStyle = (priority?: string) => {
    switch (priority) {
      case 'high':
        return 'border-t-red-500';
      case 'medium':
        return 'border-t-yellow-500';
      case 'low':
        return 'border-t-green-500';
      default:
        return 'border-t-transparent';
    }
  };

  const createTask = useMutation({
    mutationFn: async (data: InsertTask) => {
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
      console.error("Task creation error:", error);
      toast({
        title: "Fehler",
        description: "Die Aufgabe konnte nicht erstellt werden",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (data: InsertTask) => {
    try {
      if (!data.boardId || !data.title) {
        toast({
          title: "Fehlende Angaben",
          description: "Bitte wählen Sie ein Board aus und geben Sie einen Titel ein",
          variant: "destructive",
        });
        return;
      }

      await createTask.mutateAsync(data);
    } catch (error) {
      console.error("Task creation error:", error);
      toast({
        title: "Fehler",
        description: "Die Aufgabe konnte nicht erstellt werden",
        variant: "destructive",
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

  if (tasksLoading) {
    return (
      <div className="container mx-auto p-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Lädt...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Alle Aufgaben
          </h1>
          <p className="text-muted-foreground mt-2">Übersicht aller Aufgaben aus allen Boards</p>
        </div>
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

      <Tabs defaultValue="kanban" className="mt-6">
        <TabsList>
          <TabsTrigger value="kanban">
            <LayoutGrid className="h-4 w-4 mr-2" />
            Kanban
          </TabsTrigger>
          <TabsTrigger value="list">
            <LayoutList className="h-4 w-4 mr-2" />
            Liste
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="mt-6">
          <div className="grid grid-cols-5 gap-4">
            {Object.entries(statusColumns).map(([status, title]) => (
              <div key={status} className="bg-muted/50 rounded-lg p-4">
                <h3 className="font-semibold mb-4">{title}</h3>
                <div className="space-y-4">
                  {tasksByStatus[status]?.map((task) => (
                    <Card
                      key={task.id}
                      className={cn(
                        "group hover:shadow-lg transition-all duration-300 cursor-pointer border-t-2",
                        getPriorityStyle(task.priority)
                      )}
                      onClick={() => setSelectedTask(task)}
                    >
                      <CardHeader className="p-4 space-y-2">
                        <CardTitle className="text-base line-clamp-1 group-hover:text-primary transition-colors">
                          {task.title}
                        </CardTitle>
                        {task.description && (
                          <CardDescription className="text-sm line-clamp-2">
                            {task.description}
                          </CardDescription>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {task.projectTitle} • {task.boardTitle}
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="list" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredTasks.map((task) => (
              <Card
                key={task.id}
                className={cn(
                  "group hover:shadow-lg transition-all duration-300 cursor-pointer border-t-2",
                  getPriorityStyle(task.priority)
                )}
                onClick={() => setSelectedTask(task)}
              >
                <CardHeader className="p-4 space-y-2">
                  <CardTitle className="text-base line-clamp-1 group-hover:text-primary transition-colors">
                    {task.title}
                  </CardTitle>
                  {task.description && (
                    <CardDescription className="text-sm line-clamp-2">
                      {task.description}
                    </CardDescription>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {task.projectTitle} • {task.boardTitle}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                      {statusColumns[task.status as keyof typeof statusColumns]}
                    </span>
                    {task.labels?.map((label, index) => (
                      <span
                        key={index}
                        className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

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
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Neue Aufgabe erstellen</DialogTitle>
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
                        field.onChange(projectId);
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
                        {[...new Set(tasks.map(task => task.projectId))].map((projectId) => {
                          const task = tasks.find(t => t.projectId === projectId);
                          return (
                            <SelectItem key={projectId} value={projectId.toString()}>
                              {task?.projectTitle}
                            </SelectItem>
                          );
                        })}
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
                      disabled={!form.watch("projectId")}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Wählen Sie ein Board" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[...new Set(tasks
                          .filter(task => task.projectId === form.watch("projectId"))
                          .map(task => ({ id: task.boardId, title: task.boardTitle })))
                        ].map((board) => (
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

              <Button type="submit" className="w-full">
                Aufgabe erstellen
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}