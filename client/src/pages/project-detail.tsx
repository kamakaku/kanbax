import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { type Project } from "@shared/schema";
import { BoardList } from "@/components/project/board-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { ProjectForm } from "@/components/project/project-form";
import { ProjectOKRList } from "@/components/project/project-okr-list";

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Loading project...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Project not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-3xl">{project.title}</CardTitle>
            <p className="text-muted-foreground mt-2">{project.description}</p>
          </div>
          <Button variant="outline" onClick={() => setShowEditForm(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit Project
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Created on {new Date(project.createdAt).toLocaleDateString()}
          </p>
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