import { useAuth } from "@/lib/auth-store";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useStore } from "@/lib/store";
import { useLocation } from "wouter";
import { Plus, ChevronsRight } from "lucide-react";
import { CardTitle, CardDescription, CardContent, CardHeader, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  TableHead, 
  TableRow, 
  TableHeader, 
  TableCell, 
  TableBody, 
  Table 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getPriorityColor } from "@/lib/utils";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { useQuery } from "@tanstack/react-query";
import { Project, Board, Objective, Task } from "@/types/index";
import type { UserProductivityMetrics } from "@/types/index";

// Produktivitäts-Metriken-Komponente
interface ProductivityMetricsCardProps {
  userId: number;
}

function ProductivityMetricsCard({ userId }: ProductivityMetricsCardProps) {
  // API-Abfragen für alle benötigten Daten
  const { data: metrics, isLoading: metricsLoading } = useQuery<UserProductivityMetrics[]>({
    queryKey: [`/api/productivity/metrics/${userId}`, { days: 7 }],
    queryFn: async () => {
      if (!userId) return [];
      const res = await fetch(`/api/productivity/metrics/${userId}?days=7`);
      if (!res.ok) throw new Error("Fehler beim Laden der Produktivitätsdaten");
      return res.json();
    },
    enabled: !!userId
  });
  
  const { data: myTasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/user-tasks"],
    queryFn: async () => {
      const res = await fetch("/api/user-tasks");
      if (!res.ok) throw new Error("Fehler beim Laden der Aufgaben");
      return res.json();
    }
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json();
    }
  });

  const { data: objectives = [], isLoading: objectivesLoading } = useQuery<Objective[]>({
    queryKey: ['/api/objectives'],
    queryFn: async () => {
      const response = await fetch('/api/objectives');
      if (!response.ok) {
        throw new Error('Failed to fetch objectives');
      }
      return response.json();
    }
  });

  // Lade-Status
  if (metricsLoading || tasksLoading || projectsLoading || objectivesLoading) {
    return <div className="text-sm text-muted-foreground">Lade Produktivitätsdaten...</div>;
  }

  // Berechnungen für Fortschrittsbalken
  const completedTasks = myTasks.filter(task => task.status === "done").length;
  const taskProgress = myTasks.length > 0 ? Math.round((completedTasks / myTasks.length) * 100) : 0;
  
  const completedProjects = projects.filter(project => project.archived).length;
  const projectProgress = projects.length > 0 ? Math.round((completedProjects / projects.length) * 100) : 0;
  
  const completedObjectives = objectives.filter(obj => obj.progress === 100).length;
  const keyResultProgress = objectives.length > 0 ? Math.round((completedObjectives / objectives.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        {/* Projekt-Fortschritt */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="font-medium">Projekte</span>
            <span className="font-semibold">{projectProgress}%</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all" 
              style={{ width: `${projectProgress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
        
        {/* Task-Fortschritt */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="font-medium">Eigene Tasks</span>
            <span className="font-semibold">{taskProgress}%</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-green-500 transition-all" 
              style={{ width: `${taskProgress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
        
        {/* Key-Results-Fortschritt */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="font-medium">Key Results</span>
            <span className="font-semibold">{keyResultProgress}%</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-purple-500 transition-all" 
              style={{ width: `${keyResultProgress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
      </div>
      
      <div className="text-xs text-muted-foreground text-center">
        Aktueller Fortschritt in %
      </div>
    </div>
  );
}

// Dashboard-Tasks-Komponente
function DashboardTaskRows() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: myTasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["/api/user-tasks"],
    queryFn: async () => {
      const res = await fetch("/api/user-tasks");
      if (!res.ok) throw new Error("Fehler beim Laden der Aufgaben");
      return res.json();
    }
  });

  // Filtern auf ToDo, In Progress und In Review
  const activeTasks = myTasks
    .filter(task => ["todo", "in-progress", "in-review"].includes(task.status) && !task.archived)
    .slice(0, 5); // Begrenze auf 5 Einträge

  if (isLoading) {
    return (
      <TableRow>
        <TableCell colSpan={4} className="text-center py-4">Lade Aufgaben...</TableCell>
      </TableRow>
    );
  }

  if (activeTasks.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={4} className="text-center py-4">Keine aktiven Aufgaben gefunden</TableCell>
      </TableRow>
    );
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "todo": return "Zu erledigen";
      case "in-progress": return "In Bearbeitung";
      case "in-review": return "In Überprüfung";
      default: return status;
    }
  };

  return (
    <>
      {activeTasks.map((task) => (
        <TableRow 
          key={task.id} 
          className="hover:bg-slate-50 cursor-pointer"
          onClick={() => {
            // Wenn es eine boardId gibt, zum Board mit taskId navigieren, ansonsten zur persönlichen Aufgabenliste
            if (task.boardId) {
              setLocation(`/boards/${task.boardId}?taskId=${task.id}`);
            } else {
              setLocation(`/my-tasks?taskId=${task.id}`);
            }
          }}
        >
          <TableCell className="font-medium truncate max-w-[200px]">{task.title}</TableCell>
          <TableCell>
            <Badge variant="outline" className="bg-slate-100">{getStatusText(task.status)}</Badge>
          </TableCell>
          <TableCell>
            <Badge 
              variant="outline" 
              className={`${getPriorityColor(task.priority)}`}
            >
              {task.priority === "high" ? "Hoch" : task.priority === "medium" ? "Mittel" : "Niedrig"}
            </Badge>
          </TableCell>
          <TableCell>
            {task.dueDate ? format(new Date(task.dueDate), "dd.MM.yyyy", { locale: de }) : "-"}
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { setCurrentBoard, setCurrentProject } = useStore();

  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json();
    }
  });

  const { data: objectives = [], isLoading: objectivesLoading } = useQuery<Objective[]>({
    queryKey: ['/api/objectives'],
    queryFn: async () => {
      const response = await fetch('/api/objectives');
      if (!response.ok) {
        throw new Error('Failed to fetch objectives');
      }
      return response.json();
    }
  });

  const boardQueries = useQuery({
    queryKey: ["dashboard-boards"],
    queryFn: async () => {
      const allBoardsRes = await fetch('/api/boards');
      if (!allBoardsRes.ok) {
        throw new Error('Failed to fetch boards');
      }
      const allBoards = await allBoardsRes.json();

      return allBoards.map((board: Board) => {
        const project = projects?.find(p => p.id === board.project_id);
        return {
          ...board,
          projectTitle: project?.title || 'Kein Projekt'
        };
      });
    },
    enabled: true
  });

  if (projectsLoading || boardQueries.isLoading || objectivesLoading) {
    return (
      <div className="container mx-auto p-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Lädt...</p>
        </div>
      </div>
    );
  }

  const allBoards = boardQueries.data || [];
  const activeObjectives = objectives.filter(obj => obj.status === "active");
  const completedObjectives = objectives.filter(obj => obj.progress === 100);
  // Beziehe alle Objectives (aktive und abgeschlossene) in die Berechnung ein
  const averageProgress = objectives.length > 0
    ? Math.round(objectives.reduce((acc, obj) => acc + (obj.progress || 0), 0) / objectives.length)
    : 0;

  return (
    <div className="container mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Willkommen, {user?.username}!
          </h1>
          <p className="text-muted-foreground mt-2">Hier ist eine Übersicht Ihres Arbeitsbereichs</p>
        </div>
        <Button onClick={() => setLocation("/projects")} className="bg-white hover:bg-slate-50 text-slate-900 border border-slate-200">
          <Plus className="mr-2 h-4 w-4" />
          Neues Projekt
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Statistics Cards */}
        <div className="w-full lg:w-2/3">
          {/* Erste Zeile: Projekte, Boards und OKR Progress in einer Reihe */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <Card className="bg-white/80 backdrop-blur-sm hover:shadow-md transition-shadow">
              <CardHeader className="py-4">
                <CardTitle>Projekte</CardTitle>
                <CardDescription>Gesamtzahl Ihrer Projekte</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">{projects?.length || 0}</p>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm hover:shadow-md transition-shadow">
              <CardHeader className="py-4">
                <CardTitle>Boards</CardTitle>
                <CardDescription>Gesamtzahl Ihrer Boards</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">{allBoards.length}</p>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm hover:shadow-md transition-shadow">
              <CardHeader className="py-4">
                <CardTitle>OKR Progress</CardTitle>
                <CardDescription>Alle Objectives ({objectives.length})</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-2xl font-bold text-primary">{averageProgress}%</p>
                  <div className="text-sm text-muted-foreground">
                    Abgeschlossen: {completedObjectives.length}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Produktivitäts-Card in voller Breite */}
          <div className="mb-4">
            <Card className="bg-white/80 backdrop-blur-sm hover:shadow-md transition-shadow">
              <CardHeader className="py-4">
                <CardTitle>Produktivität</CardTitle>
                <CardDescription>Ihre Aktivitäten</CardDescription>
              </CardHeader>
              <CardContent>
                <ProductivityMetricsCard userId={user?.id || 0} />
              </CardContent>
            </Card>
          </div>
          
          {/* Aufgaben in "ToDo" und "In Progress" */}
          <Card className="bg-white/80 backdrop-blur-sm hover:shadow-md transition-shadow">
            <CardHeader className="py-4">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Meine aktuellen Aufgaben</CardTitle>
                  <CardDescription>Aufgaben in "ToDo", "In Progress" und "In Review"</CardDescription>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-primary"
                  onClick={() => setLocation("/my-tasks")}
                >
                  Alle ansehen <ChevronsRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Dashboard Tasks Table Component */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aufgabe</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priorität</TableHead>
                    <TableHead>Fälligkeit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Implementieren wir direkt die Logik hier */}
                  <DashboardTaskRows />
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Activity Feed Section */}
        <div className="w-full lg:w-1/3">
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
}