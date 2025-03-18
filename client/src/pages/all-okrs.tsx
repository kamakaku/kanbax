import { useQuery } from "@tanstack/react-query";
import { type Objective } from "@shared/schema";
import { useLocation } from "wouter";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Star } from "lucide-react";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Progress } from "@/components/ui/progress";

export default function AllOKRs() {
  const [, setLocation] = useLocation();

  const { data: objectives = [], isLoading } = useQuery<Objective[]>({
    queryKey: ["/api/objectives"],
    queryFn: async () => {
      const response = await fetch("/api/objectives");
      if (!response.ok) {
        throw new Error("Failed to fetch objectives");
      }
      return response.json();
    },
  });

  const handleOKRClick = (objective: Objective) => {
    setLocation(`/okr/${objective.id}`);
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

  if (isLoading) {
    return (
      <div className="container mx-auto p-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Lade OKRs...</p>
        </div>
      </div>
    );
  }

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
        <Button onClick={() => setLocation('/okr')} className="bg-primary/10 hover:bg-primary/20">
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
                    <CardHeader className="p-4 space-y-2">
                      <div className="flex items-start justify-between">
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
                      <CardDescription className="text-sm space-y-2">
                        <div className="line-clamp-2">{objective.description}</div>
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span>Fortschritt</span>
                            <span>{objective.progress}%</span>
                          </div>
                          <Progress value={objective.progress} className="h-2" />
                        </div>
                      </CardDescription>
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
                    <CardHeader className="p-4 space-y-2">
                      <div className="flex items-start justify-between">
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
                      <CardDescription className="text-sm space-y-2">
                        <div className="line-clamp-2">{objective.description}</div>
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span>Fortschritt</span>
                            <span>{objective.progress}%</span>
                          </div>
                          <Progress value={objective.progress} className="h-2" />
                        </div>
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
