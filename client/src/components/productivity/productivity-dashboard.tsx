import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth-store";
import { format, subDays, startOfDay } from "date-fns";
import { de } from "date-fns/locale";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

export function ProductivityDashboard() {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState("7"); // days

  const { data: metrics = [], isLoading: isLoadingMetrics } = useQuery({
    queryKey: ["/api/productivity/metrics", user?.id, timeRange],
    queryFn: async () => {
      const response = await fetch(`/api/productivity/metrics/${user?.id}?days=${timeRange}`);
      if (!response.ok) {
        throw new Error("Failed to fetch productivity metrics");
      }
      return response.json();
    },
    enabled: !!user?.id,
  });

  const { data: taskDistribution = [], isLoading: isLoadingDistribution } = useQuery<{ name: string; value: number; }[]>({
    queryKey: ["/api/productivity/task-distribution", user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/productivity/task-distribution/${user?.id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch task distribution");
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!user?.id,
  });
  
  const { data: projectActivities = [], isLoading: isLoadingActivities } = useQuery<{ name: string; tasks: number; }[]>({
    queryKey: ["/api/productivity/project-activities", user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/productivity/project-activities/${user?.id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch project activities");
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!user?.id,
  });

  // Fetch OKR data
  const { data: objectives = [], isLoading: isLoadingObjectives } = useQuery({
    queryKey: ["/api/objectives"],
    queryFn: async () => {
      const response = await fetch("/api/objectives");
      if (!response.ok) {
        throw new Error("Failed to fetch objectives");
      }
      return response.json();
    },
    enabled: !!user?.id,
  });

  const activeObjectives = objectives.filter(obj => obj.progress !== undefined && !obj.archived);
  const completedObjectives = objectives.filter(obj => obj.progress !== undefined && obj.progress === 100);
  const averageProgress = activeObjectives.length > 0
    ? Math.round(activeObjectives.reduce((acc, obj) => acc + obj.progress, 0) / activeObjectives.length)
    : 0;

  if (isLoadingMetrics || isLoadingDistribution || isLoadingObjectives || isLoadingActivities) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-lg text-muted-foreground">Lade Produktivitätsdaten...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Produktivitäts-Dashboard</h2>
        <Select
          value={timeRange}
          onValueChange={(value) => setTimeRange(value)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Zeitraum wählen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Letzte 7 Tage</SelectItem>
            <SelectItem value="14">Letzte 14 Tage</SelectItem>
            <SelectItem value="30">Letzte 30 Tage</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Abgeschlossene Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.reduce((acc, m) => acc + m.tasksCompleted, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              In den letzten {timeRange} Tagen
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Objectives Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {averageProgress}%
            </div>
            <p className="text-xs text-muted-foreground">
              Durchschnittlicher Fortschritt
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Zeit investiert
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(metrics.reduce((acc, m) => acc + m.timeSpentMinutes, 0) / 60)}h
            </div>
            <p className="text-xs text-muted-foreground">
              In den letzten {timeRange} Tagen
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Erreichte Objectives
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {completedObjectives.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Von {activeObjectives.length} aktiven
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Produktivitätstrend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={metrics}
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date) => format(new Date(date), "dd.MM", { locale: de })}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(date) => format(new Date(date), "dd.MM.yyyy", { locale: de })}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="tasksCompleted"
                  name="Abgeschlossene Tasks"
                  stroke="#0088FE"
                  activeDot={{ r: 8 }}
                />
                <Line
                  type="monotone"
                  dataKey="objectivesAchieved"
                  name="Erreichte Objectives"
                  stroke="#FFBB28"
                  activeDot={{ r: 8 }}
                />
                <Line
                  type="monotone"
                  dataKey="timeSpentMinutes"
                  name="Zeit (Minuten)"
                  stroke="#00C49F"
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Task-Verteilung nach Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={taskDistribution}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {taskDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Projektaktivitäten</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={projectActivities}
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
                barSize={40}
              >
                <defs>
                  <pattern id="diagonalHatch" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
                    <rect width="10" height="10" fill="#f6f6f6" />
                    <line x1="0" y1="0" x2="0" y2="10" stroke="#e4e4e7" strokeWidth="1" />
                  </pattern>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip 
                  formatter={(value) => [`${value} Tasks`, 'Anzahl']}
                />
                <Legend />
                <Bar 
                  dataKey="tasks" 
                  name="Tasks pro Projekt" 
                  fill="url(#diagonalHatch)" 
                  stroke="#8884d8" 
                  strokeWidth={1}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}