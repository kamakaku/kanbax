import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { type Objective } from "@shared/schema";
import { useLocation } from "wouter";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Star, Archive, RotateCcw, Calendar } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ObjectiveForm } from "@/components/okr/objective-form";
import { useToast } from "@/hooks/use-toast";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function AllOKRs() {
  const [, setLocation] = useLocation();
  const [isObjectiveDialogOpen, setIsObjectiveDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("active");
  const [objectiveToArchive, setObjectiveToArchive] = useState<Objective | null>(null);
  const [objectiveToUnarchive, setObjectiveToUnarchive] = useState<Objective | null>(null);
  const { toast } = useToast();

  const { data: objectives = [], isLoading } = useQuery<Objective[]>({
    queryKey: ["/api/objectives"],
    queryFn: async () => {
      console.log("Fetching objectives...");
      const response = await fetch("/api/objectives");
      if (!response.ok) {
        const error = await response.json();
        console.error("Error fetching objectives:", error);
        throw new Error(error.message || "Failed to fetch objectives");
      }
      const data = await response.json();
      console.log("Received objectives:", data);
      return data;
    },
  });

  const handleOKRClick = (objective: Objective) => {
    setLocation(`/all-okrs/${objective.id}`);
  };

  const handleToggleFavorite = async (objective: Objective, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiRequest('PATCH', `/api/objectives/${objective.id}/favorite`);
      await queryClient.invalidateQueries({ queryKey: ["/api/objectives"] });
      toast({
        title: "Favoriten-Status aktualisiert",
        description: "Der Favoriten-Status des Objectives wurde aktualisiert.",
        variant: "default"
      });
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
      toast({
        title: "Fehler",
        description: `Fehler beim Aktualisieren des Favoriten-Status: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
        variant: "destructive"
      });
    }
  };

  const handleArchive = (objective: Objective, e: React.MouseEvent) => {
    e.stopPropagation();
    setObjectiveToArchive(objective);
  };

  const handleUnarchive = (objective: Objective, e: React.MouseEvent) => {
    e.stopPropagation();
    setObjectiveToUnarchive(objective);
  };

  const confirmArchive = async () => {
    if (!objectiveToArchive) return;
    
    try {
      await apiRequest("PATCH", `/api/objectives/${objectiveToArchive.id}`, {
        status: "archived"
      });

      await queryClient.invalidateQueries({ queryKey: ["/api/objectives"] });
      
      toast({
        title: "Objective archiviert",
        description: "Das Objective wurde erfolgreich archiviert.",
      });
      
      setObjectiveToArchive(null);
    } catch (error) {
      console.error("Error archiving objective:", error);
      toast({
        title: "Fehler beim Archivieren",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    }
  };

  const confirmUnarchive = async () => {
    if (!objectiveToUnarchive) return;
    
    try {
      await apiRequest("PATCH", `/api/objectives/${objectiveToUnarchive.id}`, {
        status: "active"
      });

      await queryClient.invalidateQueries({ queryKey: ["/api/objectives"] });
      
      toast({
        title: "Objective wiederhergestellt",
        description: "Das Objective wurde erfolgreich wiederhergestellt.",
      });
      
      setObjectiveToUnarchive(null);
    } catch (error) {
      console.error("Error unarchiving objective:", error);
      toast({
        title: "Fehler beim Wiederherstellen",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    }
  };

  const handleNewOKRClick = (e: React.MouseEvent) => {
    e.preventDefault();
    console.log("Opening new OKR dialog...");
    setIsObjectiveDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Lade OKRs...</p>
        </div>
      </div>
    );
  }

  console.log("Rendering objectives:", objectives);
  
  const activeObjectives = objectives.filter(o => o.status !== "archived");
  const archivedObjectives = objectives.filter(o => o.status === "archived");
  
  const favoriteOKRs = activeObjectives.filter(o => o.isFavorite);
  const nonFavoriteOKRs = activeObjectives.filter(o => !o.isFavorite);

  function renderObjectiveCard(objective: Objective) {
    return (
      <div key={objective.id} className="masked-card">
        <GlassCard 
          className="group hover:shadow-lg transition-all duration-300 cursor-pointer relative"
          onClick={() => handleOKRClick(objective)}
        >
          <CardHeader className="p-4 pb-2">
            <div className="flex items-start justify-between">
              <CardTitle className="text-lg font-bold line-clamp-1 group-hover:text-primary transition-colors">
                {objective.title}
              </CardTitle>
              {objective.status === "archived" && (
                <Badge variant="outline" className="ml-2 bg-gray-100 text-gray-500">
                  Archiviert
                </Badge>
              )}
              {objective.status === "completed" && (
                <Badge variant="outline" className="ml-2 bg-green-100 text-green-500">
                  Abgeschlossen
                </Badge>
              )}
            </div>
          </CardHeader>
          
          <CardContent className="p-4 pt-2 pb-2">
            <div className="flex items-center space-x-2 mb-3">
              <div className="h-3 flex-1 rounded-full overflow-hidden relative">
                {/* Schraffur-Hintergrund mit engeren diagonalen Linien */}
                <div className="absolute inset-0 bg-white">
                  <svg 
                    width="100%" 
                    height="100%" 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="overflow-visible"
                  >
                    <defs>
                      <pattern 
                        id="diagonalHatch" 
                        width="4" 
                        height="4" 
                        patternUnits="userSpaceOnUse" 
                        patternTransform="rotate(45)"
                      >
                        <line 
                          x1="0" 
                          y1="0" 
                          x2="0" 
                          y2="4" 
                          stroke="#888" 
                          strokeWidth="1.5" 
                          strokeOpacity="0.65"
                        />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#diagonalHatch)" />
                  </svg>
                </div>
                
                {/* Fortschrittsbalken */}
                <div 
                  role="progressbar" 
                  className={cn(
                    "h-full rounded-full transition-all relative z-10",
                    objective.progress === 100 ? 
                      "bg-green-500" : 
                      "bg-gradient-to-r from-blue-400 to-blue-600"
                  )}
                  style={{ width: `${objective.progress || 0}%` }}
                />
              </div>
              <span className="font-medium text-sm min-w-[40px] text-right">
                {objective.progress || 0}%
              </span>
            </div>
          </CardContent>
          
          <CardFooter className="p-4 pt-2 flex justify-between items-center border-t text-sm">
            <div className="flex items-center text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 mr-1.5" />
              {objective.createdAt && format(new Date(objective.createdAt), "dd.MM.yyyy", { locale: de })}
            </div>
            
            <div className="flex items-center space-x-1">
              {objective.status !== "archived" ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 p-1 hover:bg-red-50 rounded-full"
                  onClick={(e) => handleArchive(objective, e)}
                  title="Archivieren"
                >
                  <Archive className="h-4 w-4 text-gray-500" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 p-1 hover:bg-blue-50 rounded-full"
                  onClick={(e) => handleUnarchive(objective, e)}
                  title="Wiederherstellen"
                >
                  <RotateCcw className="h-4 w-4 text-blue-500" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 p-1 rounded-full", 
                  objective.isFavorite ? "hover:bg-yellow-50" : "hover:bg-gray-50"
                )}
                onClick={(e) => handleToggleFavorite(objective, e)}
                title={objective.isFavorite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
              >
                <Star className={cn(
                  "h-5 w-5", 
                  objective.isFavorite ? "fill-yellow-400 text-yellow-400" : "text-gray-400"
                )} />
              </Button>
            </div>
          </CardFooter>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Alle OKRs
          </h1>
          <p className="text-muted-foreground mt-2">Übersicht aller verfügbaren OKRs</p>
        </div>
        <Button onClick={handleNewOKRClick} className="bg-primary/10 backdrop-blur-sm hover:bg-primary/20">
          <Plus className="mr-2 h-4 w-4" />
          Neues OKR
        </Button>
      </div>

      <Tabs defaultValue="active" value={activeTab} onValueChange={setActiveTab} className="w-full mb-8">
        <TabsList className="mb-6">
          <TabsTrigger value="active">Aktive OKRs</TabsTrigger>
          <TabsTrigger value="archived">Archivierte OKRs</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {activeObjectives.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Keine aktiven OKRs vorhanden</p>
            </div>
          ) : (
            <>
              {favoriteOKRs.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-2xl font-semibold mb-4">Favorisierte OKRs</h2>
                  <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                    {favoriteOKRs.map((objective) => renderObjectiveCard(objective))}
                  </div>
                </div>
              )}

              {nonFavoriteOKRs.length > 0 && (
                <div>
                  <h2 className="text-2xl font-semibold mb-4">Weitere OKRs</h2>
                  <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                    {nonFavoriteOKRs.map((objective) => renderObjectiveCard(objective))}
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="archived">
          {archivedObjectives.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Keine archivierten OKRs vorhanden</p>
            </div>
          ) : (
            <div>
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                {archivedObjectives.map((objective) => renderObjectiveCard(objective))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog 
        open={isObjectiveDialogOpen} 
        onOpenChange={setIsObjectiveDialogOpen}
      >
        <DialogContent className="sm:max-w-[600px] p-0">
          <div className="p-6 pb-0">
            <DialogHeader>
              <DialogTitle>Neues Objective erstellen</DialogTitle>
            </DialogHeader>
          </div>
          
          <div className="overflow-y-auto px-6 pb-0 pt-2" style={{ maxHeight: "calc(85vh - 160px)" }}>
            <ObjectiveForm 
              onSuccess={() => {
                console.log("Form submitted successfully, closing dialog");
                setIsObjectiveDialogOpen(false);
                toast({ title: "Objective erfolgreich erstellt" });
              }} 
            />
          </div>
          
          <div className="p-6 border-t flex flex-row justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsObjectiveDialogOpen(false)}
            >
              Abbrechen
            </Button>
            <Button
              type="submit"
              form="objective-form"
            >
              Objective erstellen
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!objectiveToArchive}
        onOpenChange={(open) => !open && setObjectiveToArchive(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Objective archivieren?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie das Objective "{objectiveToArchive?.title}" wirklich archivieren? 
              Es wird aus der Liste der aktiven Objectives entfernt, kann aber später wiederhergestellt werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmArchive}>Archivieren</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!objectiveToUnarchive}
        onOpenChange={(open) => !open && setObjectiveToUnarchive(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Objective wiederherstellen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie das Objective "{objectiveToUnarchive?.title}" wirklich wiederherstellen? 
              Es wird wieder in der Liste der aktiven Objectives angezeigt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUnarchive}>Wiederherstellen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}