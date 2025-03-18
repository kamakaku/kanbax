import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { type Project } from "@shared/schema";
import { BoardList } from "@/components/project/board-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil, Users, Star } from "lucide-react";
import { useState } from "react";
import { ProjectForm } from "@/components/project/project-form";
import { ProjectOKRList } from "@/components/project/project-okr-list";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";


export default function ProjectDetail() {
  const params = useParams();
  const projectId = parseInt(params.id as string);
  const [showEditForm, setShowEditForm] = useState(false);

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: [`/api/projects/${projectId}`],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch project");
      }
      return res.json();
    },
  });

  // Fetch teams for the project
  const { data: teams = [] } = useQuery({
    queryKey: ["/api/teams"],
    queryFn: async () => {
      const res = await fetch("/api/teams");
      if (!res.ok) {
        throw new Error("Failed to fetch teams");
      }
      return res.json();
    },
    enabled: !!project?.teamIds?.length,
  });

  const toggleFavorite = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/projects/${projectId}/favorite`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        }
      });
    },
    onSuccess: () => {
      // Invalidate the project query to refresh the data
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Projekt wird geladen...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Projekt nicht gefunden</p>
      </div>
    );
  }

  const assignedTeams = teams.filter(team => project.teamIds?.includes(team.id));

  return (
    <div className="container mx-auto p-8">
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-3xl">{project.title}</CardTitle>
            <p className="text-muted-foreground mt-2">{project.description}</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => toggleFavorite.mutate()}
              className="hover:bg-yellow-100"
            >
              <Star 
                className={`h-5 w-5 ${project.isFavorite ? "fill-yellow-400 text-yellow-400" : "text-gray-400 hover:text-yellow-400"}`}
              />
            </Button>
            <Button variant="outline" onClick={() => setShowEditForm(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Projekt bearbeiten
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Erstellt am {new Date(project.createdAt).toLocaleDateString()}
            </p>

            {/* Show assigned teams */}
            {assignedTeams.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <p className="text-sm font-medium">Zugewiesene Teams:</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {assignedTeams.map(team => (
                    <Badge key={team.id} variant="secondary">
                      {team.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-12">
        {/* Project OKRs */}
        <ProjectOKRList projectId={projectId} />

        {/* Boards */}
        <BoardList projectId={projectId} />
      </div>

      <ProjectForm
        open={showEditForm}
        onClose={() => setShowEditForm(false)}
        existingProject={project}
      />
    </div>
  );
}