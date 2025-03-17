import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-store";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Target } from "lucide-react";
import type { Project, Board } from "@shared/schema";
import { useStore } from "@/lib/store";

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { setCurrentBoard, setCurrentProject } = useStore();

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

  const { data: objectives = [], isLoading: objectivesLoading } = useQuery({
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

  const handleBoardClick = (board: Board & { projectId: number, projectTitle: string }) => {
    const project = projects?.find(p => p.id === board.projectId);
    if (project) {
      setCurrentProject(project);
      setCurrentBoard(board);
      setLocation("/board");
    }
  };

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
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Willkommen, {user?.username}!
          </h1>
          <p className="text-muted-foreground mt-2">Hier ist eine Übersicht Ihres Arbeitsbereichs</p>
        </div>
        <Button onClick={() => setLocation("/projects")} className="bg-primary/10 hover:bg-primary/20">
          <Plus className="mr-2 h-4 w-4" />
          Neues Projekt
        </Button>
      </div>

      <div className="grid gap-8">
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-none shadow-lg">
            <CardHeader className="py-4">
              <CardTitle>Projekte</CardTitle>
              <CardDescription>Gesamtzahl Ihrer Projekte</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">{projects?.length || 0}</p>
            </CardContent>
          </Card>

          <Card 
            className="bg-gradient-to-br from-primary/5 to-primary/10 border-none shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
            onClick={() => setLocation("/boards")}
          >
            <CardHeader className="py-4">
              <CardTitle>Boards</CardTitle>
              <CardDescription>Gesamtzahl Ihrer Boards</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">{allBoards.length}</p>
            </CardContent>
          </Card>

          <Card 
            className="bg-gradient-to-br from-primary/5 to-primary/10 border-none shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
            onClick={() => setLocation("/okr")}
          >
            <CardHeader className="py-4">
              <CardTitle>OKR Progress</CardTitle>
              <CardDescription>Durchschnittlicher Fortschritt</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">{averageProgress}%</p>
            </CardContent>
          </Card>

          <Card 
            className="bg-gradient-to-br from-primary/5 to-primary/10 border-none shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
            onClick={() => setLocation("/okr")}
          >
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
    </div>
  );
}