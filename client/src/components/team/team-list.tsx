import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { type Team, type TeamMember, type InsertTeam, type Board, type Project, type Objective } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { TeamForm } from "./team-form";
import { Users, Plus, Edit, Target, Folder, KanbanSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

export function TeamList() {
  const [isCreating, setIsCreating] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const { toast } = useToast();

  const { data: teams = [], isLoading, error } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
    queryFn: async () => {
      const response = await fetch("/api/teams");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Teams");
      }
      return response.json();
    },
  });

  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ["/api/team-members"],
    queryFn: async () => {
      const response = await fetch("/api/team-members");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Team-Mitglieder");
      }
      return response.json();
    },
  });
  
  // Abfrage für Projekte
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const response = await fetch("/api/projects");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Projekte");
      }
      return response.json();
    },
  });
  
  // Abfrage für Boards
  const { data: boards = [] } = useQuery<Board[]>({
    queryKey: ["/api/boards"],
    queryFn: async () => {
      const response = await fetch("/api/boards");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Boards");
      }
      return response.json();
    },
  });
  
  // Abfrage für Objectives (OKRs)
  const { data: objectives = [] } = useQuery<Objective[]>({
    queryKey: ["/api/objectives"],
    queryFn: async () => {
      const response = await fetch("/api/objectives");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Objectives");
      }
      return response.json();
    },
  });

  if (isLoading) {
    return <div>Lade Teams...</div>;
  }

  if (error) {
    return <div>Fehler beim Laden der Teams</div>;
  }

  const getTeamMembers = (teamId: number) => {
    return teamMembers
      .filter(tm => tm.teamId === teamId)
      .map(tm => tm.userId.toString());
  };
  
  // Zählt die Anzahl der Projekte für ein Team
  const getTeamProjectCount = (teamId: number) => {
    return projects.filter(project => 
      project.teams && Array.isArray(project.teams) && 
      project.teams.some(team => team.id === teamId)
    ).length;
  };
  
  // Zählt die Anzahl der Boards für ein Team
  const getTeamBoardCount = (teamId: number) => {
    return boards.filter(board => 
      board.teams && Array.isArray(board.teams) && 
      board.teams.some(team => team.id === teamId)
    ).length;
  };
  
  // Zählt die Anzahl der OKRs (Objectives) für ein Team
  const getTeamOkrCount = (teamId: number) => {
    return objectives.filter(objective => 
      objective.teamId === teamId
    ).length;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Teams
          </h1>
          <p className="text-muted-foreground mt-2">Übersicht und Verwaltung aller Teams</p>
        </div>
        <Button 
          onClick={() => setIsCreating(true)}
          className="bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white shadow-md transition-all duration-300 hover:shadow-lg"
        >
          <Plus className="h-4 w-4 mr-2" />
          Neues Team
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {teams.map((team) => (
          <Card key={team.id} className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer">
            <Link href={`/teams/${team.id}`} className="absolute inset-0 z-10">
              <span className="sr-only">Team Details anzeigen</span>
            </Link>
            <CardHeader className="p-4 pb-2">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg font-bold line-clamp-1 group-hover:text-primary transition-colors">
                  {team.name}
                </CardTitle>
              </div>
            </CardHeader>
            
            <CardContent className="p-4 pt-2 pb-2">
              <CardDescription className="text-sm text-muted-foreground mb-4 line-clamp-2 min-h-[40px]">
                {team.description || "Keine Beschreibung"}
              </CardDescription>
              
              <div className="grid grid-cols-3 gap-2 mt-2 mb-4">
                <div className="flex flex-col items-center p-2 bg-blue-50 rounded-md">
                  <Folder className="h-4 w-4 mb-1 text-blue-600" />
                  <span className="text-xs font-medium text-blue-700">
                    {getTeamProjectCount(team.id)} Projekte
                  </span>
                </div>
                
                <div className="flex flex-col items-center p-2 bg-amber-50 rounded-md">
                  <KanbanSquare className="h-4 w-4 mb-1 text-amber-600" />
                  <span className="text-xs font-medium text-amber-700">
                    {getTeamBoardCount(team.id)} Boards
                  </span>
                </div>
                
                <div className="flex flex-col items-center p-2 bg-green-50 rounded-md">
                  <Target className="h-4 w-4 mb-1 text-green-600" />
                  <span className="text-xs font-medium text-green-700">
                    {getTeamOkrCount(team.id)} OKRs
                  </span>
                </div>
              </div>
            </CardContent>
            
            <CardFooter className="p-4 pt-2 flex items-center justify-between border-t">
              <div className="flex items-center text-xs text-muted-foreground">
                <Users className="h-4 w-4 mr-1.5 text-slate-500" />
                <span className="font-medium">
                  {teamMembers.filter(tm => tm.teamId === team.id).length || 0} Mitglieder
                </span>
              </div>
              
              <div className="flex space-x-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 p-1 hover:bg-blue-50 rounded-full z-20"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setEditingTeam(team);
                  }}
                  title="Bearbeiten"
                >
                  <Edit className="h-4 w-4 text-blue-500" />
                </Button>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>

      <TeamForm
        open={isCreating}
        onClose={() => setIsCreating(false)}
      />

      <TeamForm
        open={!!editingTeam}
        onClose={() => setEditingTeam(null)}
        defaultValues={editingTeam ? {
          name: editingTeam.name,
          description: editingTeam.description || "",
          member_ids: getTeamMembers(editingTeam.id),
          companyId: editingTeam.companyId,
          creatorId: editingTeam.creatorId
        } : undefined}
        onSubmit={async (data) => {
          if (!editingTeam) return;

          try {
            // Stelle sicher, dass creatorId beim Update nicht verloren geht
            // Entferne member_ids vom Objekt, wenn es ein leeres Array ist
            const teamData: InsertTeam & { member_ids?: string[] } = {
              name: data.name,
              description: data.description || "",
              companyId: data.companyId || editingTeam.companyId,
              creatorId: editingTeam.creatorId // Wichtig: Die ursprüngliche creatorId beibehalten
            };
            
            // Füge member_ids nur hinzu, wenn es nicht leer ist
            if (data.member_ids && data.member_ids.length > 0) {
              teamData.member_ids = data.member_ids;
            }
            
            console.log("Updating team data:", JSON.stringify(teamData, null, 2));
            
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

            toast({ title: "Team erfolgreich aktualisiert" });
            setEditingTeam(null);
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
    </div>
  );
}