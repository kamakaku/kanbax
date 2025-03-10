import { useQuery } from "@tanstack/react-query";
import { type Project, type Board } from "@shared/schema";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore } from "@/lib/store";

export default function AllBoards() {
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

  const boardQueries = useQuery({
    queryKey: ["all-boards", projects?.map(p => p.id)],
    queryFn: async () => {
      if (!projects) return [];

      const allBoards = await Promise.all(
        projects.map(async (project) => {
          const res = await fetch(`/api/projects/${project.id}/boards`);
          if (!res.ok) return [];
          const boards = await res.json();
          return boards.map((board: Board) => ({
            ...board,
            projectTitle: project.title
          }));
        })
      );

      return allBoards.flat();
    },
    enabled: !!projects
  });

  const handleBoardClick = (board: Board, projectId: number) => {
    const project = projects?.find(p => p.id === projectId);
    if (project) {
      setCurrentProject(project);
      setCurrentBoard(board);
      setLocation("/board");
    }
  };

  if (projectsLoading || boardQueries.isLoading) {
    return (
      <div className="container mx-auto p-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Lädt Boards...</p>
        </div>
      </div>
    );
  }

  const allBoards = boardQueries.data || [];

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">Alle Boards</h1>
        <p className="text-muted-foreground mt-2">Übersicht aller verfügbaren Boards</p>
      </div>

      {allBoards.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Keine Boards vorhanden</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          {allBoards.map((board) => (
            <Card
              key={board.id}
              className="hover:bg-muted/50 transition-colors cursor-pointer h-[140px]"
              onClick={() => handleBoardClick(board, board.projectId)}
            >
              <CardHeader className="p-4">
                <CardTitle className="text-base line-clamp-1">{board.title}</CardTitle>
                <CardDescription className="text-sm line-clamp-2">
                  {board.description}
                  <div className="mt-1 text-xs text-muted-foreground">
                    Projekt: {board.projectTitle}
                  </div>
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}