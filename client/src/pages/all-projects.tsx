import { useQuery } from "@tanstack/react-query";
import { type Project } from "@shared/schema";
import { useLocation } from "wouter";
import { Card, CardDescription, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Plus, Star, Archive, RotateCcw, LayoutGrid, Target, Calendar, Folder, FolderOpen } from "lucide-react";
import { useState } from "react";
import { ProjectForm } from "@/components/project/project-form";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";

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

  // API-Abfragen für Boards und OKRs pro Projekt
  const { data: boards = [] } = useQuery({
    queryKey: ["/api/boards"],
    queryFn: async () => {
      const response = await fetch("/api/boards");
      if (!response.ok) throw new Error("Fehler beim Laden der Boards");
      return response.json();
    },
  });

  const { data: objectives = [] } = useQuery({
    queryKey: ["/api/objectives"],
    queryFn: async () => {
      const response = await fetch("/api/objectives");
      if (!response.ok) throw new Error("Fehler beim Laden der Objectives");
      return response.json();
    },
  });

  // Zähle Boards und OKRs pro Projekt
  const getBoardCount = (projectId: number) => {
    return boards.filter(board => board.project_id === projectId && !board.archived).length;
  };

  const getOkrCount = (projectId: number) => {
    return objectives.filter(objective => objective.projectId === projectId && objective.status !== "archived").length;
  };

  // Funktion zum Archivieren eines Projekts
  const archiveProject = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiRequest('PATCH', `/api/projects/${project.id}/archive`);
      await queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    } catch (error) {
      console.error("Fehler beim Archivieren des Projekts:", error);
    }
  };

  // Projekt-Karte im Mac-Folder-Style
  const ProjectCard = ({ project, isArchived = false }: { project: Project, isArchived?: boolean }) => {
    const boardCount = getBoardCount(project.id);
    const okrCount = getOkrCount(project.id);
    
    // Farbklassen für verschiedene Status
    const folderColor = isArchived
      ? "from-gray-200 to-gray-100" 
      : project.isFavorite
        ? "from-blue-200 to-blue-100"
        : "from-blue-100 to-blue-50";
    
    const titleColor = isArchived 
      ? "text-gray-500" 
      : "text-gray-800";
    
    return (
      <div
        className={cn(
          "group cursor-pointer relative rounded-lg overflow-hidden transition-all duration-300",
          "border border-gray-200 shadow-sm hover:shadow-md hover:translate-y-[-2px]",
          "flex flex-col"
        )}
        onClick={() => handleProjectClick(project)}
      >
        {/* Mac-Style Folder Oberer Teil */}
        <div className={cn(
          "h-[35px] w-full rounded-t-lg bg-gradient-to-b",
          folderColor,
          "flex items-center relative"
        )}>
          {/* Folder Tab */}
          <div className="absolute top-0 left-6 h-[4px] w-24 rounded-b-md bg-gray-100/50"></div>
          
          {/* Folder Icons (Favorit, Archiv) */}
          <div className="absolute right-2 top-[6px] flex space-x-1">
            {project.isFavorite && !isArchived && (
              <div className="h-5 w-5 flex items-center justify-center">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-500" />
              </div>
            )}
            {isArchived && (
              <div className="h-5 w-5 flex items-center justify-center">
                <Archive className="h-4 w-4 text-gray-500" />
              </div>
            )}
          </div>
          
          {/* Folder Icon */}
          <div className="ml-3">
            <Folder className={cn(
              "h-5 w-5",
              isArchived ? "text-gray-500" : project.isFavorite ? "text-blue-500" : "text-blue-400"
            )} />
          </div>
        </div>
        
        {/* Folder Inhalt */}
        <div className="p-4 pt-3 flex-grow bg-white">
          {/* Titel */}
          <div className="mb-2 flex items-start">
            <h3 className={cn(
              "font-medium text-base line-clamp-1 group-hover:text-primary transition-colors",
              titleColor
            )}>
              {project.title}
            </h3>
            {isArchived && (
              <Badge variant="outline" className="text-xs ml-2 mt-0.5">Archiviert</Badge>
            )}
          </div>
          
          {/* Beschreibung */}
          <p className={cn(
            "text-sm line-clamp-2 mb-3",
            isArchived ? "text-gray-500" : "text-gray-600"
          )}>
            {project.description || "Keine Beschreibung"}
          </p>
          
          {/* Statistiken */}
          <div className="flex space-x-4 mb-1">
            <div className="flex items-center">
              <LayoutGrid className="h-4 w-4 text-blue-500 mr-1.5" />
              <span className="text-sm text-gray-700 font-medium">{boardCount}</span>
            </div>
            <div className="flex items-center">
              <Target className="h-4 w-4 text-green-500 mr-1.5" />
              <span className="text-sm text-gray-700 font-medium">{okrCount}</span>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-gray-100 flex justify-between items-center bg-gray-50">
          <div className="flex items-center">
            <Calendar className="h-3.5 w-3.5 text-gray-400 mr-1.5" />
            <span className="text-xs text-muted-foreground">
              {format(new Date(project.createdAt), "dd.MM.yyyy", { locale: de })}
            </span>
          </div>
          
          <div className="flex gap-1">
            {isArchived ? (
              <Button
                variant="ghost"
                size="icon"
                className="p-1 h-7 w-7 rounded-full hover:bg-blue-50"
                onClick={(e) => unarchiveProject(project, e)}
                title="Wiederherstellen"
              >
                <RotateCcw className="h-3.5 w-3.5 text-blue-500" />
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="p-1 h-7 w-7 rounded-full hover:bg-yellow-50"
                  onClick={(e) => toggleFavorite(project, e)}
                  title={project.isFavorite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
                >
                  <Star className={`h-3.5 w-3.5 ${project.isFavorite ? "fill-yellow-400 text-yellow-400" : "text-gray-400"}`} />
                </Button>
                
                <Button
                  variant="ghost"
                  size="icon"
                  className="p-1 h-7 w-7 rounded-full hover:bg-gray-100"
                  onClick={(e) => archiveProject(project, e)}
                  title="Projekt archivieren"
                >
                  <Archive className="h-3.5 w-3.5 text-gray-500" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

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
