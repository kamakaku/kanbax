import { useQuery } from "@tanstack/react-query";
import { type Board } from "@shared/schema";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore } from "@/lib/store";

interface BoardWithProject extends Board {
  project: {
    id: number;
    title: string;
    description: string | null;
  };
}

export default function AllBoards() {
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
      <div className="mb-8">
        <h1 className="text-4xl font-bold">Alle Boards</h1>
        <p className="text-muted-foreground mt-2">Übersicht aller verfügbaren Boards</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Lädt Boards...</p>
        </div>
      ) : !boards?.length ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Keine Boards vorhanden</p>
        </div>
      ) : (
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
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  Erstellt am: {new Date(board.createdAt).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}