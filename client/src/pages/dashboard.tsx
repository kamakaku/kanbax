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
      try {
        console.log("Fetching objectives");
        const response = await fetch("/api/objectives");
        if (!response.ok) {
          const errorText = await response.text();
          console.error("Failed to fetch objectives:", errorText);
          return [];
        }
        const data = await response.json();
        console.log("Received objectives:", data);
        return data;
      } catch (error) {
        console.error("Error fetching objectives:", error);
        return [];
      }
    },
    enabled: !!user?.id,
  });

  const boardQueries = useQuery({
    queryKey: ["all-boards", projects?.map(p => p.id)],
    queryFn: async () => {
      if (!projects) return [];

      try {
        const allBoards = await Promise.all(
          projects.map(async (project) => {
            console.log(`Fetching boards for project ${project.id}`);
            const res = await fetch(`/api/projects/${project.id}/boards`);
            if (!res.ok) {
              console.error(`Failed to fetch boards for project ${project.id}:`, await res.text());
              return [];
            }
            const boards = await res.json();
            return boards.map((board: Board) => ({
              ...board,
              projectTitle: project.title,
              projectId: project.id
            }));
          })
        );

        return allBoards.flat();
      } catch (error) {
        console.error("Error fetching boards:", error);
        return [];
      }
    },
    enabled: !!projects
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

          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-none shadow-lg">
            <CardHeader className="py-4">
              <CardTitle>Boards</CardTitle>
              <CardDescription>Gesamtzahl Ihrer Boards</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">{allBoards.length}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-none shadow-lg">
            <CardHeader className="py-4">
              <CardTitle>OKR Progress</CardTitle>
              <CardDescription>Durchschnittlicher Fortschritt</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">{averageProgress}%</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-none shadow-lg">
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

        {/* OKR Section */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold">Aktuelle OKRs</h2>
            <Button variant="outline" onClick={() => setLocation("/okr")} size="sm">
              <Target className="mr-2 h-4 w-4" />
              Alle OKRs ansehen
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            {activeObjectives.slice(0, 4).map((objective) => (
              <Card
                key={objective.id}
                className="group hover:shadow-lg transition-all duration-300 cursor-pointer border border-primary/10 hover:border-primary/20"
                onClick={() => setLocation(`/okr/${objective.id}`)}
              >
                <CardHeader className="p-4">
                  <CardTitle className="text-base line-clamp-1 group-hover:text-primary transition-colors">
                    {objective.title}
                  </CardTitle>
                  <CardDescription className="text-sm mt-2">
                    <div className="flex items-center justify-between">
                      <span>Fortschritt</span>
                      <span className="font-medium">{objective.progress || 0}%</span>
                    </div>
                    <div className="w-full bg-primary/10 rounded-full h-2 mt-1">
                      <div
                        className="bg-primary rounded-full h-2 transition-all"
                        style={{ width: `${objective.progress || 0}%` }}
                      />
                    </div>
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold">Aktuelle Boards</h2>
            <Button variant="outline" onClick={() => setLocation("/boards")} size="sm">
              Alle Boards ansehen
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            {allBoards.map((board) => (
              <Card
                key={board.id}
                className="group hover:shadow-lg transition-all duration-300 cursor-pointer border border-primary/10 hover:border-primary/20 h-[120px]"
                onClick={() => handleBoardClick(board)}
              >
                <CardHeader className="p-4 space-y-2">
                  <CardTitle className="text-base line-clamp-1 group-hover:text-primary transition-colors">
                    {board.title}
                  </CardTitle>
                  <CardDescription className="text-sm space-y-1">
                    <div className="line-clamp-1">{board.description}</div>
                    <div className="text-xs text-primary/80">
                      {board.projectTitle}
                    </div>
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>

        {projects && projects.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold">Projekte</h2>
              <Button variant="outline" onClick={() => setLocation("/projects")} size="sm">
                Alle Projekte ansehen
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
              {projects.map((project) => (
                <Card
                  key={project.id}
                  className="group hover:shadow-lg transition-all duration-300 cursor-pointer border border-primary/10 hover:border-primary/20 h-[120px]"
                  onClick={() => setLocation(`/projects/${project.id}`)}
                >
                  <CardHeader className="p-4 space-y-2">
                    <CardTitle className="text-base line-clamp-1 group-hover:text-primary transition-colors">
                      {project.title}
                    </CardTitle>
                    <CardDescription className="text-sm space-y-1">
                      <div className="line-clamp-2">{project.description}</div>
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}