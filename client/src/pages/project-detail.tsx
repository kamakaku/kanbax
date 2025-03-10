import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { type Project } from "@shared/schema";
import { WikiList } from "@/components/project/wiki-list";
import { BoardList } from "@/components/project/board-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { ProjectForm } from "@/components/project/project-form";

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

      <Tabs defaultValue="boards" className="space-y-8">
        <TabsList>
          <TabsTrigger value="boards">Boards</TabsTrigger>
          <TabsTrigger value="wiki">Wiki</TabsTrigger>
        </TabsList>

        <TabsContent value="boards">
          <BoardList projectId={projectId} />
        </TabsContent>

        <TabsContent value="wiki">
          <WikiList projectId={projectId} />
        </TabsContent>
      </Tabs>

      <ProjectForm
        open={showEditForm}
        onClose={() => setShowEditForm(false)}
        existingProject={project}
      />
    </div>
  );
}