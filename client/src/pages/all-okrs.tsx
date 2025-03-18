import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { type Objective } from "@shared/schema";
import { useLocation } from "wouter";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Star } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ObjectiveForm } from "@/components/okr/objective-form";
import { useToast } from "@/hooks/use-toast";

export default function AllOKRs() {
  const [, setLocation] = useLocation();
  const [isObjectiveDialogOpen, setIsObjectiveDialogOpen] = useState(false);
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

  const toggleFavorite = async (objective: Objective, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiRequest('PATCH', `/api/objectives/${objective.id}/favorite`);
      await queryClient.invalidateQueries({ queryKey: ["/api/objectives"] });
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
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
  const favoriteOKRs = objectives.filter(o => o.isFavorite);
  const nonFavoriteOKRs = objectives.filter(o => !o.isFavorite);

  return (
    <div className="container mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Alle OKRs
          </h1>
          <p className="text-muted-foreground mt-2">Übersicht aller verfügbaren OKRs</p>
        </div>
        <Button onClick={handleNewOKRClick} className="bg-primary/10 hover:bg-primary/20">
          <Plus className="mr-2 h-4 w-4" />
          Neues OKR
        </Button>
      </div>

      {objectives.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Keine OKRs vorhanden</p>
        </div>
      ) : (
        <>
          {favoriteOKRs.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Favorisierte OKRs</h2>
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                {favoriteOKRs.map((objective) => (
                  <Card 
                    key={objective.id} 
                    className="group hover:shadow-lg transition-all duration-300 cursor-pointer border border-primary/20"
                    onClick={() => handleOKRClick(objective)}
                  >
                    <CardHeader className="p-4">
                      <div className="flex items-start justify-between mb-4">
                        <CardTitle className="text-base line-clamp-1 group-hover:text-primary transition-colors">
                          {objective.title}
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="p-1 hover:bg-yellow-100"
                          onClick={(e) => toggleFavorite(objective, e)}
                        >
                          <Star className={`h-5 w-5 ${objective.isFavorite ? "fill-yellow-400 text-yellow-400" : "text-gray-400"}`} />
                        </Button>
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Fortschritt</span>
                          <span className="font-medium">{objective.progress || 0}%</span>
                        </div>
                        <Progress value={objective.progress || 0} className="h-2" />
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {nonFavoriteOKRs.length > 0 && (
            <div>
              <h2 className="text-2xl font-semibold mb-4">Weitere OKRs</h2>
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                {nonFavoriteOKRs.map((objective) => (
                  <Card 
                    key={objective.id} 
                    className="group hover:shadow-lg transition-all duration-300 cursor-pointer border border-primary/10 hover:border-primary/20"
                    onClick={() => handleOKRClick(objective)}
                  >
                    <CardHeader className="p-4">
                      <div className="flex items-start justify-between mb-4">
                        <CardTitle className="text-base line-clamp-1 group-hover:text-primary transition-colors">
                          {objective.title}
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="p-1 hover:bg-yellow-100"
                          onClick={(e) => toggleFavorite(objective, e)}
                        >
                          <Star className={`h-5 w-5 ${objective.isFavorite ? "fill-yellow-400 text-yellow-400" : "text-gray-400"}`} />
                        </Button>
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Fortschritt</span>
                          <span className="font-medium">{objective.progress || 0}%</span>
                        </div>
                        <Progress value={objective.progress || 0} className="h-2" />
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <Dialog 
        open={isObjectiveDialogOpen} 
        onOpenChange={(open) => {
          console.log("Dialog state changing to:", open);
          setIsObjectiveDialogOpen(open);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Neues Objective erstellen</DialogTitle>
          </DialogHeader>
          <ObjectiveForm 
            onSuccess={() => {
              console.log("Form submitted successfully, closing dialog");
              setIsObjectiveDialogOpen(false);
              toast({ title: "Objective erfolgreich erstellt" });
            }} 
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}