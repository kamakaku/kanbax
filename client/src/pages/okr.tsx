import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { type Project, type Objective } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ObjectiveForm } from "@/components/okr/objective-form";
import { useState } from "react";

export function OKRPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Fetch all objectives
  const { data: objectives = [], isLoading } = useQuery<Objective[]>({
    queryKey: ["/api/objectives"],
    queryFn: async () => {
      const response = await fetch("/api/objectives");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Objectives");
      }
      return response.json();
    },
  });

  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">OKRs</h1>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="h-4 w-4 mr-2" />
                Neues Objective
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Neues Objective erstellen</DialogTitle>
              </DialogHeader>
              <ObjectiveForm onSuccess={() => setIsDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div>Lade Objectives...</div>
      ) : objectives.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center space-y-4">
              <h3 className="text-lg font-medium">Keine Objectives vorhanden</h3>
              <p className="text-muted-foreground">
                Erstellen Sie ein neues Objective, um Ihre Ziele zu verfolgen.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {objectives.map((objective) => (
            <Card key={objective.id}>
              <CardHeader>
                <CardTitle>{objective.title}</CardTitle>
                <div className="text-sm text-muted-foreground">
                  Status: {objective.status}
                </div>
                {objective.projectId && (
                  <div className="text-sm text-muted-foreground">
                    Projekt: {objective.projectId}
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {objective.description}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      Fortschritt: {objective.progress}%
                    </span>
                  </div>
                  <Button variant="outline" size="sm">
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Key Result hinzufügen
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default OKRPage;