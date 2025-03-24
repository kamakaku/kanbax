import { useQuery } from "@tanstack/react-query";
import { type Project } from "@shared/schema";
import { useLocation } from "wouter";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Plus, Star, Archive, RotateCcw } from "lucide-react";
import { useState } from "react";
import { ProjectForm } from "@/components/project/project-form";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

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

  // Funktion zum Wiederherstellen eines archivierten Projekts
  const unarchiveProject = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiRequest('PATCH', `/api/projects/${project.id}/unarchive`);
      await queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    } catch (error) {
      console.error("Fehler beim Wiederherstellen des Projekts:", error);
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

  // Filtere Projekte nach Status (archiviert/nicht archiviert)
  const activeProjects = projects.filter(p => !p.archived);
  const archivedProjects = projects.filter(p => p.archived);
  
  // Filtere aktive Projekte nach Favoriten
  const favoriteProjects = activeProjects.filter(p => p.isFavorite);
  const nonFavoriteProjects = activeProjects.filter(p => !p.isFavorite);

  // Projekt-Karte mit optionalem Archivierungs-/Wiederherstellungssymbol
  const ProjectCard = ({ project, isArchived = false }: { project: Project, isArchived?: boolean }) => (
    <Card
      key={project.id}
      className={`group hover:shadow-lg transition-all duration-300 cursor-pointer border 
        ${isArchived ? 'border-gray-200 bg-gray-50/50' : project.isFavorite ? 'border-primary/20' : 'border-primary/10 hover:border-primary/20'} 
        h-[120px]`}
      onClick={() => handleProjectClick(project)}
    >
      <CardHeader className="p-4 space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2 flex-grow">
            <CardTitle className={`text-base line-clamp-1 group-hover:text-primary transition-colors ${isArchived ? 'text-gray-500' : ''}`}>
              {project.title}
            </CardTitle>
            {isArchived && (
              <Badge variant="outline" className="text-xs">Archiviert</Badge>
            )}
          </div>
          <div className="flex">
            {isArchived ? (
              <Button
                variant="ghost"
                size="icon"
                className="p-1 hover:bg-blue-100"
                onClick={(e) => unarchiveProject(project, e)}
                title="Wiederherstellen"
              >
                <RotateCcw className="h-4 w-4 text-blue-500" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="p-1 hover:bg-yellow-100"
                onClick={(e) => toggleFavorite(project, e)}
                title={project.isFavorite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
              >
                <Star className={`h-5 w-5 ${project.isFavorite ? "fill-yellow-400 text-yellow-400" : "text-gray-400"}`} />
              </Button>
            )}
          </div>
        </div>
        <CardDescription className={`text-sm line-clamp-2 ${isArchived ? 'text-gray-500' : ''}`}>
          {project.description}
        </CardDescription>
      </CardHeader>
    </Card>
  );

  return (
    <div className="container mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Projekte
          </h1>
          <p className="text-muted-foreground mt-2">Übersicht und Verwaltung aller Projekte</p>
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
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="active" className="relative">
              Aktive Projekte
              {activeProjects.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {activeProjects.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="archived" className="relative">
              Archiviert
              {archivedProjects.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {archivedProjects.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="active" className="space-y-8">
            {favoriteProjects.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Favorisierte Projekte</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {favoriteProjects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              </div>
            )}

            {nonFavoriteProjects.length > 0 && (
              <div>
                <h2 className="text-2xl font-semibold mb-4">Weitere Projekte</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {nonFavoriteProjects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              </div>
            )}
            
            {activeProjects.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Keine aktiven Projekte vorhanden</p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="archived">
            {archivedProjects.length > 0 ? (
              <div>
                <h2 className="text-2xl font-semibold mb-4">Archivierte Projekte</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {archivedProjects.map((project) => (
                    <ProjectCard key={project.id} project={project} isArchived={true} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Keine archivierten Projekte vorhanden</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      <ProjectForm
        open={showForm}
        onClose={() => setShowForm(false)}
      />
    </div>
  );
}
