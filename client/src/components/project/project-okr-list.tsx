import { useQuery } from "@tanstack/react-query";
import { type Objective, type KeyResult } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Target } from "lucide-react";
import { useLocation } from "wouter";
import { Progress } from "@/components/ui/progress";

interface ProjectOKRListProps {
  projectId: number;
}

export function ProjectOKRList({ projectId }: ProjectOKRListProps) {
  const [_, setLocation] = useLocation();

  const { data: objectives = [], isLoading: isLoadingObjectives } = useQuery<Objective[]>({
    queryKey: ["/api/objectives", projectId],
    queryFn: async () => {
      const response = await fetch(`/api/objectives?projectId=${projectId}`);
      if (!response.ok) {
        throw new Error("Fehler beim Laden der OKRs");
      }
      return response.json();
    },
  });

  if (isLoadingObjectives) {
    return <div className="text-center py-8">Lade OKRs...</div>;
  }

  // Filter objectives for this project and that are not archived
  const activeObjectives = objectives.filter(obj => obj.projectId === projectId && obj.status !== "archived");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-semibold">OKRs</h3>
        <Button onClick={() => setLocation(`/all-okrs`)} variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Neues OKR
        </Button>
      </div>

      {activeObjectives.length === 0 ? (
        <Card className="bg-muted/50">
          <CardContent className="py-6 text-center">
            <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              Diesem Projekt sind noch keine OKRs zugeordnet.
            </p>
            <Button
              onClick={() => setLocation(`/all-okrs`)}
              variant="outline"
              className="mt-4"
            >
              <Plus className="h-4 w-4 mr-2" />
              OKR erstellen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activeObjectives.map((objective) => (
            <Card
              key={objective.id}
              className="group hover:shadow-lg transition-all duration-300 cursor-pointer"
              onClick={() => setLocation(`/okr/${objective.id}`)}
            >
              <CardHeader className="p-4">
                <CardTitle className="text-base line-clamp-1 group-hover:text-primary transition-colors">
                  {objective.title}
                </CardTitle>
                <CardDescription className="text-sm mt-2">
                  <div className="flex items-center justify-between">
                    <span>Fortschritt</span>
                    <span className="font-medium">{objective.progress || 0}%</span>
                  </div>
                  <Progress 
                    value={objective.progress || 0} 
                    className="h-2 mt-2"
                  />
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}