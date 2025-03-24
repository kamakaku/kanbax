import { useQuery, useMutation } from "@tanstack/react-query";
import { type Project, type Board } from "@shared/schema";
import { useLocation } from "wouter";
import { Card, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Plus, Star, Archive, RotateCcw } from "lucide-react";
import { useState } from "react";
import { BoardForm } from "@/components/board/board-form";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function AllBoards() {
  const [, setLocation] = useLocation();
  const { setCurrentBoard, setCurrentProject } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("active");
  const { toast } = useToast();

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
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
  
  const archiveBoard = useMutation({
    mutationFn: async (boardId: number) => {
      return await apiRequest('PATCH', `/api/boards/${boardId}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
      toast({ 
        title: "Board archiviert",
        description: "Das Board wurde erfolgreich archiviert."
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Archivieren",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  const unarchiveBoard = useMutation({
    mutationFn: async (boardId: number) => {
      return await apiRequest('PATCH', `/api/boards/${boardId}/unarchive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
      toast({ 
        title: "Board wiederhergestellt",
        description: "Das Board wurde erfolgreich wiederhergestellt."
      });
    },
    onError: (error) => {
      toast({
        title: "Fehler beim Wiederherstellen",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  const handleArchive = (board: Board, e: React.MouseEvent) => {
    e.stopPropagation();
    archiveBoard.mutate(board.id);
  };
  
  const handleUnarchive = (board: Board, e: React.MouseEvent) => {
    e.stopPropagation();
    unarchiveBoard.mutate(board.id);
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

  // Filter boards by archived status
  const activeBoards = boards.filter(board => !board.archived);
  const archivedBoards = boards.filter(board => board.archived);
  
  // Filter active/archived boards by favorite status
  const activeFavoriteBoards = activeBoards.filter(b => b.is_favorite);
  const activeNonFavoriteBoards = activeBoards.filter(b => !b.is_favorite);
  const archivedFavoriteBoards = archivedBoards.filter(b => b.is_favorite);
  const archivedNonFavoriteBoards = archivedBoards.filter(b => !b.is_favorite);

  const BoardCard = ({ board }: { board: Board }) => (
    <Card
      key={board.id}
      className="hover:shadow-lg transition-all duration-300 cursor-pointer border border-primary/10 hover:border-primary/20 bg-white/80 backdrop-blur-sm relative"
      onClick={() => handleBoardClick(board)}
    >
      <CardHeader className="p-4">
        <div className="flex items-start justify-between mb-2">
          <CardTitle className="text-base line-clamp-1 group-hover:text-primary transition-colors">
            {board.title}
            {board.archived && (
              <Badge variant="outline" className="ml-2 bg-amber-50 text-amber-700 border-amber-200">
                Archiviert
              </Badge>
            )}
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
            <p className="line-clamp-2">{board.description}</p>
          )}
        </CardDescription>
      </CardHeader>
      <CardFooter className="p-2 pt-0 flex justify-end">
        {board.archived ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => handleUnarchive(board, e)}
            className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Wiederherstellen
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => handleArchive(board, e)}
            className="text-gray-600 hover:bg-gray-50 hover:text-gray-700"
          >
            <Archive className="h-3.5 w-3.5 mr-1" />
            Archivieren
          </Button>
        )}
      </CardFooter>
    </Card>
  );

  return (
    <div className="container mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-slate-900">
            Alle Boards
          </h1>
          <p className="text-muted-foreground mt-2">Übersicht aller verfügbaren Boards</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-white hover:bg-slate-50 text-slate-900 border border-slate-200">
          <Plus className="mr-2 h-4 w-4" />
          Neues Board
        </Button>
      </div>

      {boards.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Keine Boards vorhanden</p>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-8">
            <TabsTrigger value="active" className="flex gap-2 items-center">
              Aktive Boards
              {activeBoards.length > 0 && (
                <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                  {activeBoards.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="archived" className="flex gap-2 items-center">
              Archivierte Boards
              {archivedBoards.length > 0 && (
                <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                  {archivedBoards.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="pt-2">
            {activeBoards.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Keine aktiven Boards vorhanden</p>
              </div>
            ) : (
              <>
                {activeFavoriteBoards.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4 text-slate-900">Favorisierte Boards</h2>
                    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                      {activeFavoriteBoards.map((board) => (
                        <BoardCard key={board.id} board={board} />
                      ))}
                    </div>
                  </div>
                )}

                {activeNonFavoriteBoards.length > 0 && (
                  <div>
                    <h2 className="text-2xl font-semibold mb-4 text-slate-900">Weitere Boards</h2>
                    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                      {activeNonFavoriteBoards.map((board) => (
                        <BoardCard key={board.id} board={board} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="archived" className="pt-2">
            {archivedBoards.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Keine archivierten Boards vorhanden</p>
              </div>
            ) : (
              <>
                {archivedFavoriteBoards.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4 text-slate-900">Favorisierte archivierte Boards</h2>
                    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                      {archivedFavoriteBoards.map((board) => (
                        <BoardCard key={board.id} board={board} />
                      ))}
                    </div>
                  </div>
                )}

                {archivedNonFavoriteBoards.length > 0 && (
                  <div>
                    <h2 className="text-2xl font-semibold mb-4 text-slate-900">Weitere archivierte Boards</h2>
                    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                      {archivedNonFavoriteBoards.map((board) => (
                        <BoardCard key={board.id} board={board} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      )}

      <BoardForm
        open={showForm}
        onClose={() => setShowForm(false)}
      />
    </div>
  );
}