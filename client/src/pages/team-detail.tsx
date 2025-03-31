import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Team, Board, Objective, Project, User, InsertTeam, Task } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Calendar, Clipboard, Kanban, ChevronRight, ChevronLeft, Edit, ExternalLink, Star, Archive, RotateCcw, FileClock, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { TeamForm } from "@/components/team/team-form";
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-store";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { ProtocolList } from "@/components/protocol/protocol-list";

export default function TeamDetail() {
  const [, params] = useRoute("/teams/:id");
  const [, navigate] = useLocation();
  const teamId = parseInt(params?.id || "0");
  const { toast } = useToast();
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const { user } = useAuth();

  // Abfrage für Team-Details
  const { data: team, isLoading: teamLoading, error: teamError, refetch: refetchTeam } = useQuery<Team>({
    queryKey: [`/api/teams/${teamId}`],
    queryFn: async () => {
      const response = await fetch(`/api/teams/${teamId}`);
      if (!response.ok) {
        throw new Error("Fehler beim Laden des Teams");
      }
      return response.json();
    },
    enabled: !!teamId && teamId > 0,
  });

  // Abfrage für Team-Mitglieder
  const { data: teamMembers = [], isLoading: membersLoading } = useQuery<any[]>({
    queryKey: ["/api/team-members"],
    queryFn: async () => {
      const response = await fetch("/api/team-members");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Team-Mitglieder");
      }
      return response.json();
    },
  });

  // Abfrage für User-Daten
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch("/api/users");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Benutzer");
      }
      return response.json();
    },
  });

  // Abfrage für Boards
  const { data: allBoards = [] } = useQuery<Board[]>({
    queryKey: ["/api/boards"],
    queryFn: async () => {
      const response = await fetch("/api/boards");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Boards");
      }
      return response.json();
    },
  });

  // Abfrage für Projekte
  const { data: allProjects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const response = await fetch("/api/projects");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Projekte");
      }
      return response.json();
    },
  });
  
  // Alle Tasks für alle Boards abrufen (wird für Fortschrittsbalken benötigt)
  const { data: allTasksData, isLoading: tasksLoading } = useQuery<Record<number, Task[]>>({
    queryKey: ['/api/all-tasks'],
    queryFn: () => apiRequest("GET", "/api/all-tasks"),
  });

  // Abfrage für OKRs
  const { data: allObjectives = [] } = useQuery<Objective[]>({
    queryKey: ["/api/objectives"],
    queryFn: async () => {
      const response = await fetch("/api/objectives");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der OKRs");
      }
      return response.json();
    },
  });

  // Filtern der Boards für dieses Team
  const teamBoards = allBoards.filter(board => 
    (board.team_ids && Array.isArray(board.team_ids) && board.team_ids.includes(teamId))
  );

  // Filtern der Objectives (OKRs) für dieses Team
  const teamObjectives = allObjectives.filter(obj => obj.teamId === teamId);

  // Filtern der Projekte, die mit diesem Team verbunden sind
  const teamProjects = allProjects.filter(proj => 
    (proj.teamIds && Array.isArray(proj.teamIds) && proj.teamIds.includes(teamId))
  );

  // Team-Mitglieder-Liste erstellen
  const getTeamUserIds = () => {
    return teamMembers
      .filter(tm => tm.teamId === teamId)
      .map(tm => tm.userId);
  };

  const teamUserIds = getTeamUserIds();
  const teamUsers = users.filter(user => teamUserIds.includes(user.id));

  // Prüfung, ob der aktuelle Benutzer der Creator ist
  const isCreator = team?.creatorId === user?.id;

  // Umleiten, wenn Team nicht gefunden wird
  useEffect(() => {
    if (!teamLoading && !team && teamId > 0) {
      toast({
        title: "Team nicht gefunden",
        description: "Das angeforderte Team konnte nicht gefunden werden.",
        variant: "destructive",
      });
      navigate("/teams");
    }
  }, [team, teamLoading, teamId, toast, navigate]);

  // ProjectCard Komponente im Stil der BoardCard
  const ProjectCard = ({ project }: { project: Project }) => {
    // Alle Boards für dieses Projekt finden, um deren TaskCounts zu ermitteln
    const projectBoards = allBoards.filter(board => board.project_id === project.id);
    const projectBoardIds = projectBoards.map(board => board.id);
    
    // Anzahl der Boards und Objectives für dieses Projekt zählen
    const boardCount = projectBoards.length;
    const okrCount = allObjectives.filter(obj => obj.projectId === project.id).length;
    
    // Die tatsächlichen Task-Status-Counts für alle Boards des Projekts berechnen
    const getTaskStatusCounts = () => {
      if (!allTasksData) {
        // Fallback, wenn keine Daten verfügbar sind
        return {
          backlog: 0,
          todo: 0,
          inProgress: 0,
          review: 0,
          done: 0
        };
      }
      
      // Statusverteilung zählen
      const counts = {
        backlog: 0,
        todo: 0,
        inProgress: 0,
        review: 0,
        done: 0
      };
      
      // Für jedes Board des Projekts die Tasks zählen
      projectBoardIds.forEach(boardId => {
        const boardTasks = allTasksData[boardId] || [];
        
        // Statusverteilung für dieses Board zählen und zu Gesamtanzahl addieren
        boardTasks.forEach(task => {
          const taskStatus = task.status ? task.status.toLowerCase().trim() : 'backlog';
          
          if (taskStatus === 'backlog') {
            counts.backlog++;
          } else if (taskStatus === 'todo') {
            counts.todo++;
          } else if (taskStatus === 'in-progress') {
            counts.inProgress++;
          } else if (taskStatus === 'review') {
            counts.review++;
          } else if (taskStatus === 'done') {
            counts.done++;
          } else {
            // Unbekannter Status - als Backlog zählen
            counts.backlog++;
          }
        });
      });
      
      return counts;
    };
    
    const statusCounts = getTaskStatusCounts();
    const totalTasks = Object.values(statusCounts).reduce((a, b) => a + b, 0);
    
    // Farben und Beschreibungen für jeden Status - passend zu den Spaltenfarben im Board
    const statusConfig = {
      backlog: {
        color: "bg-slate-300",
        label: "Backlog"
      },
      todo: {
        color: "bg-blue-300",
        label: "To-Do"
      },
      inProgress: {
        color: "bg-amber-400",
        label: "In Bearbeitung"
      },
      review: {
        color: "bg-purple-400",
        label: "Review"
      },
      done: {
        color: "bg-green-400",
        label: "Erledigt"
      }
    };
    
    // Prozentanteile für die Fortschrittsbalken
    const percentages = {
      backlog: totalTasks > 0 ? (statusCounts.backlog / totalTasks) * 100 : 0,
      todo: totalTasks > 0 ? (statusCounts.todo / totalTasks) * 100 : 0,
      inProgress: totalTasks > 0 ? (statusCounts.inProgress / totalTasks) * 100 : 0,
      review: totalTasks > 0 ? (statusCounts.review / totalTasks) * 100 : 0,
      done: totalTasks > 0 ? (statusCounts.done / totalTasks) * 100 : 0
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
      if (project.createdAt) {
        formattedDate = format(new Date(project.createdAt), 'dd.MM.yyyy', { locale: de });
      } else {
        formattedDate = format(new Date(), 'dd.MM.yyyy', { locale: de }); // Fallback auf aktuelles Datum
      }
    } catch (error) {
      formattedDate = format(new Date(), 'dd.MM.yyyy', { locale: de }); // Fallback bei Fehler
    }
    
    // Projekt-Creator finden
    const creator = users.find(u => u.id === project.creator_id);
    
    return (
      <div
        className="group cursor-pointer transition-all duration-300 relative h-full"
        onClick={() => navigate(`/projects/${project.id}`)}
      >
        <Card
          key={project.id}
          className="hover:shadow-lg transition-all duration-300 cursor-pointer border border-primary/10 hover:border-primary/20 bg-white/80 backdrop-blur-sm relative group overflow-hidden h-full"
        >
          <CardHeader className="p-4 pb-3">
            <div className="flex items-start justify-between mb-2">
              <CardTitle className="text-base line-clamp-1 group-hover:text-primary transition-colors">
                {project.title}
                {project.archived && (
                  <Badge variant="outline" className="ml-2 bg-amber-50 text-amber-700 border-amber-200 text-xs">
                    Archiviert
                  </Badge>
                )}
              </CardTitle>
            </div>
            <CardDescription className="text-sm">
              {project.description ? (
                <p className="line-clamp-2">{project.description}</p>
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
                        id="projectDiagonalHatch" 
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
                    <rect width="100%" height="100%" fill="url(#projectDiagonalHatch)" />
                  </svg>
                </div>
                
                {/* Fortschrittsbalken für Aufgaben */}
                <div className="h-full flex relative z-10">
                  {/* Backlog */}
                  {percentages.backlog > 0 && (
                    <div
                      className={`${statusConfig.backlog.color} h-full cursor-help`}
                      style={{ width: backlogWidth }}
                      title={`${statusConfig.backlog.label}: ${statusCounts.backlog} Aufgaben`}
                    />
                  )}
                  
                  {/* ToDo */}
                  {percentages.todo > 0 && (
                    <div
                      className={`${statusConfig.todo.color} h-full cursor-help`}
                      style={{ width: todoWidth }}
                      title={`${statusConfig.todo.label}: ${statusCounts.todo} Aufgaben`}
                    />
                  )}
                  
                  {/* In Progress */}
                  {percentages.inProgress > 0 && (
                    <div
                      className={`${statusConfig.inProgress.color} h-full cursor-help`}
                      style={{ width: inProgressWidth }}
                      title={`${statusConfig.inProgress.label}: ${statusCounts.inProgress} Aufgaben`}
                    />
                  )}
                  
                  {/* Review */}
                  {percentages.review > 0 && (
                    <div
                      className={`${statusConfig.review.color} h-full cursor-help`}
                      style={{ width: reviewWidth }}
                      title={`${statusConfig.review.label}: ${statusCounts.review} Aufgaben`}
                    />
                  )}
                  
                  {/* Done */}
                  {percentages.done > 0 && (
                    <div
                      className={`${statusConfig.done.color} h-full cursor-help`}
                      style={{ width: doneWidth }}
                      title={`${statusConfig.done.label}: ${statusCounts.done} Aufgaben`}
                    />
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
                onClick={(e) => {
                  e.stopPropagation();
                  // Toggle Favorite (you can implement this function if needed)
                }}
                title={project.isFavorite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
              >
                <Star className={`h-3.5 w-3.5 ${project.isFavorite ? "fill-yellow-400 text-yellow-400" : "text-gray-400"}`} />
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    );
  };

  if (teamLoading || tasksLoading) {
    return <div>Lade Team...</div>;
  }

  if (teamError) {
    return <div>Fehler beim Laden des Teams</div>;
  }

  if (!team) {
    return null;
  }

  const getCreatorName = () => {
    const creator = users.find(u => u.id === team.creatorId);
    return creator?.username || "Unbekannt";
  };

  const handleUpdateSuccess = () => {
    setEditingTeam(null);
    refetchTeam();
    toast({
      title: "Team aktualisiert",
      description: "Das Team wurde erfolgreich aktualisiert."
    });
  };

  return (
    <div className="container py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/teams")}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Zurück
          </Button>
          <h1 className="text-2xl font-bold">{team.name}</h1>
          {isCreator && (
            <Button variant="ghost" size="sm" onClick={() => setEditingTeam(team)}>
              <Edit className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <GlassCard className="p-6">
            <div className="flex justify-between">
              <div>
                <h2 className="text-xl font-semibold">Team-Details</h2>
                <p className="text-muted-foreground mt-2">{team.description || "Keine Beschreibung vorhanden"}</p>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Erstellt von</div>
                <div className="font-medium">{getCreatorName()}</div>
              </div>
            </div>
            
            <Separator className="my-4" />
            
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="flex items-center">
                <Users className="h-3 w-3 mr-1" />
                {teamUsers.length} Mitglieder
              </Badge>
              <Badge variant="secondary" className="flex items-center">
                <Kanban className="h-3 w-3 mr-1" />
                {teamBoards.length} Boards
              </Badge>
              <Badge variant="secondary" className="flex items-center">
                <Calendar className="h-3 w-3 mr-1" />
                {teamObjectives.length} OKRs
              </Badge>
              <Badge variant="secondary" className="flex items-center">
                <Clipboard className="h-3 w-3 mr-1" />
                {teamProjects.length} Projekte
              </Badge>
            </div>
          </GlassCard>

          <Tabs defaultValue="boards" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="boards">Boards</TabsTrigger>
              <TabsTrigger value="objectives">OKRs</TabsTrigger>
              <TabsTrigger value="projects">Projekte</TabsTrigger>
              <TabsTrigger value="activity">Aktivitäten</TabsTrigger>
              <TabsTrigger value="protocols">Protokolle</TabsTrigger>
            </TabsList>
            
            <TabsContent value="boards" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teamBoards.map(board => (
                  <Card key={board.id} className="overflow-hidden">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{board.title}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {board.description || "Keine Beschreibung"}
                      </CardDescription>
                    </CardHeader>
                    <CardFooter className="flex justify-between">
                      <div className="text-xs text-muted-foreground">
                        {board.project && (
                          <Badge variant="outline">{board.project.title}</Badge>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/boards/${board.id}`}>
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
              
              {teamBoards.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Keine Boards für dieses Team
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="objectives" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teamObjectives.map(objective => (
                  <Card key={objective.id} className="overflow-hidden">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{objective.title}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {objective.description || "Keine Beschreibung"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pb-2">
                      <div className="flex items-center">
                        <div className="text-xs text-muted-foreground mr-2">Fortschritt:</div>
                        <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-primary h-2" 
                            style={{ width: `${objective.progress || 0}%` }}
                          ></div>
                        </div>
                        <div className="ml-2 text-xs">{objective.progress || 0}%</div>
                      </div>
                    </CardContent>
                    <CardFooter className="pt-0 flex justify-end">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/all-okrs/${objective.id}`}>
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
              
              {teamObjectives.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Keine OKRs für dieses Team
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="projects" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teamProjects.map(project => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
              
              {teamProjects.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Keine Projekte für dieses Team
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="activity" className="space-y-4">
              <div className="bg-white rounded-lg border">
                <ActivityFeed 
                  teamId={teamId} 
                  limit={50}
                />
              </div>
            </TabsContent>
            
            <TabsContent value="protocols" className="space-y-4">
              <div className="bg-white rounded-lg border">
                <ProtocolList
                  teamId={teamId}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
        
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Team-Mitglieder</h3>
          <div className="bg-card rounded-lg border p-4 space-y-3">
            {teamUsers.map(user => (
              <div key={user.id} className="flex items-center space-x-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.avatarUrl || ""} />
                  <AvatarFallback>{user.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-grow">
                  <div className="text-sm font-medium">{user.username}</div>
                  <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                </div>
                {user.id === team.creatorId && (
                  <Badge variant="secondary" className="text-xs">Creator</Badge>
                )}
              </div>
            ))}
            
            {teamUsers.length === 0 && (
              <div className="text-sm text-muted-foreground">Keine Mitglieder</div>
            )}
          </div>
        </div>
      </div>

      {editingTeam && (
        <TeamForm
          open={!!editingTeam}
          onClose={() => setEditingTeam(null)}
          defaultValues={editingTeam ? {
            name: editingTeam.name,
            description: editingTeam.description || "",
            member_ids: getTeamUserIds().map(id => id.toString()),
            companyId: editingTeam.companyId,
            creatorId: editingTeam.creatorId
          } : undefined}
          onSubmit={async (data) => {
            try {
              // Stelle sicher, dass creatorId beim Update nicht verloren geht
              const teamData: InsertTeam & { member_ids?: string[] } = {
                name: data.name,
                description: data.description || "",
                companyId: data.companyId || editingTeam.companyId,
                creatorId: editingTeam.creatorId,
                member_ids: data.member_ids || []
              };
              
              const res = await fetch(`/api/teams/${editingTeam.id}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(teamData)
              });

              if (!res.ok) {
                const errorData = await res.json().catch(() => null);
                console.error("Server error:", errorData);
                throw new Error(errorData?.message || "Failed to update team");
              }

              handleUpdateSuccess();
            } catch (error) {
              console.error("Error updating team:", error);
              toast({
                title: "Fehler",
                description: error instanceof Error ? error.message : "Das Team konnte nicht aktualisiert werden",
                variant: "destructive",
              });
            }
          }}
        />
      )}
    </div>
  );
}