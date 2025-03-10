import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-store";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import type { Project } from "@shared/schema";

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects");
      if (!res.ok) {
        throw new Error("Failed to fetch projects");
      }
      return res.json();
    },
  });

  return (
    <div className="container mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold">Willkommen, {user?.username}!</h1>
          <p className="text-muted-foreground mt-2">Hier ist eine Übersicht Ihres Arbeitsbereichs</p>
        </div>
        <Button onClick={() => setLocation("/projects")}>
          <Plus className="mr-2 h-4 w-4" />
          Neues Projekt
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Projekte</CardTitle>
            <CardDescription>Gesamtzahl Ihrer Projekte</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{projects?.length || 0}</p>
          </CardContent>
        </Card>

        {projects && projects.length > 0 ? (
          <div>
            <h2 className="text-2xl font-bold mb-4">Ihre Projekte und Boards</h2>
            <div className="space-y-8">
              {projects.map((project) => (
                <Card key={project.id} className="overflow-visible">
                  <CardHeader>
                    <CardTitle>
                      <Button
                        variant="link"
                        className="p-0 h-auto font-bold text-xl"
                        onClick={() => setLocation(`/projects/${project.id}`)}
                      >
                        {project.title}
                      </Button>
                    </CardTitle>
                    <CardDescription>{project.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <BoardList projectId={project.id} onBoardClick={() => setLocation("/board")} />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {isLoading
                ? "Lädt Projekte..."
                : "Noch keine Projekte vorhanden. Erstellen Sie ein Projekt, um loszulegen!"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function BoardList({ projectId, onBoardClick }: { projectId: number; onBoardClick: () => void }) {
  const { data: boards, isLoading } = useQuery({
    queryKey: [`/api/projects/${projectId}/boards`],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/boards`);
      if (!res.ok) {
        throw new Error("Failed to fetch boards");
      }
      return res.json();
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Lädt Boards...</p>;
  if (!boards?.length) return <p className="text-sm text-muted-foreground">Keine Boards vorhanden</p>;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {boards.map((board) => (
        <Card
          key={board.id}
          className="hover:bg-muted/50 transition-colors cursor-pointer"
          onClick={onBoardClick}
        >
          <CardHeader>
            <CardTitle className="text-base">{board.title}</CardTitle>
            {board.description && (
              <CardDescription className="text-sm">{board.description}</CardDescription>
            )}
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}