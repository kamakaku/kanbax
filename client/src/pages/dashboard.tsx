import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-store";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import type { Project, Board, Objective } from "@shared/schema";
import { useStore } from "@/lib/store";
import { ActivityFeed } from "@/components/activity/activity-feed";

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
        const project = projects?.find(p => p.id === board.projectId);
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
  const activeObjectives = objectives.filter(obj => !obj.archived);
  const completedObjectives = objectives.filter(obj => obj.progress === 100);
  const averageProgress = activeObjectives.length > 0
    ? Math.round(activeObjectives.reduce((acc, obj) => acc + (obj.progress || 0), 0) / activeObjectives.length)
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
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-white/80 backdrop-blur-sm hover:shadow-md transition-shadow">
              <CardHeader className="py-4">
                <CardTitle>Projekte</CardTitle>
                <CardDescription>Gesamtzahl Ihrer Projekte</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">{projects?.length || 0}</p>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm hover:shadow-md transition-shadow">
              <CardHeader className="py-4">
                <CardTitle>Boards</CardTitle>
                <CardDescription>Gesamtzahl Ihrer Boards</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">{allBoards.length}</p>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm hover:shadow-md transition-shadow">
              <CardHeader className="py-4">
                <CardTitle>OKR Progress</CardTitle>
                <CardDescription>Durchschnittlicher Fortschritt</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">{averageProgress}%</p>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm hover:shadow-md transition-shadow">
              <CardHeader className="py-4">
                <CardTitle>Erreichte OKRs</CardTitle>
                <CardDescription>Abgeschlossene Objectives</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">
                  {completedObjectives.length}/{activeObjectives.length}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Activity Feed Section */}
        <div className="w-full lg:w-1/3">
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
}