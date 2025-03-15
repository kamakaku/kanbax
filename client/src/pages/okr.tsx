import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { type Project, type OkrCycle } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { OkrCycleForm } from "@/components/okr/okr-cycle-form";
import { useState } from "react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function OKRPage() {
  const { currentProject, setCurrentProject } = useStore();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Fetch all projects
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const response = await fetch("/api/projects");
      if (!response.ok) {
        throw new Error("Failed to fetch projects");
      }
      return response.json();
    },
  });

  // Fetch OKR cycles only when a project is selected
  const { data: cycles = [], isLoading: isLoadingCycles } = useQuery<OkrCycle[]>({
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

  const handleProjectChange = (projectId: string) => {
    const selectedProject = projects.find(p => p.id === parseInt(projectId));
    if (selectedProject) {
      setCurrentProject(selectedProject);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">OKRs</h1>
        </div>

        <div className="w-full max-w-sm">
          <Select
            value={currentProject?.id?.toString()}
            onValueChange={handleProjectChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Projekt auswählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id.toString()}>
                    {project.title}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!currentProject ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center space-y-4">
              <h3 className="text-lg font-medium">Bitte wählen Sie ein Projekt aus, um die OKRs anzuzeigen.</h3>
              <p className="text-muted-foreground">
                OKRs werden im Kontext eines spezifischen Projekts verwaltet.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">{currentProject.title}</h2>
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

          {isLoadingCycles ? (
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
        </>
      )}
    </div>
  );
}

export default OKRPage;