import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Team, Board, Objective, Project, User, InsertTeam } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Calendar, Clipboard, Kanban, ChevronRight, ChevronLeft, Edit, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { TeamForm } from "@/components/team/team-form";
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-store";

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
  const teamBoards = allBoards.filter(board => board.team_ids?.includes(teamId));

  // Filtern der Objectives (OKRs) für dieses Team
  const teamObjectives = allObjectives.filter(obj => 
    obj.teams && Array.isArray(obj.teams) && obj.teams.some((t: any) => t.id === teamId)
  );

  // Filtern der Projekte, die mit diesem Team verbunden sind
  const teamProjects = allProjects.filter(proj => 
    proj.teams && Array.isArray(proj.teams) && proj.teams.some((t: any) => t.id === teamId)
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

  if (teamLoading) {
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
                        <Link href={`/board/${board.id}`}>
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
                        <Link href={`/objectives/${objective.id}`}>
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
                  <Card key={project.id} className="overflow-hidden">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{project.title}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {project.description || "Keine Beschreibung"}
                      </CardDescription>
                    </CardHeader>
                    <CardFooter className="flex justify-end">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/projects/${project.id}`}>
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
              
              {teamProjects.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Keine Projekte für dieses Team
                </div>
              )}
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