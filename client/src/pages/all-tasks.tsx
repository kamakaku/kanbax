import { useQuery } from "@tanstack/react-query";
import { type Task, type Project, type Board } from "@shared/schema";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList } from "@/components/ui/breadcrumb";
import { ChevronRight } from "lucide-react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

export default function AllTasks() {
  const [, setLocation] = useLocation();
  const { setCurrentTask } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

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

  const tasksQuery = useQuery({
    queryKey: ["all-tasks", projects?.map(p => p.id)],
    queryFn: async () => {
      if (!projects) return [];

      const allTasks = await Promise.all(
        projects.map(async (project) => {
          const boardsRes = await fetch(`/api/projects/${project.id}/boards`);
          if (!boardsRes.ok) return [];
          const boards = await boardsRes.json();

          const boardTasks = await Promise.all(
            boards.map(async (board: Board) => {
              const tasksRes = await fetch(`/api/boards/${board.id}/tasks`);
              if (!tasksRes.ok) return [];
              const tasks = await tasksRes.json();
              return tasks.map((task: Task) => ({
                ...task,
                boardTitle: board.title,
                projectTitle: project.title,
                projectId: project.id,
                boardId: board.id
              }));
            })
          );

          return boardTasks.flat();
        })
      );

      return allTasks.flat();
    },
    enabled: !!projects,
  });

  if (projectsLoading || tasksQuery.isLoading) {
    return (
      <div className="container mx-auto p-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Lädt...</p>
        </div>
      </div>
    );
  }

  const allTasks = tasksQuery.data || [];

  const handleTaskClick = (task: Task & { projectId: number, boardId: number }) => {
    setCurrentTask(task);
    setLocation(`/board/${task.boardId}/task/${task.id}`);
  };

  // Filter tasks
  const filteredTasks = allTasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        task.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink onClick={() => setLocation("/dashboard")}>Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbLink>Alle Aufgaben</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="text-3xl font-bold mt-4">Alle Aufgaben</h1>
      </div>

      <div className="flex flex-col gap-6 mb-8">
        <div className="flex flex-wrap gap-4">
          <div className="w-full md:w-1/3">
            <Label htmlFor="search">Suche</Label>
            <Input 
              id="search"
              placeholder="Nach Aufgaben suchen..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-full md:w-1/3">
            <Label htmlFor="status">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger id="status">
                <SelectValue placeholder="Status auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="BACKLOG">Backlog</SelectItem>
                <SelectItem value="TODO">Zu erledigen</SelectItem>
                <SelectItem value="IN_PROGRESS">In Bearbeitung</SelectItem>
                <SelectItem value="DONE">Erledigt</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full md:w-1/3">
            <Label htmlFor="priority">Priorität</Label>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger id="priority">
                <SelectValue placeholder="Priorität auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Prioritäten</SelectItem>
                <SelectItem value="LOW">Niedrig</SelectItem>
                <SelectItem value="MEDIUM">Mittel</SelectItem>
                <SelectItem value="HIGH">Hoch</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <p className="text-muted-foreground">Keine Aufgaben gefunden.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTasks.map((task) => (
            <Card key={task.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleTaskClick(task)}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{task.title}</CardTitle>
                  <Badge 
                    className={
                      task.priority === 'HIGH' ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' :
                      task.priority === 'MEDIUM' ? 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20' :
                      'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20'
                    }
                  >
                    {task.priority === 'HIGH' ? 'Hoch' : task.priority === 'MEDIUM' ? 'Mittel' : 'Niedrig'}
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  {task.projectTitle} &gt; {task.boardTitle}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm truncate">{task.description || 'Keine Beschreibung'}</p>
              </CardContent>
              <CardFooter className="pt-0">
                <Badge variant="outline" className="mr-2">
                  {task.status === 'BACKLOG' ? 'Backlog' : 
                   task.status === 'TODO' ? 'Zu erledigen' : 
                   task.status === 'IN_PROGRESS' ? 'In Bearbeitung' : 'Erledigt'}
                </Badge>
                {task.dueDate && (
                  <Badge variant="outline" className="ml-auto">
                    Fällig: {new Date(task.dueDate).toLocaleDateString()}
                  </Badge>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}