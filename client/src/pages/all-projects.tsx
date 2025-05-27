import { useQuery } from "@tanstack/react-query";
import { type Project } from "@shared/schema";
import { useLocation } from "wouter";
import { Card, CardDescription, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Plus, Star, Archive, RotateCcw, LayoutGrid, Target, Calendar, Folder, FolderOpen } from "lucide-react";
import { useState, useEffect } from "react";
import { ProjectForm } from "@/components/project/project-form";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-store";
import { GenericLimitWarningDialog } from "@/components/subscription/generic-limit-warning-dialog";

export default function AllProjects() {
  const [, setLocation] = useLocation();
  const { setCurrentProject } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [showLimitWarning, setShowLimitWarning] = useState(false);
  const { user } = useAuth();
  const subscriptionTier = user?.subscriptionTier || 'free';
  
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
  
  // Prüfen, ob das Projektlimit erreicht wurde, bevor das Formular geöffnet wird
  const handleNewProjectClick = () => {
    // Im Free-Tier ist nur ein Projekt erlaubt
    if (subscriptionTier === 'free' && projects.filter(p => !p.archived).length >= 1) {
      setShowLimitWarning(true);
    } else {
      setShowForm(true);
    }
  };

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
    return boards.filter((board: any) => board.project_id === projectId && !board.archived).length;
  };

  const getOkrCount = (projectId: number) => {
    return objectives.filter((objective: any) => objective.projectId === projectId && objective.status !== "archived").length;
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

  // Mac-Folder Style Projektkarte, wie im CodePen Beispiel
  const ProjectCard = ({ project, isArchived = false }: { project: Project, isArchived?: boolean }) => {
    const boardCount = getBoardCount(project.id);
    const okrCount = getOkrCount(project.id);
    
    // Text-Farbe basierend auf Status
    const textColor = isArchived ? "text-gray-500" : "text-gray-800";
    
    // Erstelle eine einzigartige ID für diese Karte, um CSS-Variablen zu setzen
    const cardId = `folder-${project.id}`;
    
    return (
      <div
        id={cardId}
        className="group cursor-pointer transition-all duration-300 relative h-full pt-5 mt-5"
        onClick={() => handleProjectClick(project)}
        style={{
          // Verwende CSS-Variablen für die Farbe und andere Eigenschaften
          "--folder-tab-color": isArchived 
            ? "#94a3b8" 
            : project.isFavorite 
              ? "#f59e0b" 
              : "hsl(var(--primary))" 
        } as React.CSSProperties}
      >
        {/* Mac-Folder Container mit den CSS-Klassen aus index.css */}
        <div 
          className={cn(
            "mac-folder", 
            isArchived && "mac-folder-archived",
            project.isFavorite && !isArchived && "mac-folder-favorite",
            "flex flex-col p-5 pb-3"
          )}
        >
          {/* Projekt-Titel und Info */}
          <div className="mb-3">
            <div className="flex items-start">
              <div className="flex-1 min-w-0">
                <h3 className={cn(
                  "text-lg font-semibold line-clamp-1 mb-1 group-hover:text-primary transition-colors",
                  textColor
                )}>
                  {project.title}
                </h3>
                
                {isArchived && (
                  <Badge variant="outline" className="text-xs">Archiviert</Badge>
                )}
              </div>
            </div>
            
            <p className={cn(
              "text-sm line-clamp-2",
              isArchived ? "text-gray-400" : "text-gray-600"
            )}>
              {project.description || "Keine Beschreibung"}
            </p>
          </div>
          
          {/* Statistiken */}
          <div className="flex space-x-6 mt-2">
            <div className="flex items-center">
              <LayoutGrid className="h-4 w-4 text-blue-600 mr-1.5" />
              <span className="text-sm text-gray-700 font-medium">{boardCount}</span>
            </div>
            <div className="flex items-center">
              <Target className="h-4 w-4 text-green-600 mr-1.5" />
              <span className="text-sm text-gray-700 font-medium">{okrCount}</span>
            </div>
          </div>
          
          {/* Footer */}
          <div className="flex-grow"></div>
          <div className="mt-auto pt-3 border-t border-gray-100 flex justify-between items-center">
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
                  className="p-1 h-7 w-7 rounded-full hover:bg-blue-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    unarchiveProject(project, e);
                  }}
                  title="Wiederherstellen"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-blue-500" />
                </Button>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="p-1 h-7 w-7 rounded-full hover:bg-yellow-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(project, e);
                    }}
                    title={project.isFavorite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
                  >
                    <Star className={`h-3.5 w-3.5 ${project.isFavorite ? "fill-yellow-400 text-yellow-400" : "text-gray-400"}`} />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="p-1 h-7 w-7 rounded-full hover:bg-gray-200"
                    onClick={(e) => {
                      e.stopPropagation();
                      archiveProject(project, e);
                    }}
                    title="Projekt archivieren"
                  >
                    <Archive className="h-3.5 w-3.5 text-gray-500" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Projekte
          </h1>
          <p className="text-muted-foreground mt-2">Übersicht und Verwaltung aller Projekte</p>
        </div>
        <Button 
          onClick={handleNewProjectClick} 
          className="bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white shadow-md transition-all duration-300 hover:shadow-lg"
        >
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
                <h2 className="text-xl font-semibold mb-4">Favorisierte Projekte</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {favoriteProjects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              </div>
            )}

            {nonFavoriteProjects.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Weitere Projekte</h2>
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
                <h2 className="text-xl font-semibold mb-4">Archivierte Projekte</h2>
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
      
      {/* Warnungsdialog für Projektlimit im Free-Tier */}
      <GenericLimitWarningDialog
        open={showLimitWarning}
        onOpenChange={setShowLimitWarning}
        title="Projekt-Limit erreicht"
        limitType="projects"
        resourceName="Projekt"
        resourceNamePlural="Projekte"
        endpoint="/api/subscription/check-limit/projects"
      />
    </div>
  );
}
