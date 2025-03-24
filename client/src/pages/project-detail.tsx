import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import { type Project, UpdateProject, Team, Board, Objective, User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Pencil, 
  Users, 
  Star, 
  Calendar, 
  Clipboard, 
  Kanban, 
  ChevronRight, 
  ChevronLeft, 
  Edit 
} from "lucide-react";
import { useState, useEffect } from "react";
import { ProjectForm } from "@/components/project/project-form";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { GlassCard } from "@/components/ui/glass-card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-store";

export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
  const [, navigate] = useLocation();
  const projectId = parseInt(params?.id || "0");
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Abfrage für Projekt-Details
  const { data: project, isLoading: projectLoading, error: projectError, refetch: refetchProject } = useQuery<Project>({
    queryKey: [`/api/projects/${projectId}`],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}`);
      if (!response.ok) {
        throw new Error("Fehler beim Laden des Projekts");
      }
      return response.json();
    },
    enabled: !!projectId && projectId > 0,
  });

  // Abfrage für Teams
  const { data: allTeams = [] } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
    queryFn: async () => {
      const response = await fetch("/api/teams");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Teams");
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
  
  // Abfrage für Team-Mitglieder
  const { data: teamMembers = [] } = useQuery({
    queryKey: ["/api/team-members"],
    queryFn: async () => {
      const response = await fetch("/api/team-members");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Team-Mitglieder");
      }
      return response.json();
    },
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

  // Mutation für Favoriten-Toggle
  const toggleFavorite = useMutation({
    mutationFn: async () => {
      return await apiRequest('PATCH', `/api/projects/${projectId}/favorite`);
    },
    onSuccess: () => {
      // Invalidate the project query to refresh the data
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      
      toast({
        title: project?.isFavorite 
          ? "Aus Favoriten entfernt" 
          : "Zu Favoriten hinzugefügt",
      });
    },
  });

  // Filtern der Boards für dieses Projekt
  const projectBoards = allBoards.filter(board => board.project_id === projectId);

  // Filtern der Objectives (OKRs) für dieses Projekt
  const projectObjectives = allObjectives.filter(obj => obj.projectId === projectId);

  // Filtern der Teams, die mit diesem Projekt verbunden sind
  // Prüfe auf teams-Eigenschaft oder teamIds (je nach API-Antwort)
  const projectTeams = project?.teams?.length 
    ? allTeams.filter(team => project.teams?.some((t: any) => t.id === team.id))
    : project?.teamIds?.length
    ? allTeams.filter(team => project.teamIds?.includes(team.id))
    : [];

  // Umleiten, wenn Projekt nicht gefunden wird
  useEffect(() => {
    if (!projectLoading && !project && projectId > 0) {
      toast({
        title: "Projekt nicht gefunden",
        description: "Das angeforderte Projekt konnte nicht gefunden werden.",
        variant: "destructive",
      });
      navigate("/all-projects");
    }
  }, [project, projectLoading, projectId, toast, navigate]);

  if (projectLoading) {
    return <div>Lade Projekt...</div>;
  }

  if (projectError) {
    return <div>Fehler beim Laden des Projekts</div>;
  }

  if (!project) {
    return null;
  }

  // Logge Projekt-Struktur zur Analyse
  console.log("Projekt-Struktur:", project);

  // Prüfen, ob der aktuelle Benutzer der Ersteller des Projekts ist
  const isCreator = user?.id === project.creator_id;

  const getProjectCreatorName = () => {
    if (project.creator && project.creator.username) {
      return project.creator.username;
    }
    
    // Fallback: Wenn creator vorhanden ist, aber kein username
    if (project.creator) {
      return "Benutzer #" + project.creator.id;
    }
    
    // Wenn kein creator-Objekt da ist, aber creator_id vorhanden
    if (project.creator_id) {
      const creatorUser = users.find(u => u.id === project.creator_id);
      return creatorUser?.username || "Benutzer #" + project.creator_id;
    }
    
    return "Unbekannt";
  };

  return (
    <div className="container py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/all-projects")}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Zurück
          </Button>
          <h1 className="text-2xl font-bold">{project.title}</h1>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => toggleFavorite.mutate()}
            className="hover:bg-yellow-100"
          >
            <Star 
              className={`h-4 w-4 ${project.isFavorite ? "fill-yellow-400 text-yellow-400" : "text-gray-400 hover:text-yellow-400"}`}
            />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setEditingProject(project)}>
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <GlassCard className="p-6">
            <div>
              <h2 className="text-xl font-semibold">Projekt-Details</h2>
              <p className="text-muted-foreground mt-2">{project.description || "Keine Beschreibung vorhanden"}</p>
              <div className="text-xs text-muted-foreground mt-1">
                Erstellt am {new Date(project.createdAt).toLocaleDateString()}
              </div>
            </div>
            
            <Separator className="my-4" />
            
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="flex items-center">
                <Users className="h-3 w-3 mr-1" />
                {projectTeams.length} Teams
              </Badge>
              <Badge variant="secondary" className="flex items-center">
                <Kanban className="h-3 w-3 mr-1" />
                {projectBoards.length} Boards
              </Badge>
              <Badge variant="secondary" className="flex items-center">
                <Calendar className="h-3 w-3 mr-1" />
                {projectObjectives.length} OKRs
              </Badge>
            </div>
          </GlassCard>

          <Tabs defaultValue="boards" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="boards">Boards</TabsTrigger>
              <TabsTrigger value="objectives">OKRs</TabsTrigger>
            </TabsList>
            
            <TabsContent value="boards" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projectBoards.map(board => (
                  <Card key={board.id} className="overflow-hidden">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{board.title}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {board.description || "Keine Beschreibung"}
                      </CardDescription>
                    </CardHeader>
                    <CardFooter className="flex justify-end">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/boards/${board.id}`}>
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
                
                {projectBoards.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground col-span-2">
                    Keine Boards in diesem Projekt
                  </div>
                )}
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => navigate(`/boards/new?projectId=${projectId}`)}>
                  Neues Board erstellen
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="objectives" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projectObjectives.map(objective => (
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
              
              {projectObjectives.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Keine OKRs für dieses Projekt
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
        
        <div className="space-y-4">
          <Tabs defaultValue="teams" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="teams">Teams</TabsTrigger>
              <TabsTrigger value="members">Mitglieder</TabsTrigger>
            </TabsList>
            
            <TabsContent value="teams" className="space-y-4">
              <div className="bg-card rounded-lg border p-4 space-y-3">
                {projectTeams.map(team => (
                  <div key={team.id} className="flex items-center space-x-2">
                    <div className="flex-grow">
                      <div className="text-sm font-medium">{team.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{team.description}</div>
                    </div>
                    <Button variant="ghost" size="sm" asChild className="px-2">
                      <Link href={`/teams/${team.id}`}>
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                ))}
                
                {projectTeams.length === 0 && (
                  <div className="text-sm text-muted-foreground">Keine Teams zugewiesen</div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="members" className="space-y-4">
              <div className="bg-card rounded-lg border p-4 space-y-3">
                {/* Zeige den Creator explizit an der ersten Stelle */}
                {project.creator && (
                  <div className="flex items-center space-x-2 border-l-4 border-primary pl-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={project.creator.avatarUrl || ""} />
                      <AvatarFallback>{project.creator.username?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-grow">
                      <div className="flex items-center">
                        <span className="text-sm font-medium">{project.creator.username}</span>
                        <Badge variant="outline" className="ml-2 text-xs py-0 h-5 bg-primary/10">
                          Ersteller
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{project.creator.email}</div>
                    </div>
                  </div>
                )}

                {/* Zeige direkte Projektmitglieder und Board-Mitglieder an */}
                {(() => {
                  // Sammle alle Benutzer-IDs
                  const userIds = new Set<number>();
                  
                  // Füge direkte Projektmitglieder hinzu, wenn vorhanden
                  if (project.members && project.members.length > 0) {
                    project.members.forEach(member => userIds.add(member.id));
                  } else if (project.memberIds && project.memberIds.length > 0) {
                    project.memberIds.forEach(id => userIds.add(id));
                  }
                  
                  // Füge zusätzlich Board-Benutzer hinzu
                  projectBoards.forEach(board => {
                    if (board.assigned_user_ids) {
                      board.assigned_user_ids.forEach(id => userIds.add(id));
                    }
                  });
                  
                  // Entferne den Creator aus der Liste, da er bereits oben angezeigt wird
                  if (project.creator) {
                    userIds.delete(project.creator.id);
                  }
                  
                  // Finde alle Benutzer anhand der IDs
                  const projectMembers = Array.from(userIds)
                    .map(id => users.find(user => user.id === id))
                    .filter(Boolean); // Entferne undefined-Werte
                  
                  if (projectMembers.length > 0) {
                    return projectMembers.map(member => (
                      <div key={member!.id} className="flex items-center space-x-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member!.avatarUrl || ""} />
                          <AvatarFallback>{member!.username?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                        </Avatar>
                        <div className="flex-grow">
                          <div className="text-sm font-medium">{member!.username}</div>
                          <div className="text-xs text-muted-foreground truncate">{member!.email}</div>
                        </div>
                      </div>
                    ));
                  } else {
                    // Falls keine weiteren Mitglieder vorhanden sind und der Creator bereits angezeigt wird
                    if (!project.creator) {
                      return <div className="text-sm text-muted-foreground">Keine Mitglieder gefunden</div>;
                    }
                    return null; // Creator wird bereits angezeigt
                  }
                })()}
              </div>
            </TabsContent>
          </Tabs>

          <h3 className="text-lg font-semibold mt-6">Neueste Boards</h3>
          <div className="bg-card rounded-lg border p-4 space-y-3">
            {projectBoards.slice(0, 3).map(board => (
              <div key={board.id} className="flex items-center space-x-2">
                <div className="flex-grow">
                  <div className="text-sm font-medium">{board.title}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {board.description || "Keine Beschreibung"}
                  </div>
                </div>
                <Button variant="ghost" size="sm" asChild className="px-2">
                  <Link href={`/boards/${board.id}`}>
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ))}
            
            {projectBoards.length === 0 && (
              <div className="text-sm text-muted-foreground">Keine Boards vorhanden</div>
            )}
          </div>
        </div>
      </div>

      {editingProject && (
        <ProjectForm
          open={!!editingProject}
          onClose={() => setEditingProject(null)}
          existingProject={editingProject}
          onSuccess={() => refetchProject()} // Projekt-Daten nach der Aktualisierung neu laden
        />
      )}
    </div>
  );
}