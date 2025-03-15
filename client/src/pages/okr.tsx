import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { type Project, type OkrCycle } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { OkrCycleForm } from "@/components/okr/okr-cycle-form";
import { useState } from "react";

export function OKRPage() {
  const { currentProject } = useStore();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: cycles = [], isLoading } = useQuery<OkrCycle[]>({
    queryKey: [`/api/projects/${currentProject?.id}/okr-cycles`],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${currentProject?.id}/okr-cycles`);
      if (!response.ok) {
        throw new Error("Fehler beim Laden der OKR-Zyklen");
      }
      return response.json();
    },
    enabled: !!currentProject?.id,
  });

  if (!currentProject) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">
          Bitte wählen Sie ein Projekt aus, um die OKRs anzuzeigen.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">OKRs - {currentProject.title}</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="h-4 w-4 mr-2" />
              Neuer OKR-Zyklus
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Neuen OKR-Zyklus erstellen</DialogTitle>
            </DialogHeader>
            <OkrCycleForm 
              projectId={currentProject.id} 
              onSuccess={() => setIsDialogOpen(false)} 
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div>Lade OKR-Zyklen...</div>
      ) : cycles.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center space-y-4">
              <h3 className="text-lg font-medium">Keine OKR-Zyklen vorhanden</h3>
              <p className="text-muted-foreground">
                Erstellen Sie einen neuen OKR-Zyklus, um Ihre Ziele zu verfolgen.
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
              </CardHeader>
              <CardContent>
                {/* Hier werden später die Objectives angezeigt */}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default OKRPage;