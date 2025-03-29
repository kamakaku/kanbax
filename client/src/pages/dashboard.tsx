
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-store";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import type { Project, Board, Objective } from "@shared/schema";
import { useStore } from "@/lib/store";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { ProductivityDashboard } from "@/components/productivity/productivity-dashboard";

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { setCurrentBoard, setCurrentProject } = useStore();

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
      if (!response.ok) throw new Error('Failed to fetch objectives');
      return response.json();
    }
  });

  const boardQueries = useQuery({
    queryKey: ["dashboard-boards"],
    queryFn: async () => {
      const allBoardsRes = await fetch('/api/boards');
      if (!allBoardsRes.ok) throw new Error('Failed to fetch boards');
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
  const averageProgress = activeObjectives.length > 0
    ? Math.round(activeObjectives.reduce((acc, obj) => acc + (obj.progress || 0), 0) / activeObjectives.length)
    : 0;

  return (
    <div className="container mx-auto p-8 space-y-8">
      {/* Erste Zeile: Überblick */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white/80 backdrop-blur-sm hover:shadow-md transition-shadow">
          <CardHeader className="py-4">
            <CardTitle>Projekte</CardTitle>
            <CardDescription>Aktive Projekte</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{projects.length}</p>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm hover:shadow-md transition-shadow">
          <CardHeader className="py-4">
            <CardTitle>Boards</CardTitle>
            <CardDescription>Aktive Boards</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{allBoards.length}</p>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm hover:shadow-md transition-shadow">
          <CardHeader className="py-4">
            <CardTitle>OKR Status</CardTitle>
            <CardDescription>Fortschritt & Ziele</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-2xl font-bold text-primary">{completedObjectives.length}/{activeObjectives.length}</p>
              <p className="text-sm text-muted-foreground">Durchschnittlicher Fortschritt: {averageProgress}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Aktivitäten (1/4) */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Aktivitäten</CardTitle>
              <CardDescription>Letzte Änderungen</CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityFeed limit={10} />
            </CardContent>
          </Card>
        </div>

        {/* Statistiken und Diagramme (3/4) */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Produktivitäts-Übersicht</CardTitle>
              <CardDescription>Statistiken und Trends</CardDescription>
            </CardHeader>
            <CardContent>
              <ProductivityDashboard />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
