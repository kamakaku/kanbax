import { useQuery } from "@tanstack/react-query";
import { type Project, type Board, type Team, type User } from "@shared/schema";
import { useLocation } from "wouter";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Plus, Star } from "lucide-react";
import { useState } from "react";
import { BoardForm } from "@/components/board/board-form";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

const getTeamAndUserInfo = (board: Board) => {
  // Nur die benötigten Array-Typen verwenden
  const teamIds = Array.isArray(board.team_ids) ? board.team_ids : [];
  const userIds = Array.isArray(board.assigned_user_ids) ? board.assigned_user_ids : [];

  console.log('Teams:', teams); // Debug-Log
  console.log('Users:', users); // Debug-Log
  console.log('Board Team IDs:', teamIds); // Debug-Log
  console.log('Board User IDs:', userIds); // Debug-Log

  const teamNames = teamIds
    .map(id => {
      const team = teams.find(t => t.id === id);
      console.log('Found team:', team); // Debug-Log
      return team?.name;
    })
    .filter(Boolean)
    .join(', ');

  const userNames = userIds
    .map(id => {
      const user = users.find(u => u.id === id);
      console.log('Found user:', user); // Debug-Log
      return user?.username;
    })
    .filter(Boolean)
    .join(', ');

  return {
    teamNames: teamNames || 'Keine Teams',
    userNames: userNames || 'Keine Benutzer'
  };
};

export default function AllBoards() {
  const [, setLocation] = useLocation();
  const { setCurrentBoard, setCurrentProject } = useStore();
  const [showForm, setShowForm] = useState(false);

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: boards = [], isLoading: boardsLoading } = useQuery<Board[]>({
    queryKey: ["/api/boards"],
  });


  const handleBoardClick = (board: Board) => {
    if (board.project_id) {
      const project = projects.find(p => p.id === board.project_id);
      if (project) {
        setCurrentProject(project);
      }
    }
    setCurrentBoard(board);
    setLocation(`/boards/${board.id}`);
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

  if (boardsLoading) {
    return (
      <div className="container mx-auto p-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Lädt Boards...</p>
        </div>
      </div>
    );
  }

  const favoriteBoards = boards.filter(b => b.is_favorite);
  const nonFavoriteBoards = boards.filter(b => !b.is_favorite);

  const BoardCard = ({ board }: { board: Board }) => {
    const { teamNames, userNames } = getTeamAndUserInfo(board);

    return (
      <Card
        key={board.id}
        className="hover:shadow-lg transition-all duration-300 cursor-pointer border border-primary/10 hover:border-primary/20"
        onClick={() => handleBoardClick(board)}
      >
        <CardHeader className="p-4">
          <div className="flex items-start justify-between mb-2">
            <CardTitle className="text-base line-clamp-1 group-hover:text-primary transition-colors">
              {board.title}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="p-1 hover:bg-yellow-100"
              onClick={(e) => toggleFavorite(board, e)}
            >
              <Star className={`h-5 w-5 ${board.is_favorite ? "fill-yellow-400 text-yellow-400" : "text-gray-400"}`} />
            </Button>
          </div>
          <CardDescription className="text-sm">
            {board.description && (
              <p className="line-clamp-2 mb-2">{board.description}</p>
            )}
            <div className="text-xs text-muted-foreground">
              <p>Teams: {teamNames}</p>
              <p>Benutzer: {userNames}</p>
            </div>
          </CardDescription>
        </CardHeader>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Alle Boards
          </h1>
          <p className="text-muted-foreground mt-2">Übersicht aller verfügbaren Boards</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-primary/10 backdrop-blur-sm hover:bg-primary/20">
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
                  <BoardCard key={board.id} board={board} />
                ))}
              </div>
            </div>
          )}

          {nonFavoriteBoards.length > 0 && (
            <div>
              <h2 className="text-2xl font-semibold mb-4">Weitere Boards</h2>
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                {nonFavoriteBoards.map((board) => (
                  <BoardCard key={board.id} board={board} />
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