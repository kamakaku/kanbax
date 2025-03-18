import { useQuery } from "@tanstack/react-query";
import { type Project } from "@shared/schema";
import { useLocation } from "wouter";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Plus, Star } from "lucide-react";
import { useState } from "react";
import { ProjectForm } from "@/components/project/project-form";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

export default function AllProjects() {
  const [, setLocation] = useLocation();
  const { setCurrentProject } = useStore();
  const [showForm, setShowForm] = useState(false);

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const response = await fetch("/api/projects");
      if (!response.ok) {
        throw new Error("Failed to fetch projects");
      }
      return response.json();
    },
  });

  const handleProjectClick = (project: Project) => {
    setCurrentProject(project);
    setLocation(`/projects/${project.id}`);
  };

  const toggleFavorite = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiRequest('PATCH', `/api/projects/${project.id}/favorite`);
      await queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Lade Projekte...</p>
        </div>
      </div>
    );
  }

  const favoriteProjects = projects.filter(p => p.isFavorite);
  const nonFavoriteProjects = projects.filter(p => !p.isFavorite);

  return (
    <div className="container mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Alle Projekte
          </h1>
          <p className="text-muted-foreground mt-2">Übersicht aller verfügbaren Projekte</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-primary/10 hover:bg-primary/20">
          <Plus className="mr-2 h-4 w-4" />
          Neues Projekt
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Keine Projekte vorhanden</p>
        </div>
      ) : (
        <>
          {favoriteProjects.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Favorisierte Projekte</h2>
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                {favoriteProjects.map((project) => (
                  <Card
                    key={project.id}
                    className="group hover:shadow-lg transition-all duration-300 cursor-pointer border border-primary/20 h-[120px]"
                    onClick={() => handleProjectClick(project)}
                  >
                    <CardHeader className="p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base line-clamp-1 group-hover:text-primary transition-colors">
                          {project.title}
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="p-1 hover:bg-yellow-100"
                          onClick={(e) => toggleFavorite(project, e)}
                        >
                          <Star className={`h-5 w-5 ${project.isFavorite ? "fill-yellow-400 text-yellow-400" : "text-gray-400"}`} />
                        </Button>
                      </div>
                      <CardDescription className="text-sm line-clamp-2">
                        {project.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {nonFavoriteProjects.length > 0 && (
            <div>
              <h2 className="text-2xl font-semibold mb-4">Weitere Projekte</h2>
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                {nonFavoriteProjects.map((project) => (
                  <Card
                    key={project.id}
                    className="group hover:shadow-lg transition-all duration-300 cursor-pointer border border-primary/10 hover:border-primary/20 h-[120px]"
                    onClick={() => handleProjectClick(project)}
                  >
                    <CardHeader className="p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base line-clamp-1 group-hover:text-primary transition-colors">
                          {project.title}
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="p-1 hover:bg-yellow-100"
                          onClick={(e) => toggleFavorite(project, e)}
                        >
                          <Star className={`h-5 w-5 ${project.isFavorite ? "fill-yellow-400 text-yellow-400" : "text-gray-400"}`} />
                        </Button>
                      </div>
                      <CardDescription className="text-sm line-clamp-2">
                        {project.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <ProjectForm
        open={showForm}
        onClose={() => setShowForm(false)}
      />
    </div>
  );
}
