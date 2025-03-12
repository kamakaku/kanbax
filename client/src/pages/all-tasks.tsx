import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type Project, type Board, type Task } from "@shared/schema";
import { useLocation } from "wouter";
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { LayoutGrid, LayoutList, Calendar, Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { TaskDialog } from "@/components/board/task-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTaskSchema } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface TaskWithDetails extends Task {
  boardTitle: string;
  projectTitle: string;
  projectId: number;
}

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

  // Fetch all boards for all projects
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
  const { data: tasks = [] } = useQuery<TaskWithDetails[]>({
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

      // Invalidate queries to refresh the data
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

      // Invalidate queries to refresh the data
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

  const statusColumns = {
    'backlog': 'Backlog',
    'todo': 'To Do',
    'in-progress': 'In Progress',
    'review': 'Review',
    'done': 'Done'
  };

  // Group tasks by status
  const groupedTasks = Object.entries(statusColumns).reduce((acc, [status, label]) => {
    acc[status] = filteredTasks.filter(task => task.status === status);
    return acc;
  }, {} as Record<string, TaskWithDetails[]>);

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
                  {groupedTasks[status]?.map((task) => (
                    <Card
                      key={task.id}
                      className={cn(
                        "cursor-pointer hover:shadow-lg transition-all duration-300",
                        task.priority === 'high' && "border-t-2 border-t-red-500",
                        task.priority === 'medium' && "border-t-2 border-t-yellow-500",
                        task.priority === 'low' && "border-t-2 border-t-green-500"
                      )}
                      onClick={() => setSelectedTask(task)}
                    >
                      <CardHeader className="p-4">
                        <CardTitle className="text-base line-clamp-2">
                          {task.title}
                        </CardTitle>
                        {task.description && (
                          <CardDescription className="text-sm line-clamp-2">
                            {task.description}
                          </CardDescription>
                        )}
                        <div className="text-xs text-muted-foreground mt-2">
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
                  "cursor-pointer hover:shadow-lg transition-all duration-300",
                  task.priority === 'high' && "border-t-2 border-t-red-500",
                  task.priority === 'medium' && "border-t-2 border-t-yellow-500",
                  task.priority === 'low' && "border-t-2 border-t-green-500"
                )}
                onClick={() => setSelectedTask(task)}
              >
                <CardHeader className="p-4">
                  <CardTitle className="text-base line-clamp-2">
                    {task.title}
                  </CardTitle>
                  {task.description && (
                    <CardDescription className="text-sm line-clamp-2">
                      {task.description}
                    </CardDescription>
                  )}
                  <div className="text-xs text-muted-foreground mt-2">
                    {task.projectTitle} • {task.boardTitle}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neue Aufgabe erstellen</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(createTask.mutate)} className="space-y-4">
              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Projekt</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        setSelectedProjectId(parseInt(value));
                        field.onChange(parseInt(value));
                      }}
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
                        {Object.entries(statusColumns).map(([value, label]) => (
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