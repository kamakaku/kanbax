import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-store";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import type { Board, Project } from "@shared/schema";
import { useStore } from "@/lib/store";

interface BoardWithProject extends Board {
  project: Project;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { setCurrentBoard, setCurrentProject } = useStore();

  const { data: boards, isLoading } = useQuery<BoardWithProject[]>({
    queryKey: ["/api/boards"],
    queryFn: async () => {
      const res = await fetch("/api/boards");
      if (!res.ok) {
        throw new Error("Failed to fetch boards");
      }
      return res.json();
    },
  });

  const handleBoardClick = (board: BoardWithProject) => {
    setCurrentBoard(board);
    setCurrentProject(board.project);
    setLocation("/board");
  };

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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Boards</CardTitle>
            <CardDescription>Gesamtzahl Ihrer Boards</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{boards?.length || 0}</p>
          </CardContent>
        </Card>

        {boards && boards.length > 0 ? (
          <div className="col-span-full">
            <h2 className="text-2xl font-bold mb-4">Ihre Boards</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {boards.map((board) => (
                <Card
                  key={board.id}
                  className="hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleBoardClick(board)}
                >
                  <CardHeader>
                    <CardTitle>{board.title}</CardTitle>
                    <CardDescription>
                      {board.description}
                      <div className="mt-2 text-sm text-muted-foreground">
                        Projekt: {board.project.title}
                      </div>
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <div className="col-span-full text-center py-12">
            <p className="text-muted-foreground">
              {isLoading
                ? "Lädt Boards..."
                : "Noch keine Boards vorhanden. Erstellen Sie ein Projekt, um loszulegen!"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}