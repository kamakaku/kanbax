import { useQuery } from "@tanstack/react-query";
import { type Project, type Board } from "@shared/schema";
import { useLocation } from "wouter";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Plus, Star } from "lucide-react";
import { useState } from "react";
import { BoardForm } from "@/components/board/board-form";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

export default function AllBoards() {
  const [, setLocation] = useLocation();
  const { setCurrentBoard, setCurrentProject } = useStore();
  const [showForm, setShowForm] = useState(false);

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

  const { data: boards = [], isLoading: boardsLoading } = useQuery({
    queryKey: ["/api/boards"],
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

  const handleBoardClick = (board: Board) => {
    console.log("Board clicked:", board);
    // First set the current project if it exists
    if (board.projectId) {
      const project = projects?.find(p => p.id === board.projectId);
      if (project) {
        console.log("Setting current project:", project);
        setCurrentProject(project);
      }
    }
    // Then set the current board
    console.log("Setting current board");
    setCurrentBoard(board);
    // Finally navigate to the board view
    setLocation("/all-boards");
  };

  const toggleFavorite = async (board: Board, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiRequest('PATCH', `/api/boards/${board.id}/favorite`);
      await queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
    }
  };

  if (projectsLoading || boardsLoading) {
    return (
      <div className="container mx-auto p-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Lädt Boards...</p>
        </div>
      </div>
    );
  }

  const favoriteBoards = boards.filter(b => b.isFavorite);
  const nonFavoriteBoards = boards.filter(b => !b.isFavorite);

  return (
    <div className="container mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Alle Boards
          </h1>
          <p className="text-muted-foreground mt-2">Übersicht aller verfügbaren Boards</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-primary/10 hover:bg-primary/20">
          <Plus className="mr-2 h-4 w-4" />
          Neues Board
        </Button>
      </div>

      {boards.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Keine Boards vorhanden</p>
        </div>
      ) : (
        <>
          {favoriteBoards.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Favorisierte Boards</h2>
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                {favoriteBoards.map((board) => (
                  <Card
                    key={board.id}
                    className="group hover:shadow-lg transition-all duration-300 cursor-pointer border border-primary/20 h-[120px]"
                    onClick={() => handleBoardClick(board)}
                  >
                    <CardHeader className="p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base line-clamp-1 group-hover:text-primary transition-colors">
                          {board.title}
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="p-1 hover:bg-yellow-100"
                          onClick={(e) => toggleFavorite(board, e)}
                        >
                          <Star className={`h-5 w-5 ${board.isFavorite ? "fill-yellow-400 text-yellow-400" : "text-gray-400"}`} />
                        </Button>
                      </div>
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
          )}

          {nonFavoriteBoards.length > 0 && (
            <div>
              <h2 className="text-2xl font-semibold mb-4">Weitere Boards</h2>
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                {nonFavoriteBoards.map((board) => (
                  <Card
                    key={board.id}
                    className="group hover:shadow-lg transition-all duration-300 cursor-pointer border border-primary/10 hover:border-primary/20 h-[120px]"
                    onClick={() => handleBoardClick(board)}
                  >
                    <CardHeader className="p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base line-clamp-1 group-hover:text-primary transition-colors">
                          {board.title}
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="p-1 hover:bg-yellow-100"
                          onClick={(e) => toggleFavorite(board, e)}
                        >
                          <Star className={`h-5 w-5 ${board.isFavorite ? "fill-yellow-400 text-yellow-400" : "text-gray-400"}`} />
                        </Button>
                      </div>
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
          )}
        </>
      )}

      <BoardForm
        open={showForm}
        onClose={() => setShowForm(false)}
      />
    </div>
  );
}