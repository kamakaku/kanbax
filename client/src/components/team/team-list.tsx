import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { type Team, type TeamMember } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TeamForm } from "./team-form";
import { Users, Plus, Edit } from "lucide-react";
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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Teams</h2>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Neues Team
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {teams.map((team) => (
          <Card key={team.id} className="relative overflow-hidden">
            <Link href={`/teams/${team.id}`} className="absolute inset-0 z-10">
              <span className="sr-only">Team Details anzeigen</span>
            </Link>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {team.name}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setEditingTeam(team);
                }}
                className="z-20 relative"
              >
                <Edit className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm text-muted-foreground">
                {team.description}
              </CardDescription>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center">
                  <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {teamMembers.filter(tm => tm.teamId === team.id).length} Mitglieder
                  </span>
                </div>
                {team.creatorId && (
                  <div className="text-xs text-muted-foreground flex items-center">
                    <span className="mr-1">Creator:</span>
                    <span className="font-medium">
                      {team.creatorId}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
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
            const teamData = {
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