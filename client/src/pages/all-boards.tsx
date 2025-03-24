import { useQuery, useMutation } from "@tanstack/react-query";
import { type Project, type Board, type Task } from "@shared/schema";
import { useLocation } from "wouter";
import { Card, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Plus, Star, Archive, RotateCcw, Calendar } from "lucide-react";
import { useState, useEffect } from "react";
import { BoardForm } from "@/components/board/board-form";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format } from "date-fns";
import { de } from "date-fns/locale";

export default function AllBoards() {
  const [, setLocation] = useLocation();
  const { setCurrentBoard, setCurrentProject } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("active");
  const { toast } = useToast();

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: () => apiRequest("GET", "/api/projects"),
  });

  const { data: boards = [], isLoading: boardsLoading } = useQuery<Board[]>({
    queryKey: ["/api/boards"],
    queryFn: () => apiRequest("GET", "/api/boards"),
  });
  
  // Alle Tasks für alle Boards abrufen
  const { data: allTasksData, isLoading: tasksLoading } = useQuery<Record<number, Task[]>>({
    queryKey: ['/api/all-tasks'],
    queryFn: () => apiRequest("GET", "/api/all-tasks"),
  });
  
  // Debug-Log für Tasks in den Boards
  useEffect(() => {
    if (allTasksData) {
      // Alle Board-IDs ausgeben
      console.log("Verfügbare Board-IDs:", Object.keys(allTasksData));
      
      // Für Board 23 detaillierte Informationen ausgeben
      if (allTasksData[23]) {
        console.log("Tasks für Board 23:", allTasksData[23]);
        console.log("Task Status für Board 23:", 
          allTasksData[23].map(task => task.status)
        );
        console.log("Status-Counts für Board 23:", 
          allTasksData[23].reduce((counts, task) => {
            counts[task.status] = (counts[task.status] || 0) + 1;
            return counts;
          }, {} as Record<string, number>)
        );
      }
    }
  }, [allTasksData]);

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

  if (boardsLoading || tasksLoading) {
    return (
      <div className="container mx-auto p-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Lädt Daten...</p>
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

  const BoardCard = ({ board }: { board: Board }) => {
    // Die tatsächlichen Task-Status-Counts für das Board berechnen
    const getTaskStatusCounts = () => {
      if (!allTasksData || !allTasksData[board.id]) {
        // Fallback, wenn keine Daten verfügbar sind
        return {
          backlog: 0,
          todo: 0,
          inProgress: 0,
          review: 0,
          done: 0
        };
      }
      
      // Tasks für dieses Board filtern und nach Status gruppieren
      const boardTasks = allTasksData[board.id];
      
      // Statusverteilung zählen
      const counts = {
        backlog: 0,
        todo: 0,
        inProgress: 0,
        review: 0,
        done: 0
      };
      
      // Debug-Log für das aktuelle Board
      if (board.id === 23) {
        console.log(`Board ${board.id} Tasks:`, boardTasks);
        console.log(`Board ${board.id} Tasks mit Status:`, boardTasks.map(t => `${t.id}: ${t.status}`));
      }
      
      // Statusverteilung genau zählen
      boardTasks.forEach(task => {
        const taskStatus = task.status ? task.status.toLowerCase() : 'backlog';
        
        switch(taskStatus) {
          case 'backlog':
            counts.backlog++;
            break;
          case 'todo':
            counts.todo++;
            break;
          case 'in-progress':
            counts.inProgress++;
            break;
          case 'review':
            counts.review++;
            break;
          case 'done':
            counts.done++;
            break;
          default:
            // Unbekannter Status - als Backlog zählen
            console.log(`Unbekannter Status für Task ${task.id}: ${taskStatus}`);
            counts.backlog++;
        }
      });
      
      return counts;
    };
    
    const statusCounts = getTaskStatusCounts();
    const totalTasks = Object.values(statusCounts).reduce((a, b) => a + b, 0);
    
    // Farben für jeden Status - passend zu den Spaltenfarben im Board
    const statusColors = {
      backlog: "bg-slate-300",
      todo: "bg-blue-300",
      inProgress: "bg-amber-400", 
      review: "bg-purple-400",
      done: "bg-green-400"
    };
    
    // Prozentanteile für die Fortschrittsbalken
    const percentages = {
      backlog: (statusCounts.backlog / totalTasks) * 100,
      todo: (statusCounts.todo / totalTasks) * 100,
      inProgress: (statusCounts.inProgress / totalTasks) * 100,
      review: (statusCounts.review / totalTasks) * 100,
      done: (statusCounts.done / totalTasks) * 100
    };
    
    // Breitenstile für jeden Status-Balken
    const backlogWidth = `${percentages.backlog}%`;
    const todoWidth = `${percentages.todo}%`;
    const inProgressWidth = `${percentages.inProgress}%`;
    const reviewWidth = `${percentages.review}%`;
    const doneWidth = `${percentages.done}%`;
    
    // Formatierung des Erstellungsdatums
    let formattedDate = "";
    try {
      if (board.created_at) {
        formattedDate = format(new Date(board.created_at), 'dd.MM.yyyy', { locale: de });
      } else {
        formattedDate = format(new Date(), 'dd.MM.yyyy', { locale: de }); // Fallback auf aktuelles Datum
      }
    } catch (error) {
      formattedDate = format(new Date(), 'dd.MM.yyyy', { locale: de }); // Fallback bei Fehler
    }
    
    return (
      <div
        className="group cursor-pointer transition-all duration-300 relative h-full pt-5 mt-5"
        onClick={() => handleBoardClick(board)}
      >
        <Card
          key={board.id}
          className="hover:shadow-lg transition-all duration-300 cursor-pointer border border-primary/10 hover:border-primary/20 bg-white/80 backdrop-blur-sm relative group overflow-hidden h-full"
        >
          <CardHeader className="p-4 pb-3">
            <div className="flex items-start justify-between mb-2">
              <CardTitle className="text-base line-clamp-1 group-hover:text-primary transition-colors">
                {board.title}
                {board.archived && (
                  <Badge variant="outline" className="ml-2 bg-amber-50 text-amber-700 border-amber-200 text-xs">
                    Archiviert
                  </Badge>
                )}
              </CardTitle>
            </div>
            <CardDescription className="text-sm">
              {board.description ? (
                <p className="line-clamp-2">{board.description}</p>
              ) : (
                <p className="line-clamp-2 text-gray-400">Keine Beschreibung</p>
              )}
            </CardDescription>
          </CardHeader>
          
          {/* Status Progress Bar */}
          <div className="px-4 mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden mr-2 relative">
                {/* Schraffur-Hintergrund mit diagonalen Linien */}
                <div className="absolute inset-0 bg-white">
                  <svg 
                    width="100%" 
                    height="100%" 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="overflow-visible"
                  >
                    <defs>
                      <pattern 
                        id="boardDiagonalHatch" 
                        width="4" 
                        height="4" 
                        patternUnits="userSpaceOnUse" 
                        patternTransform="rotate(45)"
                      >
                        <line 
                          x1="0" 
                          y1="0" 
                          x2="0" 
                          y2="4" 
                          stroke="#888" 
                          strokeWidth="1.5" 
                          strokeOpacity="0.65"
                        />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#boardDiagonalHatch)" />
                  </svg>
                </div>
                
                {/* Fortschrittsbalken für Aufgaben */}
                <div className="h-full flex relative z-10">
                  {percentages.backlog > 0 && (
                    <div 
                      className={`${statusColors.backlog} h-full`} 
                      style={{ width: backlogWidth }}
                      title={`Backlog: ${statusCounts.backlog} Aufgaben`}
                    ></div>
                  )}
                  {percentages.todo > 0 && (
                    <div 
                      className={`${statusColors.todo} h-full`} 
                      style={{ width: todoWidth }}
                      title={`ToDo: ${statusCounts.todo} Aufgaben`}
                    ></div>
                  )}
                  {percentages.inProgress > 0 && (
                    <div 
                      className={`${statusColors.inProgress} h-full`} 
                      style={{ width: inProgressWidth }}
                      title={`In Progress: ${statusCounts.inProgress} Aufgaben`}
                    ></div>
                  )}
                  {percentages.review > 0 && (
                    <div 
                      className={`${statusColors.review} h-full`} 
                      style={{ width: reviewWidth }}
                      title={`Review: ${statusCounts.review} Aufgaben`}
                    ></div>
                  )}
                  {percentages.done > 0 && (
                    <div 
                      className={`${statusColors.done} h-full`} 
                      style={{ width: doneWidth }}
                      title={`Done: ${statusCounts.done} Aufgaben`}
                    ></div>
                  )}
                </div>
              </div>
              <span className="text-xs text-gray-500 whitespace-nowrap">{totalTasks} Aufgaben</span>
            </div>
          </div>
          
          <CardFooter className="p-4 pt-0 flex justify-between items-center border-t border-gray-100 mt-1">
            <div className="flex items-center text-xs text-gray-500">
              <Calendar className="h-3.5 w-3.5 text-gray-400 mr-1.5" />
              <span>{formattedDate}</span>
            </div>
            
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="p-1 h-7 w-7 rounded-full hover:bg-yellow-100"
                onClick={(e) => toggleFavorite(board, e)}
                title={board.is_favorite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
              >
                <Star className={`h-3.5 w-3.5 ${board.is_favorite ? "fill-yellow-400 text-yellow-400" : "text-gray-400"}`} />
              </Button>
              
              {board.archived ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="p-1 h-7 w-7 rounded-full hover:bg-blue-100"
                  onClick={(e) => handleUnarchive(board, e)}
                  title="Wiederherstellen"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-blue-500" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="p-1 h-7 w-7 rounded-full hover:bg-gray-100"
                  onClick={(e) => handleArchive(board, e)}
                  title="Archivieren"
                >
                  <Archive className="h-3.5 w-3.5 text-gray-500" />
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>
      </div>
    );
  };

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
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {activeFavoriteBoards.map((board) => (
                        <BoardCard key={board.id} board={board} />
                      ))}
                    </div>
                  </div>
                )}

                {activeNonFavoriteBoards.length > 0 && (
                  <div>
                    <h2 className="text-2xl font-semibold mb-4 text-slate-900">Weitere Boards</h2>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {archivedFavoriteBoards.map((board) => (
                        <BoardCard key={board.id} board={board} />
                      ))}
                    </div>
                  </div>
                )}

                {archivedNonFavoriteBoards.length > 0 && (
                  <div>
                    <h2 className="text-2xl font-semibold mb-4 text-slate-900">Weitere archivierte Boards</h2>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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