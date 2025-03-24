import { useQuery } from "@tanstack/react-query";
import { type Project } from "@shared/schema";
import { useLocation } from "wouter";
import { CardDescription, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Plus, Star, Archive, RotateCcw, LayoutGrid, Target, Calendar, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { ProjectForm } from "@/components/project/project-form";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { FileCard } from "@/components/ui/file-card";

export default function AllProjects() {
  const [, setLocation] = useLocation();
  const { setCurrentProject } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [projectToArchive, setProjectToArchive] = useState<Project | null>(null);

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

  // Funktion zum Archivieren eines Projekts
  const handleArchiveProject = (project: Project) => {
    setProjectToArchive(project);
    setShowArchiveDialog(true);
  };
  
  const confirmArchive = async () => {
    if (!projectToArchive) return;
    
    try {
      await apiRequest('PATCH', `/api/projects/${projectToArchive.id}/archive`);
      await queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setShowArchiveDialog(false);
      setProjectToArchive(null);
    } catch (error) {
      console.error("Fehler beim Archivieren des Projekts:", error);
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

  // Projekt-Karte mit optionalem Archivierungs-/Wiederherstellungssymbol
  const ProjectCard = ({ project, isArchived = false }: { project: Project, isArchived?: boolean }) => {
    const boardCount = getBoardCount(project.id);
    const okrCount = getOkrCount(project.id);
    
    return (
      <FileCard
        key={project.id}
        className="group hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col"
        archived={isArchived}
        cutoutSize={24}
        radius={8}
        onClick={() => handleProjectClick(project)}
      >
        <CardHeader className="p-4 pb-2 space-y-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2 flex-grow">
              <CardTitle className={`text-lg font-bold line-clamp-1 group-hover:text-primary transition-colors ${isArchived ? 'text-gray-500' : ''}`}>
                {project.title}
              </CardTitle>
              {isArchived && (
                <Badge variant="outline" className="text-xs">Archiviert</Badge>
              )}
            </div>
          </div>
          <CardDescription className={`text-sm line-clamp-2 ${isArchived ? 'text-gray-500' : ''}`}>
            {project.description || "Keine Beschreibung"}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-4 pt-0 pb-2 flex-grow">
          <div className="flex space-x-4 mt-2">
            <div className="flex items-center space-x-1.5">
              <LayoutGrid className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-muted-foreground">{boardCount}</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <Target className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-muted-foreground">{okrCount}</span>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="p-4 pt-0 mt-auto border-t flex justify-between items-center">
          <div className="flex items-center">
            <Calendar className="h-3.5 w-3.5 text-gray-400 mr-1.5" />
            <span className="text-xs text-muted-foreground">
              {format(new Date(project.createdAt), "dd.MM.yyyy", { locale: de })}
            </span>
          </div>
          
          <div className="flex space-x-1">
            {isArchived ? (
              <Button
                variant="ghost"
                size="icon"
                className="p-1 h-8 w-8 hover:bg-blue-100"
                onClick={(e) => unarchiveProject(project, e)}
                title="Wiederherstellen"
              >
                <RotateCcw className="h-4 w-4 text-blue-500" />
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="p-1 h-8 w-8 hover:bg-yellow-100"
                  onClick={(e) => toggleFavorite(project, e)}
                  title={project.isFavorite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
                >
                  <Star className={`h-5 w-5 ${project.isFavorite ? "fill-yellow-400 text-yellow-400" : "text-gray-400"}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="p-1 h-8 w-8 hover:bg-gray-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleArchiveProject(project);
                  }}
                  title="Archivieren"
                >
                  <Archive className="h-4 w-4 text-gray-500" />
                </Button>
              </>
            )}
          </div>
        </CardFooter>
      </FileCard>
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

      {/* Projekt-Erstellungsformular */}
      <ProjectForm
        open={showForm}
        onClose={() => setShowForm(false)}
      />
      
      {/* Archivierungs-Bestätigungsdialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Projekt archivieren</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie das Projekt "{projectToArchive?.title}" wirklich archivieren?
              <br /><br />
              <div className="flex items-center space-x-2 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
                <span>Archivierte Projekte sind in der Ansicht "Archiviert" weiterhin verfügbar, aber für die meisten Benutzer nicht mehr sichtbar.</span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmArchive}
              className="bg-primary hover:bg-primary/90"
            >
              Archivieren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
