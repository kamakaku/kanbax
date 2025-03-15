import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { type Objective, type OkrCycle } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ObjectiveForm } from "@/components/okr/objective-form";
import { OkrCycleForm } from "@/components/okr/okr-cycle-form";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function OKRPage() {
  const [isObjectiveDialogOpen, setIsObjectiveDialogOpen] = useState(false);
  const [isCycleDialogOpen, setIsCycleDialogOpen] = useState(false);

  // Fetch all objectives
  const { data: objectives = [], isLoading: isLoadingObjectives } = useQuery<Objective[]>({
    queryKey: ["/api/objectives"],
    queryFn: async () => {
      const response = await fetch("/api/objectives");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der Objectives");
      }
      return response.json();
    },
  });

  // Fetch all cycles
  const { data: cycles = [], isLoading: isLoadingCycles } = useQuery<OkrCycle[]>({
    queryKey: ["/api/okr-cycles"],
    queryFn: async () => {
      const response = await fetch("/api/okr-cycles");
      if (!response.ok) {
        throw new Error("Fehler beim Laden der OKR-Zyklen");
      }
      return response.json();
    },
  });

  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">OKRs</h1>
          <div className="flex gap-4">
            <Dialog open={isCycleDialogOpen} onOpenChange={setIsCycleDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Neuer OKR-Zyklus
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Neuen OKR-Zyklus erstellen</DialogTitle>
                </DialogHeader>
                <OkrCycleForm onSuccess={() => setIsCycleDialogOpen(false)} />
              </DialogContent>
            </Dialog>

            <Dialog open={isObjectiveDialogOpen} onOpenChange={setIsObjectiveDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Neues Objective
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Neues Objective erstellen</DialogTitle>
                </DialogHeader>
                <ObjectiveForm onSuccess={() => setIsObjectiveDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <Tabs defaultValue="objectives">
        <TabsList>
          <TabsTrigger value="objectives">Objectives</TabsTrigger>
          <TabsTrigger value="cycles">OKR-Zyklen</TabsTrigger>
        </TabsList>

        <TabsContent value="objectives">
          {isLoadingObjectives ? (
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
        </TabsContent>

        <TabsContent value="cycles">
          {isLoadingCycles ? (
            <div>Lade OKR-Zyklen...</div>
          ) : cycles.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center space-y-4">
                  <h3 className="text-lg font-medium">Keine OKR-Zyklen vorhanden</h3>
                  <p className="text-muted-foreground">
                    Erstellen Sie einen neuen OKR-Zyklus, um Ihre Ziele zeitlich zu organisieren.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              {cycles.map((cycle) => (
                <Card key={cycle.id}>
                  <CardHeader>
                    <CardTitle>{cycle.title}</CardTitle>
                    <div className="text-sm text-muted-foreground">
                      {new Date(cycle.startDate).toLocaleDateString()} - {new Date(cycle.endDate).toLocaleDateString()}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Status: {cycle.status}
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default OKRPage;