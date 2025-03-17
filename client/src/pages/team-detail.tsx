import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { type Team, type Project, type Board, type User, type Objective } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Pencil, Users, Kanban, Target, LineChart } from "lucide-react";
import { useState, useEffect } from "react";
import { TeamForm } from "@/components/team/team-form";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function TeamDetail() {
  const params = useParams();
  const teamId = parseInt(params.id as string);
  const [showEditForm, setShowEditForm] = useState(false);
  const { toast } = useToast();

  // Fetch team details
  const { data: team, isLoading: isTeamLoading } = useQuery<Team>({
    queryKey: [`/api/teams/${teamId}`],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}`);
      if (!res.ok) {
        throw new Error(await res.text() || "Failed to fetch team");
      }
      return res.json();
    },
  });

  // Fetch projects associated with this team
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects");
      if (!res.ok) {
        throw new Error(await res.text() || "Failed to fetch projects");
      }
      const allProjects = await res.json();
      return allProjects.filter((project: Project) =>
        project.teamIds?.includes(teamId)
      );
    },
    enabled: !!teamId,
  });

  // Fetch boards associated with this team
  const { data: boards = [], error: boardsError } = useQuery<Board[]>({
    queryKey: [`/api/teams/${teamId}/boards`],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/boards`);
      if (!res.ok) {
        throw new Error(await res.text() || "Failed to fetch team boards");
      }
      return res.json();
    },
    enabled: !!teamId,
    retry: 1,
  });

  // Fetch team members
  const { data: members = [], error: membersError } = useQuery<User[]>({
    queryKey: [`/api/teams/${teamId}/members`],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/members`);
      if (!res.ok) {
        throw new Error(await res.text() || "Failed to fetch team members");
      }
      return res.json();
    },
    enabled: !!teamId,
    retry: 1,
  });

  // Fetch team OKRs
  const { data: objectives = [], error: objectivesError } = useQuery<Objective[]>({
    queryKey: [`/api/teams/${teamId}/objectives`],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${teamId}/objectives`);
      if (!res.ok) {
        throw new Error(await res.text() || "Failed to fetch team objectives");
      }
      return res.json();
    },
    enabled: !!teamId,
    retry: 1,
  });

  // Handle errors in useEffect to prevent render loop
  useEffect(() => {
    const handleError = (error: Error | null, type: string) => {
      if (error) {
        console.error(`Error fetching ${type}:`, error);
        toast({
          title: "Fehler",
          description: `${type} konnten nicht geladen werden`,
          variant: "destructive",
        });
      }
    };

    handleError(boardsError as Error, "Boards");
    handleError(membersError as Error, "Teammitglieder");
    handleError(objectivesError as Error, "OKRs");
  }, [boardsError, membersError, objectivesError, toast]);

  if (isTeamLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Team wird geladen...</p>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Team nicht gefunden</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      {/* Team Header */}
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-3xl">{team.name}</CardTitle>
            <p className="text-muted-foreground mt-2">{team.description}</p>
          </div>
          <Button variant="outline" onClick={() => setShowEditForm(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Team bearbeiten
          </Button>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Team Members Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <CardTitle>Teammitglieder</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {membersError ? (
              <p className="text-sm text-destructive">
                Fehler beim Laden der Teammitglieder
              </p>
            ) : members.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine Teammitglieder gefunden
              </p>
            ) : (
              <div className="space-y-4">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={member.avatarUrl || ""} />
                      <AvatarFallback>{member.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{member.username}</p>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Projects Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              <CardTitle>Projekte</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine Projekte gefunden
              </p>
            ) : (
              <div className="space-y-4">
                {projects.map((project) => (
                  <Link key={project.id} href={`/projects/${project.id}`}>
                    <div className="p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                      <h3 className="font-medium">{project.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Boards Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Kanban className="h-5 w-5" />
              <CardTitle>Boards</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {boardsError ? (
              <p className="text-sm text-destructive">
                Fehler beim Laden der Boards
              </p>
            ) : boards.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine Boards gefunden
              </p>
            ) : (
              <div className="space-y-4">
                {boards.map((board) => (
                  <Link key={board.id} href={`/boards/${board.id}`}>
                    <div className="p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                      <h3 className="font-medium">{board.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {board.description}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* OKRs Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <LineChart className="h-5 w-5" />
              <CardTitle>OKRs</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {objectivesError ? (
              <p className="text-sm text-destructive">
                Fehler beim Laden der OKRs
              </p>
            ) : objectives.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine OKRs gefunden
              </p>
            ) : (
              <div className="space-y-4">
                {objectives.map((objective) => (
                  <Link key={objective.id} href={`/okr/${objective.id}`}>
                    <div className="p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                      <h3 className="font-medium">{objective.title}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant={objective.status === 'completed' ? 'default' : 'secondary'}>
                          {objective.status === 'completed' ? 'Abgeschlossen' : 'In Bearbeitung'}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Team Dialog */}
      <TeamForm
        open={showEditForm}
        onClose={() => setShowEditForm(false)}
        existingTeam={team}
      />
    </div>
  );
}