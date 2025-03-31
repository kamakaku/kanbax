import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-store";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, ChevronsRight, CheckCircle, Clock } from "lucide-react";
import type { Project, Board, Objective, Task, UserProductivityMetrics } from "@shared/schema";
import { useStore } from "@/lib/store";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { 
  Table, 
  TableHeader, 
  TableRow, 
  TableHead, 
  TableBody, 
  TableCell 
} from "@/components/ui/table";
import { format, subDays } from "date-fns";
import { de } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { getPriorityColor } from "@/lib/utils";

import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

// Produktivitäts-Metriken-Komponente
interface ProductivityMetricsCardProps {
  userId: number;
}

function ProductivityMetricsCard({ userId }: ProductivityMetricsCardProps) {
  const { data: metrics, isLoading } = useQuery<UserProductivityMetrics[]>({
    queryKey: [`/api/productivity/metrics/${userId}`, { days: 7 }],
    queryFn: async () => {
      if (!userId) return [];
      const res = await fetch(`/api/productivity/metrics/${userId}?days=7`);
      if (!res.ok) throw new Error("Fehler beim Laden der Produktivitätsdaten");
      return res.json();
    },
    enabled: !!userId
  });

  if (isLoading || !metrics) {
    return <div className="text-sm text-muted-foreground">Lade Produktivitätsdaten...</div>;
  }

  // Daten für das Diagramm vorbereiten
  const chartData = metrics.map(day => ({
    date: format(new Date(day.date), 'dd.MM', { locale: de }),
    erledigt: day.tasksCompleted || 0,
    erstellt: day.tasksCreated || 0,
  }));

  // Gesamtwerte für die letzten 7 Tage berechnen
  const totalTasksCompleted = metrics.reduce((acc, day) => acc + (day.tasksCompleted || 0), 0);
  const totalTasksCreated = metrics.reduce((acc, day) => acc + (day.tasksCreated || 0), 0);
  
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <div>
            <span className="font-medium">{totalTasksCompleted}</span>
            <span className="text-xs text-muted-foreground ml-1">erledigt</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-blue-500" />
          <div>
            <span className="font-medium">{totalTasksCreated}</span>
            <span className="text-xs text-muted-foreground ml-1">erstellt</span>
          </div>
        </div>
      </div>
      
      <div className="h-[100px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              yAxisId="left"
              orientation="left"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => value.toString()}
              width={20}
            />
            <Tooltip 
              formatter={(value, name) => [value, name === "erledigt" ? "Erledigte Aufgaben" : "Erstellte Aufgaben"]}
              labelFormatter={(label) => `Datum: ${label}`}
            />
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="erledigt" 
              stroke="#10b981" 
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
              name="Erledigte"
            />
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="erstellt" 
              stroke="#3b82f6" 
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
              name="Erstellte"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      <div className="text-xs text-muted-foreground text-center">
        Erfasst für die letzten 7 Tage
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
        {/* Statistics Cards in 2x2 Grid */}
        <div className="w-full lg:w-2/3">
          <div className="grid grid-cols-2 gap-4 mb-8">
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