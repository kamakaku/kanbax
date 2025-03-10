import { useQuery } from "@tanstack/react-query";
import { type Project, type Board, type Task } from "@shared/schema";
import { useLocation } from "wouter";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { LayoutGrid, LayoutList, Calendar } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";

interface TaskWithDetails extends Task {
  boardTitle: string;
  projectTitle: string;
  boardId: number;
  projectId: number;
}

export default function AllTasks() {
  const [, setLocation] = useLocation();
  const { setCurrentBoard, setCurrentProject } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTask, setSelectedTask] = useState<TaskWithDetails | null>(null);

  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects");
      if (!res.ok) {
        throw new Error("Failed to fetch projects");
      }
      return res.json();
    },
  });

  const boardQueries = useQuery({
    queryKey: ["all-boards", projects?.map(p => p.id)],
    queryFn: async () => {
      if (!projects) return [];

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
    enabled: !!projects
  });

  const taskQueries = useQuery({
    queryKey: ["all-tasks", boardQueries.data?.map(b => b.id)],
    queryFn: async () => {
      if (!boardQueries.data) return [];

      const allTasks = await Promise.all(
        boardQueries.data.map(async (board) => {
          const res = await fetch(`/api/boards/${board.id}/tasks`);
          if (!res.ok) return [];
          const tasks = await res.json();
          return tasks.map((task: Task) => ({
            ...task,
            boardTitle: board.title,
            projectTitle: board.projectTitle,
            boardId: board.id,
            projectId: board.projectId
          }));
        })
      );

      return allTasks.flat();
    },
    enabled: !!boardQueries.data
  });

  const handleTaskClick = (task: TaskWithDetails) => {
    setSelectedTask(task);
  };

  if (projectsLoading || boardQueries.isLoading || taskQueries.isLoading) {
    return (
      <div className="container mx-auto p-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Lädt Aufgaben...</p>
        </div>
      </div>
    );
  }

  const allTasks = taskQueries.data || [];
  const filteredTasks = allTasks.filter(task => 
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

  const getTaskCard = (task: TaskWithDetails) => (
    <Card
      key={task.id}
      className={cn(
        "group hover:shadow-lg transition-all duration-300 cursor-pointer border-t-2",
        getPriorityStyle(task.priority)
      )}
      onClick={() => handleTaskClick(task)}
    >
      <CardHeader className="p-4 space-y-2">
        <div className="space-y-1">
          <CardTitle className="text-base line-clamp-1 group-hover:text-primary transition-colors">
            {task.title}
          </CardTitle>
          {task.description && (
            <CardDescription className="text-sm line-clamp-2">
              {task.description}
            </CardDescription>
          )}
        </div>

        <div className="flex flex-col gap-1 pt-2">
          <div className="text-[10px] text-muted-foreground">
            {task.projectTitle} • {task.boardTitle}
          </div>
          {task.dueDate && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{new Date(task.dueDate).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </CardHeader>
    </Card>
  );

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Alle Aufgaben
        </h1>
        <p className="text-muted-foreground mt-2">Übersicht aller Aufgaben aus allen Boards</p>
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
                  {filteredTasks
                    .filter(task => task.status === status)
                    .map((task) => getTaskCard(task))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="list" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredTasks.map((task) => getTaskCard(task))}
          </div>
        </TabsContent>
      </Tabs>

      <Drawer open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DrawerContent className="max-h-[90vh]">
          {selectedTask && (
            <>
              <DrawerHeader className="border-b pb-4">
                <DrawerTitle>{selectedTask.title}</DrawerTitle>
                <DrawerDescription>
                  <div className="space-y-2 mt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Projekt:</span>
                      <span className="text-sm text-muted-foreground">{selectedTask.projectTitle}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Board:</span>
                      <span className="text-sm text-muted-foreground">{selectedTask.boardTitle}</span>
                    </div>
                    {selectedTask.priority && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Priorität:</span>
                        <span className="text-sm text-muted-foreground">
                          {selectedTask.priority === 'high' ? 'Hoch' : selectedTask.priority === 'medium' ? 'Mittel' : 'Niedrig'}
                        </span>
                      </div>
                    )}
                    {selectedTask.dueDate && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Fällig:</span>
                        <span className="text-sm text-muted-foreground">
                          {new Date(selectedTask.dueDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </DrawerDescription>
              </DrawerHeader>
              <div className="p-4">
                {selectedTask.description && (
                  <div className="space-y-2">
                    <h3 className="font-medium">Beschreibung</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedTask.description}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}