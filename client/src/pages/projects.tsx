import { useQuery } from "@tanstack/react-query";
import { type Project } from "@shared/schema";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plus } from "lucide-react";
import { ProjectForm } from "@/components/project/project-form";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Projects() {
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects");
      if (!res.ok) {
        throw new Error("Failed to fetch projects");
      }
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold">Projekte</h1>
          <p className="text-muted-foreground mt-2">
            Verwalten Sie Ihre Projekte und zugehörigen Boards
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Neues Projekt
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        {projects?.map((project) => (
          <Link key={project.id} href={`/projects/${project.id}`}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-[140px]">
              <CardHeader className="p-4">
                <CardTitle className="text-base line-clamp-1">{project.title}</CardTitle>
                <CardDescription className="text-sm line-clamp-2">
                  {project.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-xs text-muted-foreground">
                  Erstellt: {new Date(project.createdAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <ProjectForm
        open={showForm}
        onClose={() => setShowForm(false)}
      />
    </div>
  );
}